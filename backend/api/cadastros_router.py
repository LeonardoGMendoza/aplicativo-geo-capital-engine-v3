"""Rotas do cadastro do cidadão (QR code → alertas no WhatsApp). Ativadas em main.py."""
import logging
import os

import httpx
from fastapi import APIRouter, BackgroundTasks, Header, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .cadastros import Invalido, LimiteExcedido

router = APIRouter(prefix="/api/v1/cadastros", tags=["cadastros"])
log = logging.getLogger("uvicorn.error")


def avisar_n8n(celular, cep, nome):
    """Boas-vindas no WhatsApp: chama o webhook do n8n (CADASTRO_WEBHOOK_URL), protegido pelo CADASTROS_TOKEN.
    Sem as duas variáveis no servidor, não faz nada. Falha aqui nunca derruba o cadastro."""
    url, token = os.getenv("CADASTRO_WEBHOOK_URL", ""), os.getenv("CADASTROS_TOKEN", "")
    if not url.startswith(("https://", "http://")) or len(token) < 24:
        return
    try:
        httpx.post(url, json={"celular": celular, "cep": cep, "nome": nome}, headers={"X-Omni-Token": token}, timeout=8)
    except Exception as erro:
        log.warning("Boas-vindas do cadastro não enviada: %s", type(erro).__name__)
_NO_STORE = {"Cache-Control": "no-store"}


class Cadastro(BaseModel):
    celular: str = Field(max_length=30)
    cep: str = Field(max_length=12)
    nome: str | None = Field(default=None, max_length=80)
    aceite: bool = False
    origem: str = Field(default="site", max_length=10)


class Saida(BaseModel):
    celular: str = Field(max_length=30)
    cep: str = Field(max_length=12)


def _erro(status, codigo, mensagem):
    return JSONResponse(status_code=status, headers=_NO_STORE, content={"error": {"code": codigo, "message": mensagem}})


async def _rodar(funcao, *args, **kwargs):
    try:
        return JSONResponse(content=await run_in_threadpool(funcao, *args, **kwargs), headers=_NO_STORE)
    except Invalido as e:
        return _erro(422, "invalid_request", str(e))
    except LimiteExcedido:
        return _erro(429, "rate_limited", "Muitas tentativas. Tente de novo mais tarde.")
    except PermissionError:
        return _erro(404, "not_found", "Não encontrado.")
    except Exception:  # nunca vaza detalhes internos
        return _erro(503, "unavailable", "Cadastro indisponível agora. Tente de novo em instantes.")


def _ip(request: Request):
    return request.client.host if request.client else "?"


@router.post("")
async def cadastrar(body: Cadastro, request: Request, tarefas: BackgroundTasks):
    c = request.app.state.cadastros
    resposta = await _rodar(c.cadastrar, body.celular, body.cep, body.aceite, nome=body.nome, origem=body.origem, ip=_ip(request))
    if resposta.status_code == 200:  # só depois de gravado; a mensagem sai em segundo plano
        from .cadastros import limpar_nome, normalizar_celular, normalizar_cep
        resposta.background = tarefas
        tarefas.add_task(avisar_n8n, normalizar_celular(body.celular), normalizar_cep(body.cep), limpar_nome(body.nome))
    return resposta


@router.post("/sair")
async def sair(body: Saida, request: Request):
    return await _rodar(request.app.state.cadastros.sair, body.celular, body.cep, ip=_ip(request))


@router.get("/resumo")
async def resumo(request: Request):
    return await _rodar(request.app.state.cadastros.resumo)


@router.get("/lista")
async def lista(request: Request, x_cadastros_token: str | None = Header(default=None)):
    """Para o n8n: lista completa, só com o cabeçalho X-Cadastros-Token igual ao CADASTROS_TOKEN do servidor."""
    return await _rodar(lambda: {"cadastros": request.app.state.cadastros.lista(x_cadastros_token)})
