"""Cadastro mínimo do cidadão para alertas no WhatsApp (entrada pelo QR code).

Guarda só o necessário (LGPD, dado mínimo): celular, CEP, nome opcional, data do aceite e origem (qr/site).
Fica num SQLite no volume do Docker (/data), nunca no GitHub. Nada é enviado a ninguém daqui:
o disparo dos alertas (n8n/WAHA) é outra etapa e só lê a lista com o token do servidor.
"""
import hmac
import os
import re
import sqlite3
import threading
import time
from contextlib import contextmanager
from collections import deque
from datetime import datetime, timezone

LIMITE_IP_HORA = 5
LIMITE_GERAL_HORA = 300
NOME_MAX = 60


class Invalido(ValueError):
    pass


class LimiteExcedido(Exception):
    pass


def normalizar_celular(texto):
    """Celular brasileiro com DDD → '+55DDD9XXXXXXXX'. Aceita espaços, traços, parênteses e +55."""
    digitos = re.sub(r"\D", "", str(texto or ""))
    if len(digitos) == 13 and digitos.startswith("55"):
        digitos = digitos[2:]
    if len(digitos) != 11:
        raise Invalido("Digite o celular com DDD, por exemplo (51) 99999-1234.")
    ddd, numero = digitos[:2], digitos[2:]
    if not (11 <= int(ddd) <= 99) or ddd[1] == "0" or numero[0] != "9" or len(set(numero)) == 1:
        raise Invalido("Esse número não parece um celular válido.")
    return f"+55{digitos}"


def normalizar_cep(texto):
    digitos = re.sub(r"\D", "", str(texto or ""))
    if len(digitos) != 8 or len(set(digitos)) == 1:
        raise Invalido("Digite o CEP com 8 números, por exemplo 90010-150.")
    return digitos


def limpar_nome(texto):
    nome = " ".join(str(texto or "").split())[:NOME_MAX]
    return re.sub(r"[<>\"'`{}]", "", nome) or None


def mascarar(celular):
    """+5551999991234 → (51) 9****-1234: confirma para a pessoa sem mostrar o número inteiro."""
    d = celular[3:]
    return f"({d[:2]}) {d[2]}****-{d[-4:]}"


class Cadastros:
    def __init__(self, caminho=None, agora=time.time):
        pasta = os.getenv("RAG_DATA_DIR", "/data")
        self.caminho = caminho or os.getenv("CADASTROS_DB", os.path.join(pasta, "cadastros.db"))
        self._agora = agora
        self._lock = threading.Lock()
        self._por_ip = {}
        self._geral = deque()
        self._pronto = False

    @contextmanager
    def _conexao(self):
        """Abre, grava (commit) e fecha a conexão a cada operação."""
        if not self._pronto:
            os.makedirs(os.path.dirname(os.path.abspath(self.caminho)), exist_ok=True)
        con = sqlite3.connect(self.caminho, timeout=10)
        try:
            if not self._pronto:
                con.execute("""CREATE TABLE IF NOT EXISTS cadastros (
                    celular TEXT PRIMARY KEY, cep TEXT NOT NULL, nome TEXT, origem TEXT NOT NULL,
                    aceite_em TEXT NOT NULL, atualizado_em TEXT NOT NULL)""")
                self._pronto = True
            yield con
            con.commit()
        finally:
            con.close()

    def _limitar(self, ip):
        agora = self._agora()
        with self._lock:
            while self._geral and agora - self._geral[0] > 3600:
                self._geral.popleft()
            fila = self._por_ip.setdefault(ip, deque())
            while fila and agora - fila[0] > 3600:
                fila.popleft()
            if len(fila) >= LIMITE_IP_HORA or len(self._geral) >= LIMITE_GERAL_HORA:
                raise LimiteExcedido()
            fila.append(agora)
            self._geral.append(agora)
            if len(self._por_ip) > 5000:  # não deixa a memória crescer sem fim
                self._por_ip = {k: v for k, v in self._por_ip.items() if v and agora - v[-1] < 3600}

    def _carimbo(self):
        return datetime.fromtimestamp(self._agora(), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def cadastrar(self, celular, cep, aceite, nome=None, origem="site", ip="?"):
        if aceite is not True:
            raise Invalido("Para receber os alertas é preciso aceitar o uso do seu celular e CEP.")
        celular, cep, nome = normalizar_celular(celular), normalizar_cep(cep), limpar_nome(nome)
        origem = "qr" if origem == "qr" else "site"
        self._limitar(ip)
        agora = self._carimbo()
        with self._lock, self._conexao() as con:
            existia = con.execute("SELECT 1 FROM cadastros WHERE celular = ?", (celular,)).fetchone() is not None
            con.execute("""INSERT INTO cadastros (celular, cep, nome, origem, aceite_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(celular) DO UPDATE SET cep = excluded.cep, nome = excluded.nome, aceite_em = excluded.aceite_em,
                atualizado_em = excluded.atualizado_em""", (celular, cep, nome, origem, agora, agora))
        return {"ok": True, "atualizado": existia, "celular": mascarar(celular), "cep": f"{cep[:5]}-{cep[5:]}"}

    def sair(self, celular, cep, ip="?"):
        """Remove o cadastro (celular + CEP precisam bater). A resposta é sempre a mesma: não revela quem está cadastrado."""
        celular, cep = normalizar_celular(celular), normalizar_cep(cep)
        self._limitar(ip)
        with self._lock, self._conexao() as con:
            con.execute("DELETE FROM cadastros WHERE celular = ? AND cep = ?", (celular, cep))
        return {"ok": True}

    def resumo(self):
        """Só números, nunca telefones: total e quantos entraram pelo QR."""
        with self._lock, self._conexao() as con:
            total, = con.execute("SELECT COUNT(*) FROM cadastros").fetchone()
            qr, = con.execute("SELECT COUNT(*) FROM cadastros WHERE origem = 'qr'").fetchone()
        return {"total": total, "peloQr": qr}

    def lista(self, token):
        """Lista completa para o disparo dos alertas (n8n). Só com o token do servidor (CADASTROS_TOKEN)."""
        esperado = os.getenv("CADASTROS_TOKEN", "")
        if len(esperado) < 24 or not hmac.compare_digest(str(token or ""), esperado):
            raise PermissionError()
        with self._lock, self._conexao() as con:
            linhas = con.execute("SELECT celular, cep, nome, origem, aceite_em FROM cadastros ORDER BY aceite_em").fetchall()
        return [{"celular": c, "cep": p, "nome": n, "origem": o, "aceiteEm": a} for c, p, n, o, a in linhas]
