"""Rota dos alertas mundiais (GDACS). Ativada em backend/api/main.py com app.include_router(global_alerts_router)."""
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
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


@router.get("/oficiais")
def alertas_oficiais(request: Request):
    """Alertas oficiais do mundo (INMET, NWS, MeteoAlarm, tsunami, USGS) + previsão das cidades da família."""
    try:
        return JSONResponse(content=request.app.state.oficiais.obter(), headers=_NO_STORE)
    except Exception:  # nunca vaza detalhes internos
        return JSONResponse(status_code=502, headers=_NO_STORE, content={
            "alertas": [], "lugares": [], "locaisPadrao": [], "fontes": [], "error": {"code": "internal", "message": "Falha ao consultar os alertas oficiais."}})


class LugarPedido(BaseModel):
    id: str = Field(max_length=40)
    nome: str = Field(max_length=80)
    pais: str | None = Field(default=None, max_length=40)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class PedidoLugares(BaseModel):
    lugares: list[LugarPedido] = Field(default_factory=list, max_length=12)


@router.post("/oficiais/lugares")
def alertas_oficiais_meus_lugares(pedido: PedidoLugares, request: Request):
    """Os mesmos alertas + o resumo dos lugares da pessoa. Os lugares vêm no corpo (não na URL) e não são guardados."""
    try:
        return JSONResponse(content=request.app.state.oficiais.obter([l.model_dump() for l in pedido.lugares]), headers=_NO_STORE)
    except Exception:  # nunca vaza detalhes internos
        return JSONResponse(status_code=502, headers=_NO_STORE, content={
            "alertas": [], "lugares": [], "locaisPadrao": [], "fontes": [], "error": {"code": "internal", "message": "Falha ao consultar os alertas oficiais."}})
