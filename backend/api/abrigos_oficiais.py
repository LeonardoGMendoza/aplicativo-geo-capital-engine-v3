"""Abrigos oficiais da Defesa Civil (pedido da própria Defesa Civil na reunião de 19/10/2026).

Diferente dos pontos do OpenStreetMap (mapeados por voluntários, "possível ponto de apoio"), aqui a GESTÃO
cadastra o que está no plano de contingência: abrigos com acordo firmado, pontos de encontro/fuga e áreas de risco,
com status (aberto, lotado, fechado). O cidadão vê esses primeiro, marcados como oficiais.

Leitura é pública. Gravar exige o código do operador (OPERADOR_CODIGO, o mesmo do envio de alertas, só no servidor).
Fica num SQLite no volume do Docker (/data), nunca no GitHub.
"""
import hmac
import math
import os
import re
import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timezone

TIPOS = {"abrigo": "Abrigo", "ponto_encontro": "Ponto de encontro / rota de fuga", "area_risco": "Área de risco"}
STATUS = {"aberto", "lotado", "fechado"}
MAX_ITENS = 2000


class Invalido(ValueError):
    pass


def _texto(valor, limite):
    t = " ".join(str(valor or "").split())[:limite]
    return re.sub(r"[<>\"`{}]", "", t)


def _numero(valor):
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) else None


def distancia_km(lat1, lon1, lat2, lon2):
    r = math.pi / 180
    a = math.sin((lat2 - lat1) * r / 2) ** 2 + math.cos(lat1 * r) * math.cos(lat2 * r) * math.sin((lon2 - lon1) * r / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a))


def validar(dados):
    """Confere e limpa o que a gestão enviou. Devolve o registro pronto para gravar."""
    if not isinstance(dados, dict):
        raise Invalido("Dados inválidos.")
    tipo = str(dados.get("tipo", "")).strip()
    if tipo not in TIPOS:
        raise Invalido("Escolha o tipo: abrigo, ponto de encontro ou área de risco.")
    nome = _texto(dados.get("nome"), 80)
    if len(nome) < 3:
        raise Invalido("Digite o nome do local (pelo menos 3 letras).")
    lat, lon = _numero(dados.get("latitude")), _numero(dados.get("longitude"))
    if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise Invalido("Localização inválida. Busque o endereço de novo.")
    status = str(dados.get("status", "aberto")).strip()
    if status not in STATUS:
        raise Invalido("Status inválido.")
    capacidade = dados.get("capacidade")
    if capacidade in (None, ""):
        capacidade = None
    else:
        capacidade = _numero(capacidade)
        if capacidade is None or capacidade < 0 or capacidade > 100000:
            raise Invalido("Capacidade inválida.")
        capacidade = int(capacidade)
    raio = dados.get("raioM")
    raio = None if raio in (None, "") else _numero(raio)
    if raio is not None and not (10 <= raio <= 20000):
        raise Invalido("O raio da área de risco deve ficar entre 10 e 20.000 metros.")
    return {"tipo": tipo, "nome": nome, "endereco": _texto(dados.get("endereco"), 160) or None,
            "latitude": round(lat, 6), "longitude": round(lon, 6), "status": status, "capacidade": capacidade,
            "raioM": int(raio) if raio is not None and tipo == "area_risco" else None,
            "observacao": _texto(dados.get("observacao"), 200) or None}


def conferir_codigo(codigo):
    esperado = os.getenv("OPERADOR_CODIGO", "")
    if len(esperado) < 4 or not hmac.compare_digest(str(codigo or "").strip(), esperado):
        raise PermissionError()


class AbrigosOficiais:
    def __init__(self, caminho=None, agora=time.time):
        pasta = os.getenv("RAG_DATA_DIR", "/data")
        self.caminho = caminho or os.getenv("ABRIGOS_DB", os.path.join(pasta, "abrigos_oficiais.db"))
        self._agora = agora
        self._lock = threading.Lock()
        self._pronto = False

    @contextmanager
    def _conexao(self):
        if not self._pronto:
            os.makedirs(os.path.dirname(os.path.abspath(self.caminho)), exist_ok=True)
        con = sqlite3.connect(self.caminho, timeout=10)
        con.row_factory = sqlite3.Row
        try:
            if not self._pronto:
                con.execute("""CREATE TABLE IF NOT EXISTS abrigos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT NOT NULL, nome TEXT NOT NULL, endereco TEXT,
                    latitude REAL NOT NULL, longitude REAL NOT NULL, status TEXT NOT NULL, capacidade INTEGER,
                    raio_m INTEGER, observacao TEXT, atualizado_em TEXT NOT NULL)""")
                self._pronto = True
            yield con
            con.commit()
        finally:
            con.close()

    def _carimbo(self):
        return datetime.fromtimestamp(self._agora(), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    @staticmethod
    def _saida(linha, origem=None):
        item = {"id": linha["id"], "tipo": linha["tipo"], "tipoNome": TIPOS.get(linha["tipo"], linha["tipo"]),
                "nome": linha["nome"], "endereco": linha["endereco"], "latitude": linha["latitude"], "longitude": linha["longitude"],
                "status": linha["status"], "capacidade": linha["capacidade"], "raioM": linha["raio_m"],
                "observacao": linha["observacao"], "atualizadoEm": linha["atualizado_em"]}
        if origem:
            item["distanciaKm"] = round(distancia_km(origem[0], origem[1], linha["latitude"], linha["longitude"]), 3)
        return item

    def listar(self, latitude=None, longitude=None, raio_km=None):
        """Público. Com latitude/longitude, ordena pela distância e (se raio_km) corta pelo raio."""
        lat, lon = _numero(latitude), _numero(longitude)
        origem = (lat, lon) if lat is not None and lon is not None and -90 <= lat <= 90 and -180 <= lon <= 180 else None
        with self._lock, self._conexao() as con:
            linhas = con.execute("SELECT * FROM abrigos ORDER BY id LIMIT ?", (MAX_ITENS,)).fetchall()
        itens = [self._saida(linha, origem) for linha in linhas]
        if origem:
            raio = _numero(raio_km)
            if raio is not None and raio > 0:
                itens = [i for i in itens if i["distanciaKm"] <= raio]
            itens.sort(key=lambda i: i["distanciaKm"])
        return {"fonte": "Defesa Civil (cadastro oficial)", "itens": itens}

    def criar(self, dados, codigo):
        conferir_codigo(codigo)
        r = validar(dados)
        with self._lock, self._conexao() as con:
            total, = con.execute("SELECT COUNT(*) FROM abrigos").fetchone()
            if total >= MAX_ITENS:
                raise Invalido("Limite de locais cadastrados atingido.")
            cur = con.execute("""INSERT INTO abrigos (tipo, nome, endereco, latitude, longitude, status, capacidade, raio_m, observacao, atualizado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", (r["tipo"], r["nome"], r["endereco"], r["latitude"], r["longitude"], r["status"],
                                                       r["capacidade"], r["raioM"], r["observacao"], self._carimbo()))
            linha = con.execute("SELECT * FROM abrigos WHERE id = ?", (cur.lastrowid,)).fetchone()
        return self._saida(linha)

    def mudar_status(self, ident, status, codigo):
        conferir_codigo(codigo)
        if status not in STATUS:
            raise Invalido("Status inválido.")
        with self._lock, self._conexao() as con:
            cur = con.execute("UPDATE abrigos SET status = ?, atualizado_em = ? WHERE id = ?", (status, self._carimbo(), int(ident)))
            if cur.rowcount == 0:
                raise LookupError()
            linha = con.execute("SELECT * FROM abrigos WHERE id = ?", (int(ident),)).fetchone()
        return self._saida(linha)

    def remover(self, ident, codigo):
        conferir_codigo(codigo)
        with self._lock, self._conexao() as con:
            cur = con.execute("DELETE FROM abrigos WHERE id = ?", (int(ident),))
            if cur.rowcount == 0:
                raise LookupError()
        return {"ok": True}
