"""Rotas da voz do assistente (Modo acessível). Ativadas em main.py."""
from typing import Literal

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from .voz_nuvem import MAX_TEXTO, LimiteExcedido, VozNaoConfigurada, VozNuvem

router = APIRouter(prefix="/api/v1/voz", tags=["voz"])
_voz = VozNuvem()
_NO_STORE = {"Cache-Control": "no-store"}


class PedidoVoz(BaseModel):
    texto: str = Field(min_length=1, max_length=MAX_TEXTO)
    idioma: Literal["pt", "es", "en"] = "pt"
    assistente: Literal["Clara", "Rafael"] = "Clara"


def _quem(request: Request):
    # atrás do nginx: o IP real vem no cabeçalho; só serve para o limite por pessoa
    return (request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or (request.client.host if request.client else "?"))


@router.get("/status")
def status_voz():
    return JSONResponse(content={"nuvem": _voz.configurada}, headers=_NO_STORE)


@router.post("")
def falar(pedido: PedidoVoz, request: Request):
    try:
        audio = _voz.falar(pedido.texto, pedido.idioma, pedido.assistente, _quem(request))
    except VozNaoConfigurada:
        return JSONResponse(status_code=503, headers=_NO_STORE, content={"error": {"code": "sem_chave", "message": "Voz da nuvem não configurada."}})
    except LimiteExcedido:
        return JSONResponse(status_code=429, headers=_NO_STORE, content={"error": {"code": "limite", "message": "Muitos pedidos de voz. Aguarde um pouco."}})
    except ValueError:
        return JSONResponse(status_code=422, headers=_NO_STORE, content={"error": {"code": "invalid", "message": "Texto inválido."}})
    except Exception:  # nunca vaza detalhes internos
        return JSONResponse(status_code=502, headers=_NO_STORE, content={"error": {"code": "internal", "message": "Voz da nuvem indisponível."}})
    return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})
