"""Extraction of painel_ceo.buscar_nasa/ponto_evento, without UI imports.

Same open-event categories, last geometry and first polygon vertex convention.
Coordinates are catalog locations, never a computed risk or safe route.
"""
import asyncio
import math
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable

import httpx

from .models import Category, Coordinates, Event, EventsResponse, IntegrationError

NASA_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"
NASA_QUERY = {"status": "open", "category": "wildfires,severeStorms,earthquakes,floods"}


@dataclass(frozen=True)
class Settings:
    timeout_seconds: float = 10
    cache_seconds: float = 600
    max_stale_seconds: float = 3600
    retry_seconds: float = 30
    observation_max_age_seconds: float = 86400
    enabled: bool = True

    def __post_init__(self):
        values = (self.timeout_seconds, self.cache_seconds, self.max_stale_seconds,
                  self.retry_seconds, self.observation_max_age_seconds)
        if any(not math.isfinite(v) or v <= 0 for v in values):
            raise ValueError("NASA configuration durations must be positive and finite")
        if self.max_stale_seconds < self.cache_seconds:
            raise ValueError("NASA max stale age must be >= cache TTL")


def normalize_events(payload: object, now: datetime, observation_age: float) -> list[Event]:
    if not isinstance(payload, dict) or not isinstance(payload.get("events"), list):
        raise ValueError("Invalid EONET envelope")
    result = []
    for raw in payload["events"]:
        if not isinstance(raw, dict) or not isinstance(raw.get("id"), str) or not raw["id"].strip() or not isinstance(raw.get("title"), str) or not raw["title"].strip():
            raise ValueError("Invalid EONET event identity")
        categories = []
        for category in raw.get("categories", []) if isinstance(raw.get("categories"), list) else []:
            if isinstance(category, dict) and isinstance(category.get("id"), (str, int)) and isinstance(category.get("title"), str):
                categories.append(Category(id=str(category["id"]), title=category["title"]))
        geometries = raw.get("geometry")
        geometry = geometries[-1] if isinstance(geometries, list) and geometries and isinstance(geometries[-1], dict) else {}
        geometry_type = geometry.get("type") if isinstance(geometry.get("type"), str) else None
        coords = geometry.get("coordinates")
        point = None
        coordinate_state = "missing"
        if coords is not None:
            if geometry_type not in ("Point", "Polygon"):
                coordinate_state = "unsupported"
            else:
                try:
                    if geometry_type == "Polygon":
                        coords = coords[0][0]
                    if not isinstance(coords, list) or len(coords) < 2 or any(isinstance(v, bool) or not isinstance(v, (float, int)) for v in coords[:2]):
                        raise ValueError("Invalid coordinate pair")
                    lon, lat = float(coords[0]), float(coords[1])
                    if not (math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90):
                        raise ValueError("Coordinate out of bounds")
                    point = Coordinates(latitude=lat, longitude=lon, method="point" if geometry_type == "Point" else "first_polygon_vertex")
                    coordinate_state = "available"
                except (TypeError, ValueError, IndexError, KeyError):
                    coordinate_state = "invalid"
        observed = None
        try:
            date = geometry.get("date")
            observed = datetime.fromisoformat(date.replace("Z", "+00:00"))
            if observed.tzinfo is None or observed > now:
                observed = None
        except (ValueError, AttributeError, TypeError):
            pass
        result.append(Event(id=raw["id"], title=raw["title"], categories=categories,
                            coordinates=point, coordinateState=coordinate_state, geometryType=geometry_type,
                            observedAt=observed, observationState="unknown" if observed is None else
                            "outdated" if (now - observed).total_seconds() > observation_age else "recent"))
    return result


class NasaService:
    def __init__(self, client: httpx.AsyncClient, settings: Settings = Settings(),
                 monotonic: Callable[[], float] = time.monotonic,
                 utcnow: Callable[[], datetime] = lambda: datetime.now(timezone.utc)):
        self.client, self.settings = client, settings
        self.monotonic, self.utcnow = monotonic, utcnow
        self.lock = asyncio.Lock()
        self.events: list[Event] | None = None
        self.fetched_at: datetime | None = None
        self.fetched_tick = 0.0
        self.failed_tick: float | None = None
        self.failure: IntegrationError | None = None
        self.failure_state = "unavailable"

    def snapshot(self) -> EventsResponse:
        """Local status only; does not contact NASA."""
        now = self.utcnow()
        age = max(0, self.monotonic() - self.fetched_tick) if self.events is not None else None
        usable = age is not None and age <= self.settings.max_stale_seconds
        fresh = usable and age < self.settings.cache_seconds and self.failure is None
        events = [event.model_copy(update={"observationState": "unknown" if event.observedAt is None else "outdated" if (now - event.observedAt).total_seconds() > self.settings.observation_max_age_seconds else "recent"}) for event in self.events] if usable else []
        state = ("success" if events else "empty") if fresh else "stale" if usable else self.failure_state if self.failure else "unavailable"
        quality = "partial" if any(e.coordinateState != "available" or e.observationState != "recent" or not e.categories for e in events) else "complete"
        return EventsResponse(state=state, query=dict(NASA_QUERY), queriedAt=now, fetchedAt=self.fetched_at,
                              ageSeconds=age, cache="fresh" if fresh else "stale" if usable else "none",
                              dataQuality=quality if usable else "unavailable", events=events, error=self.failure)

    async def get_events(self) -> EventsResponse:
        async with self.lock:
            current = self.snapshot()
            if current.cache == "fresh":
                return current
            if not self.settings.enabled:
                self.failure = IntegrationError(code="disabled", message="Consulta NASA desabilitada no servidor.")
                return self.snapshot()
            if self.failed_tick is not None and self.monotonic() - self.failed_tick < self.settings.retry_seconds:
                return current
            try:
                async with asyncio.timeout(self.settings.timeout_seconds):
                    response = await self.client.get(NASA_URL, params=NASA_QUERY, timeout=self.settings.timeout_seconds)
                response.raise_for_status()
                fetched_at = self.utcnow()
                events = normalize_events(response.json(), fetched_at, self.settings.observation_max_age_seconds)
            except (httpx.TimeoutException, TimeoutError):
                self._fail("timeout", "A NASA não respondeu dentro do prazo.", "unavailable")
            except httpx.HTTPStatusError:
                self._fail("upstream_http", "A NASA retornou um erro HTTP.", "error")
            except httpx.RequestError:
                self._fail("network", "Não foi possível consultar a NASA.", "unavailable")
            except ValueError:
                self._fail("invalid_response", "A resposta NASA não corresponde ao contrato esperado.", "error")
            else:
                self.events, self.fetched_at, self.fetched_tick = events, fetched_at, self.monotonic()
                self.failure, self.failed_tick = None, None
                return self.snapshot().model_copy(update={"cache": "miss"})
            return self.snapshot()

    def _fail(self, code: str, message: str, state: str):
        self.failure = IntegrationError(code=code, message=message)
        self.failure_state, self.failed_tick = state, self.monotonic()
