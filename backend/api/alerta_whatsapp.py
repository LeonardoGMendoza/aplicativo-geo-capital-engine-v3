"""Envio REAL de alerta por WhatsApp a partir das telas Visão Corporativa e Impacto Social (como no painel Streamlit).

O site é público, então o envio exige o código do operador (OPERADOR_CODIGO, só no servidor, em ia.env).
A MENSAGEM É MONTADA AQUI, com modelo fixo: nível calculado por nós (distância + idade do evento), recomendação
da IA da Oracle (com PDF e página) e o link do app de fuga. Nenhuma IA inventa endereço ou manda evacuar sozinha.
O n8n (N8N_ALERTA_URL → webhook "alerta-omni") só confere o token e entrega pelo WAHA.
"""
import hmac
import logging
import os
import re
import threading
import time
from collections import deque
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

log = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/api/v1/alertas", tags=["alertas"])
_NO_STORE = {"Cache-Control": "no-store"}
LIMITE_IP_HORA = 10


class Invalido(ValueError):
    pass


def formatar_destino(texto):
    """Igual ao Streamlit: grupo (…@g.us) passa direto; celular vira 55DDDNUMERO@c.us."""
    t = str(texto or "").strip()
    if re.fullmatch(r"[\d-]{10,40}@g\.us", t):
        return t
    d = re.sub(r"\D", "", t.split("@")[0])
    if len(d) in (10, 11):
        d = "55" + d
    if not re.fullmatch(r"55\d{10,11}", d):
        raise Invalido("Destino inválido: use o celular com DDD ou o ID do grupo (termina em @g.us).")
    return d + "@c.us"


def _texto(valor, limite):
    return " ".join(str(valor or "").split())[:limite]


def _linhas(valor, limite):
    """Como _texto, mas mantém as quebras de linha (a lista numerada da IA continua legível no WhatsApp)."""
    texto = "\n".join(" ".join(l.split()) for l in str(valor or "").splitlines() if l.strip())
    return texto if len(texto) <= limite else texto[:limite - 1].rstrip() + "…"


class Limitador:
    def __init__(self, agora=time.time):
        self._agora, self._lock, self._por_ip = agora, threading.Lock(), {}

    def permitir(self, ip):
        agora = self._agora()
        with self._lock:
            fila = self._por_ip.setdefault(ip, deque())
            while fila and agora - fila[0] > 3600:
                fila.popleft()
            if len(fila) >= LIMITE_IP_HORA:
                return False
            fila.append(agora)
            return True


_limitador = Limitador()


class Pedido(BaseModel):
    codigo: str = Field(max_length=100)
    destino: str = Field(max_length=60)
    local: str = Field(max_length=200)
    evento: str = Field(max_length=400)
    recomendacao: str | None = Field(default=None, max_length=2000)
    origem: str = Field(default="NASA EONET", max_length=40)
    publico: str = Field(default="comunidade", max_length=12)    # "empresa" ou "comunidade"
    km: float | None = Field(default=None, ge=0, le=20000)
    observadoEm: str | None = Field(default=None, max_length=40)  # data da última observação do evento (NASA)
    categoria: str | None = Field(default=None, max_length=80)


LINK_APP = "https://omni.sandlj.com.br/cidadao"
NIVEIS = {
    "AGIR": "siga já as orientações das autoridades locais e vá para um local seguro se for orientado.",
    "ATENÇÃO": "prepare documentos, água e remédios e veja qual é o abrigo mais perto.",
    "MONITORAR": "não há ação imediata; fique atento a novos avisos.",
}


def idade_dias(observado_em, agora=None):
    try:
        quando = datetime.fromisoformat(str(observado_em).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if quando.tzinfo is None:
        quando = quando.replace(tzinfo=timezone.utc)
    return max(0.0, ((agora or datetime.now(timezone.utc)) - quando).total_seconds() / 86400)


def calcular_nivel(km, dias):
    """Regra fixa do protótipo (não é alerta oficial): perto e recente = AGIR; médio = ATENÇÃO; longe ou antigo = MONITORAR."""
    if dias is None:
        return "MONITORAR"
    if km is None:  # evento escolhido no Mapa de Riscos, sem ativo de referência: só a idade conta
        return "ATENÇÃO" if dias <= 3 else "MONITORAR"
    if km <= 50 and dias <= 3:
        return "AGIR"
    if km <= 200 and dias <= 7:
        return "ATENÇÃO"
    return "MONITORAR"


def _quando(dias, observado_em):
    if dias is None:
        return "data da observação desconhecida"
    data = str(observado_em)[:10]
    data = f"{data[8:10]}/{data[5:7]}/{data[:4]}" if len(data) == 10 else data
    rotulo = "hoje" if dias < 1 else f"há {round(dias)} dia(s)" if dias < 60 else f"há {round(dias / 30)} meses" if dias < 730 else f"há {round(dias / 365)} anos"
    return f"{data} ({rotulo})"


def montar_mensagem(p, agora=None):
    """Texto final do WhatsApp. Sem IA aqui: modelo fixo + recomendação da Oracle (que já cita PDF e página)."""
    dias = idade_dias(p.observadoEm, agora)
    nivel = calcular_nivel(p.km, dias)
    distancia = f" · a {round(p.km)} km" if p.km is not None else ""
    evento, local = _texto(p.evento, 300), _texto(p.local, 200)
    rec = _linhas(re.sub(r"\*\*", "", p.recomendacao or ""), 900)
    categoria = f" ({_texto(p.categoria, 60)})" if p.categoria else ""
    if p.publico == "empresa":
        linhas = [
            "🏭 *ALERTA OPERACIONAL · Omni-EcoRescue*",
            f"*Ativo:* {local}",
            f"*Evento:* {evento}{categoria}{distancia}",
            f"*Última observação ({_texto(p.origem, 40)}):* {_quando(dias, p.observadoEm)}",
            f"*Nível:* {nivel} · {NIVEIS[nivel]}",
        ]
        if rec:
            linhas += ["", "📚 *Recomendação (documentos oficiais, IA Oracle):*", rec]
        linhas += ["", "Decisão: responsável de segurança da unidade. Proximidade não confirma risco.",
                   f"📍 Pontos de apoio e rotas: {LINK_APP}"]
    else:
        linhas = [
            f"🚨 *AVISO Omni-EcoRescue* · {local}",
            f"{evento}{categoria}{distancia}. Última observação: {_quando(dias, p.observadoEm)}.",
            "",
            f"*Nível: {nivel}* · {NIVEIS[nivel]}",
        ]
        if rec:
            linhas += ["", "📚 *O que dizem os documentos oficiais:*", _linhas(rec, 450)]
        linhas += ["", f"📍 Abrigo e hospital mais perto de você, com rota: {LINK_APP}", "☎️ Em perigo: 199 · 193 · 192"]
    return "\n".join(linhas), nivel


def enviar(pedido, postar=None):
    """Valida o código e o destino e chama o n8n. Devolve (status_http, corpo)."""
    esperado, url = os.getenv("OPERADOR_CODIGO", ""), os.getenv("N8N_ALERTA_URL", "")
    if len(esperado) < 6 or not url.startswith(("https://", "http://")):
        return 503, {"error": {"code": "not_configured", "message": "Envio por WhatsApp não configurado neste servidor."}}
    if not hmac.compare_digest(pedido.codigo.strip(), esperado):
        return 403, {"error": {"code": "forbidden", "message": "Código do operador incorreto."}}
    try:
        telefone = formatar_destino(pedido.destino)
    except Invalido as e:
        return 422, {"error": {"code": "invalid_request", "message": str(e)}}
    mensagem, nivel = montar_mensagem(pedido)
    corpo = {"telefone": telefone, "mensagem": mensagem, "nivel": nivel, "publico": "empresa" if pedido.publico == "empresa" else "comunidade",
             # campos antigos, como o Streamlit mandava (o fluxo do n8n pode ignorar)
             "local": _texto(pedido.local, 200), "evento": _texto(pedido.evento, 400),
             "recomendacao_ia": _texto(pedido.recomendacao, 2000), "origem": _texto(pedido.origem, 40)}
    cabecalhos = {"X-Omni-Token": os.getenv("CADASTROS_TOKEN", "")}
    try:
        resposta = (postar or httpx.post)(url, json=corpo, headers=cabecalhos, timeout=20)
        if 200 <= resposta.status_code < 300:
            return 200, {"ok": True, "nivel": nivel, "previa": mensagem, "mensagem": f"Alerta enviado (nível {nivel}). Confira o WhatsApp."}
        return 502, {"error": {"code": "n8n_error", "message": f"O n8n respondeu {resposta.status_code}: o alerta NÃO foi enviado."}}
    except Exception as erro:
        log.warning("n8n indisponível: %s", type(erro).__name__)
        return 502, {"error": {"code": "n8n_unavailable", "message": "Não foi possível chamar o n8n. Verifique se o fluxo está ativo."}}


@router.post("/whatsapp")
async def alerta_whatsapp(body: Pedido, request: Request):
    ip = request.client.host if request.client else "?"
    if not _limitador.permitir(ip):
        return JSONResponse(status_code=429, headers=_NO_STORE, content={"error": {"code": "rate_limited", "message": "Muitos envios seguidos. Aguarde e tente de novo."}})
    status, corpo = await run_in_threadpool(enviar, body)
    return JSONResponse(status_code=status, headers=_NO_STORE, content=corpo)
