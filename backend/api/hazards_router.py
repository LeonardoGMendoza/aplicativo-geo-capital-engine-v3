"""Rotas. Para ativar, em backend/api/main.py acrescente:
    from .hazards_router import router as hazards_router
    app.include_router(hazards_router)
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from . import hazards

router = APIRouter(prefix="/api/v1", tags=["hazards"])
_NO_STORE = {"Cache-Control": "no-store"}


def _error(status, state, code, message):
    return JSONResponse(status_code=status, headers=_NO_STORE, content={
        "state": state, "isSimulation": False, "riskCalculated": False,
        "error": {"code": code, "message": message}})


def _run(fn):
    try:
        return JSONResponse(content=fn(), headers=_NO_STORE)
    except hazards.SourceUnavailable:
        return _error(503, "unavailable", "unavailable", "Fonte de dados indisponível no momento.")
    except hazards.InvalidResponse:
        return _error(502, "error", "invalid_response", "A fonte respondeu num formato inesperado.")
    except Exception:  # nunca vaza detalhes internos
        return _error(502, "error", "internal", "Falha ao consultar a fonte.")


@router.get("/earthquakes")
def earthquakes():
    return _run(hazards.get_earthquakes)


@router.get("/tsunami-signals")
def tsunami_signals():
    return _run(hazards.get_tsunami_signals)


@router.get("/tectonic-plates")
def tectonic_plates():
    return _run(hazards.get_tectonic_plates)


@router.get("/tornado-alerts")
def tornado_alerts():
    return _run(hazards.get_tornado_alerts)


@router.get("/enso")
def enso():
    return _run(hazards.get_enso)


@router.get("/brazil-heat")
def brazil_heat():
    return _run(hazards.get_brazil_heat)
