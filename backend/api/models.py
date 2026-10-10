from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class Category(BaseModel):
    id: str
    title: str


class Coordinates(BaseModel):
    latitude: float
    longitude: float
    method: Literal["point", "first_polygon_vertex"]


class Event(BaseModel):
    id: str
    title: str
    categories: list[Category]
    coordinates: Coordinates | None
    geometryType: str | None
    coordinateState: Literal["available", "missing", "invalid", "unsupported"]
    observedAt: datetime | None
    observationState: Literal["recent", "outdated", "unknown"]
    source: Literal["NASA EONET"] = "NASA EONET"
    isSimulation: Literal[False] = False


class IntegrationError(BaseModel):
    code: str
    message: str


class EventsResponse(BaseModel):
    state: Literal["success", "empty", "stale", "unavailable", "error"]
    source: Literal["NASA EONET"] = "NASA EONET"
    sourceUrl: str = "https://eonet.gsfc.nasa.gov/api/v3/events"
    query: dict[str, str]
    queriedAt: datetime
    fetchedAt: datetime | None = None
    ageSeconds: float | None = None
    cache: Literal["miss", "fresh", "stale", "none"] = "none"
    dataQuality: Literal["complete", "partial", "unavailable"]
    events: list[Event]
    error: IntegrationError | None = None
    isSimulation: Literal[False] = False
    riskCalculated: Literal[False] = False
