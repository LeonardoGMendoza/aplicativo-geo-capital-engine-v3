"""Rota dos alertas mundiais (GDACS). Ativada em backend/api/main.py com app.include_router(global_alerts_router)."""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .global_alerts import FonteIndisponivel
from .gdacs_detalhes import DetalhesGdacs
from .gdacs_detalhes import FonteIndisponivel as DetalhesIndisponiveis

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


_detalhes = DetalhesGdacs()


@router.get("/global/details")
def global_alert_details(tipo: str, eventid: str, episodeid: str = ""):
    """Detalhes de um alerta do GDACS para mostrar dentro do Omni (mapa, nível, população exposta)."""
    try:
        return JSONResponse(content=_detalhes.obter(tipo, eventid, episodeid), headers=_NO_STORE)
    except ValueError:
        return JSONResponse(status_code=400, headers=_NO_STORE, content={
            "estado": "erro", "error": {"code": "invalid", "message": "Alerta inválido."}})
    except DetalhesIndisponiveis:
        return JSONResponse(status_code=503, headers=_NO_STORE, content={
            "estado": "indisponivel", "error": {"code": "unavailable", "message": "Detalhes do GDACS indisponíveis agora."}})
    except Exception:  # nunca vaza detalhes internos
        return JSONResponse(status_code=502, headers=_NO_STORE, content={
            "estado": "erro", "error": {"code": "internal", "message": "Falha ao consultar os detalhes do alerta."}})
