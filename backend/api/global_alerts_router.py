"""Rota dos alertas mundiais (GDACS). Ativada em backend/api/main.py com app.include_router(global_alerts_router)."""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .global_alerts import FonteIndisponivel

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])
_NO_STORE = {"Cache-Control": "no-store"}


@router.get("/global")
def global_alerts(request: Request):
    try:
        return JSONResponse(content=request.app.state.alertas.obter(), headers=_NO_STORE)
    except FonteIndisponivel:
        return JSONResponse(status_code=503, headers=_NO_STORE, content={
            "estado": "indisponivel", "alertas": [],
            "error": {"code": "unavailable", "message": "Alertas mundiais (GDACS) indisponíveis agora. Tente de novo em instantes."}})
    except Exception:  # nunca vaza detalhes internos
        return JSONResponse(status_code=502, headers=_NO_STORE, content={
            "estado": "erro", "alertas": [], "error": {"code": "internal", "message": "Falha ao consultar os alertas mundiais."}})
