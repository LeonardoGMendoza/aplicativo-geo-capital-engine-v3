"""Rotas de locais proximos (OpenStreetMap). Ativadas em backend/api/main.py com app.include_router(places_router)."""
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from . import places
from .hazards import InvalidResponse, SourceUnavailable

router = APIRouter(prefix="/api/v1/places", tags=["places"])
_NO_STORE = {"Cache-Control": "no-store"}


def _error(status, state, code, message):
    return JSONResponse(status_code=status, headers=_NO_STORE, content={
        "state": state, "isSimulation": False, "riskCalculated": False,
        "error": {"code": code, "message": message}})


def _run(fn, *args):
    try:
        return JSONResponse(content=fn(*args), headers=_NO_STORE)
    except ValueError:
        return _error(422, "error", "invalid_request", "Parâmetros inválidos.")
    except SourceUnavailable:
        return _error(503, "unavailable", "unavailable", "OpenStreetMap indisponível no momento. Tente de novo em instantes.")
    except InvalidResponse:
        return _error(502, "error", "invalid_response", "A fonte respondeu num formato inesperado.")
    except Exception:  # nunca vaza detalhes internos
        return _error(502, "error", "internal", "Falha ao consultar a fonte.")


@router.get("/nearby")
def nearby(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    return _run(places.get_nearby, lat, lon)


@router.get("/geocode")
def geocode(q: str = Query(..., min_length=2, max_length=120)):
    return _run(places.get_geocode, q)
