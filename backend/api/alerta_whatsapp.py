"""Envio REAL de alerta por WhatsApp a partir das telas Visão Corporativa e Impacto Social (como no painel Streamlit).

O site é público, então o envio exige o código do operador (OPERADOR_CODIGO, só no servidor, em ia.env).
A API repassa ao fluxo do n8n que já existe (N8N_ALERTA_URL → webhook "alerta-omni"), com os mesmos campos
que o Streamlit mandava: local, evento, recomendacao_ia, origem, telefone. O n8n formata e envia pelo WAHA.
"""
import hmac
import logging
import os
import re
import threading
import time
from collections import deque

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
    corpo = {"local": _texto(pedido.local, 200), "evento": _texto(pedido.evento, 400),
             "recomendacao_ia": _texto(pedido.recomendacao, 2000), "origem": _texto(pedido.origem, 40), "telefone": telefone}
    try:
        resposta = (postar or httpx.post)(url, json=corpo, timeout=20)
        if 200 <= resposta.status_code < 300:
            return 200, {"ok": True, "mensagem": "Alerta enviado ao n8n. Confira o WhatsApp."}
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
