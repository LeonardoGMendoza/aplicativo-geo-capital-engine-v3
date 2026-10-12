"""Rota das cotações (Yahoo Finance). Ativada em backend/api/main.py com app.include_router(mercado_router)."""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .mercado import MercadoIndisponivel

router = APIRouter(prefix="/api/v1/mercado", tags=["mercado"])
_NO_STORE = {"Cache-Control": "no-store"}


@router.get("")
def mercado(request: Request):
    try:
        return JSONResponse(content=request.app.state.mercado.obter(), headers=_NO_STORE)
    except MercadoIndisponivel:
        return JSONResponse(status_code=503, headers=_NO_STORE, content={
            "empresas": [], "error": {"code": "unavailable", "message": "Cotações (Yahoo Finance) indisponíveis agora. Tente de novo em instantes."}})
    except Exception:  # nunca vaza detalhes internos
        return JSONResponse(status_code=502, headers=_NO_STORE, content={
            "empresas": [], "error": {"code": "internal", "message": "Falha ao consultar as cotações."}})
