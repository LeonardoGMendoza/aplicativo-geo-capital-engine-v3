import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .hazards_router import router as hazards_router
from .models import EventsResponse
from .nasa import NasaService, Settings
from .proximity import ASSETS, DATASET_VERSION, POLICY, ProximityRequest, analyze_proximity


def settings_from_environment() -> Settings:
    return Settings(timeout_seconds=float(os.getenv("NASA_TIMEOUT_SECONDS", "10")),
                    cache_seconds=float(os.getenv("NASA_CACHE_SECONDS", "600")),
                    max_stale_seconds=float(os.getenv("NASA_MAX_STALE_SECONDS", "3600")),
                    retry_seconds=float(os.getenv("NASA_RETRY_SECONDS", "30")),
                    observation_max_age_seconds=float(os.getenv("NASA_OBSERVATION_MAX_AGE_SECONDS", "86400")),
                    enabled=os.getenv("NASA_EONET_ENABLED", "true").lower() == "true")


def create_app(service: NasaService | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if service is not None:
            app.state.nasa = service
            yield
        else:
            async with httpx.AsyncClient(follow_redirects=False) as client:
                app.state.nasa = NasaService(client, settings_from_environment())
                yield

    app = FastAPI(title="Omni-EcoRescue API", version="0.1.0", lifespan=lifespan)
    origins = [origin.strip() for origin in os.getenv("REACT_CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",") if origin.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                       allow_methods=["GET", "POST"], allow_headers=["Accept", "Content-Type"])

    @app.get("/api/v1/status")
    async def status(request: Request):
        service = request.app.state.nasa
        snapshot = service.snapshot()
        return {"status": "ok", "nasa": {"enabled": service.settings.enabled, "state": snapshot.state,
                "source": snapshot.source, "fetchedAt": snapshot.fetchedAt, "ageSeconds": snapshot.ageSeconds,
                "error": snapshot.error}, "riskCalculated": False}

    @app.get("/api/v1/events", response_model=EventsResponse, responses={502: {"model": EventsResponse}, 503: {"model": EventsResponse}})
    async def events(request: Request):
        result = await request.app.state.nasa.get_events()
        code = 502 if result.state == "error" else 503 if result.state == "unavailable" else 200
        return JSONResponse(status_code=code, content=result.model_dump(mode="json"), headers={"Cache-Control": "no-store"})

    @app.get('/api/v1/assets')
    async def assets():
        return {'assets': ASSETS, 'datasetVersion': DATASET_VERSION, 'policy': POLICY,
                'isReferenceData': True, 'communitiesStatus': 'pending_no_verified_coordinates'}

    @app.post('/api/v1/geography/proximity')
    async def proximity(body: ProximityRequest, request: Request):
        if len(set(body.targetIds)) != len(body.targetIds):
            raise HTTPException(422, 'Duplicate asset identifiers')
        catalog = {a['id']: a for a in ASSETS}
        if any(id not in catalog for id in body.targetIds):
            raise HTTPException(422, 'Unknown asset identifier')
        # Preserve catalog order for distance ties, irrespective of request ordering.
        targets = [a for a in ASSETS if a['id'] in body.targetIds]
        data = await request.app.state.nasa.get_events()
        result = analyze_proximity(data, targets, body.expectedFetchedAt)
        code = 503 if result['state'] == 'unavailable' else 409 if result['state'] == 'blocked' else 200
        return JSONResponse(status_code=code, content=jsonable_encoder(result), headers={'Cache-Control': 'no-store'})

    app.include_router(hazards_router)

    return app


app = create_app()
