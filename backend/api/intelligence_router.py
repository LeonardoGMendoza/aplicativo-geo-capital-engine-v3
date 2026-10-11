"""Rotas da Inteligência (IA). Ativadas em backend/api/main.py com app.include_router(intelligence_router)."""
from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .intelligence import LimiteExcedido, NaoConfigurado, Preparando

router = APIRouter(prefix="/api/v1/intelligence", tags=["intelligence"])
_NO_STORE = {"Cache-Control": "no-store"}


class Pergunta(BaseModel):
    pergunta: str = Field(min_length=3, max_length=300)
    perfil: str = Field(default="defesa_civil", max_length=20)


def _erro(status, codigo, mensagem, extra=None):
    return JSONResponse(status_code=status, headers=_NO_STORE,
                        content={"error": {"code": codigo, "message": mensagem}, **(extra or {})})


@router.get("/status")
def status(request: Request):
    ia = request.app.state.inteligencia
    ia.iniciar()
    return JSONResponse(content=ia.status(), headers=_NO_STORE)


@router.post("/ask")
async def ask(body: Pergunta, request: Request):
    ia = request.app.state.inteligencia
    ip = request.client.host if request.client else "?"
    try:
        resultado = await run_in_threadpool(ia.perguntar, body.pergunta, body.perfil, ip)
        return JSONResponse(content=resultado, headers=_NO_STORE)
    except ValueError:
        return _erro(422, "invalid_request", "Pergunta inválida: use de 3 a 300 caracteres.")
    except NaoConfigurado:
        return _erro(503, "not_configured", "A IA não está configurada neste servidor.")
    except Preparando:
        s = ia.status()
        return _erro(503, "preparing", f"Preparando a base de documentos ({s['prontos']} de {s['trechos']} trechos). Tente em 1 minuto.", {"status": s})
    except LimiteExcedido:
        return _erro(429, "rate_limited", "Muitas perguntas seguidas. Aguarde 1 minuto.")
    except Exception:  # nunca vaza detalhes internos
        return _erro(502, "internal", "Não foi possível consultar a IA agora. Tente de novo.")
