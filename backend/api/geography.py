"""Pure extraction of painel_ceo Haversine and strict nearest-per-asset rule."""
import math

EARTH_RADIUS_KM = 6371
PANEL_RADIUS_KM = 600
OMNI_ENGINE_RADIUS_KM = 500  # first match in omni_engine_alertas, NOT panel rule


def valid_coordinates(lat, lon):
    return all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
               for v in (lat, lon)) and -90 <= lat <= 90 and -180 <= lon <= 180


def haversine_km(lat1, lon1, lat2, lon2):
    if not valid_coordinates(lat1, lon1) or not valid_coordinates(lat2, lon2):
        raise ValueError("Invalid coordinates")
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    # Clamp floating point roundoff at antipodes, preserving the legacy formula.
    a = min(1.0, max(0.0, a))
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def within_threshold(distance, radius):
    return distance < radius
