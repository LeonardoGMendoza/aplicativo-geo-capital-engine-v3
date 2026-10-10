"""Terremotos, placas tectonicas, sinalizacao de tsunami, tornados (EUA), El Nino e calor no Brasil.
Fontes publicas, sem chave de API. Nao importa FastAPI (testavel offline); as rotas ficam em hazards_router.py.
Segue o contrato da API do MVP: state, source, sourceUrl, queriedAt, fetchedAt, isSimulation=false, riskCalculated=false."""
import re
import threading
import time
from datetime import datetime, timezone

USER_AGENT = "Omni-EcoRescue (projeto academico, Tech4Change)"
TIMEOUT_SECONDS = 10
MAX_STALE_SECONDS = 3600

URL_USGS = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson"
URL_PLATES = "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json"
URL_NWS = "https://api.weather.gov/alerts/active"
URL_ENSO = "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.html"
URL_METEO = "https://api.open-meteo.com/v1/forecast"

TSUNAMI_NOTICE = ("Terremoto em região oceânica. Isto NÃO confirma tsunami. Alertas oficiais: "
                  "tsunami.gov (EUA/Pacífico/Caribe) e a Defesa Civil local.")
QUAKE_NOTICE = "Terremotos de magnitude 4.5 ou mais nos últimos 7 dias. Não é previsão de novos eventos."
TORNADO_NOTICE = "Cobre somente os EUA. Não existe feed mundial de tornados. Avisos sem polígono não aparecem no mapa."


class SourceUnavailable(Exception):
    """Fonte fora do ar, timeout ou rede, sem copia utilizavel."""


class InvalidResponse(Exception):
    """A fonte respondeu, mas num formato inesperado."""


# ---------- download com cache ----------
_cache = {}
_lock = threading.Lock()


def _download(url, params=None, as_text=False):
    import httpx  # import tardio: so a API real precisa dele
    r = httpx.get(url, params=params, headers={"User-Agent": USER_AGENT},
                  timeout=TIMEOUT_SECONDS, follow_redirects=True)
    r.raise_for_status()
    return r.text if as_text else r.json()


def _fetch(url, ttl, params=None, as_text=False):
    """Devolve (dados, fetched_ts, stale). Se a fonte falhar e houver copia com menos de 1h, devolve a copia como stale."""
    key = (url, tuple(sorted((params or {}).items())), as_text)
    now = time.time()
    with _lock:
        hit = _cache.get(key)
    if hit and now - hit[0] < ttl:
        return hit[1], hit[0], False
    try:
        data = _download(url, params, as_text)
    except Exception as exc:
        if hit and now - hit[0] < MAX_STALE_SECONDS:
            return hit[1], hit[0], True
        raise SourceUnavailable(type(exc).__name__) from None
    with _lock:
        _cache[key] = (now, data)
    return data, now, False


def _iso(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _envelope(key, payload, empty, source, source_url, fetched_ts, stale, **extra):
    state = "stale" if stale else ("empty" if empty else "success")
    return {"state": state, "source": source, "sourceUrl": source_url,
            "queriedAt": _iso(time.time()), "fetchedAt": _iso(fetched_ts),
            "isSimulation": False, "riskCalculated": False, key: payload, **extra}


# ---------- terremotos e sinalizacao de tsunami (USGS) ----------
def parse_earthquakes(geo):
    if not isinstance(geo, dict) or not isinstance(geo.get("features"), list):
        raise InvalidResponse("usgs")
    out = []
    for f in geo["features"]:
        try:
            p = f["properties"]
            lon, lat, depth = f["geometry"]["coordinates"][:3]
            if p.get("mag") is None:
                continue
            out.append({
                "id": f.get("id"), "magnitude": p["mag"], "place": p.get("place"),
                "observedAt": datetime.fromtimestamp(p["time"] / 1000, tz=timezone.utc).isoformat(),
                "depthKm": depth, "coordinates": {"latitude": lat, "longitude": lon},
                "url": p.get("url"),
                # tsunami==1 no USGS: evento em regiao oceanica notificado aos centros de alerta.
                # NAO significa que existe um tsunami.
                "tsunamiSignal": p.get("tsunami") == 1,
            })
        except (KeyError, TypeError, ValueError, IndexError):
            continue
    return out


def get_earthquakes():
    geo, ts, stale = _fetch(URL_USGS, 300)
    items = parse_earthquakes(geo)
    return _envelope("items", items, not items, "USGS", URL_USGS, ts, stale, notice=QUAKE_NOTICE)


def get_tsunami_signals():
    geo, ts, stale = _fetch(URL_USGS, 300)
    items = [e for e in parse_earthquakes(geo) if e["tsunamiSignal"]]
    return _envelope("items", items, not items, "USGS", URL_USGS, ts, stale, notice=TSUNAMI_NOTICE)


# ---------- placas tectonicas (PB2002) ----------
def get_tectonic_plates():
    geo, ts, stale = _fetch(URL_PLATES, 86400)
    if not isinstance(geo, dict) or not isinstance(geo.get("features"), list):
        raise InvalidResponse("plates")
    return _envelope("geojson", geo, not geo["features"], "PB2002 (Bird, 2003)", URL_PLATES, ts, stale)


# ---------- tornados nos EUA (NWS) ----------
TORNADO_LABELS = {"Tornado Warning": "AVISO de tornado (detectado ou iminente)",
                  "Tornado Watch": "VIGILÂNCIA de tornado (condições favoráveis)"}


def parse_nws_alerts(geo):
    if not isinstance(geo, dict) or not isinstance(geo.get("features"), list):
        raise InvalidResponse("nws")
    out = []
    for f in geo["features"]:
        p = f.get("properties") or {}
        out.append({"id": p.get("id") or f.get("id"), "type": p.get("event"),
                    "label": TORNADO_LABELS.get(p.get("event"), p.get("event")),
                    "headline": p.get("headline"), "area": p.get("areaDesc"),
                    "effectiveAt": p.get("effective"), "expiresAt": p.get("expires"),
                    "sender": p.get("senderName"), "geometry": f.get("geometry")})
    return out


def get_tornado_alerts():
    items, oldest, any_stale = [], time.time(), False
    for event in ("Tornado Warning", "Tornado Watch"):
        geo, ts, stale = _fetch(URL_NWS, 60, params={"event": event})
        items += parse_nws_alerts(geo)
        oldest, any_stale = min(oldest, ts), any_stale or stale
    return _envelope("items", items, not items, "NWS/NOAA (apenas EUA)", URL_NWS, oldest, any_stale,
                     notice=TORNADO_NOTICE)


# ---------- El Nino (NOAA CPC) ----------
STATUS_PT = {
    "El Niño Advisory": "Alerta de El Niño (El Niño em curso)",
    "El Niño Watch": "Vigilância de El Niño (condições favoráveis ao desenvolvimento)",
    "La Niña Advisory": "Alerta de La Niña (La Niña em curso)",
    "La Niña Watch": "Vigilância de La Niña (condições favoráveis ao desenvolvimento)",
    "Not Active": "Sem El Niño nem La Niña ativos",
}
BRAZIL_TENDENCIES = [
    {"region": "Norte e Nordeste", "tendency": "tende a ter mais calor e menos chuva (maior risco de seca e queimadas)"},
    {"region": "Sul", "tendency": "tende a ter mais chuva (maior risco de enchentes e alagamentos)"},
    {"region": "Sudeste e Centro-Oeste", "tendency": "efeito menos consistente; varia de evento para evento"},
]
ENSO_NOTICE = ("Tendências típicas do fenômeno, não previsão para um dia ou local. "
               "Para previsão oficial, consulte INMET e CPTEC/INPE. Texto da sinopse no original da NOAA (inglês).")
_MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"


def parse_enso(html):
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or ""))
    m = re.search(r"ENSO Alert System Status:\s*(.+?)\s+Synopsis:\s*(.+?\.)(?:\s|$)", text)
    if not m:
        raise InvalidResponse("enso")
    status = m.group(1).strip()
    dates = re.findall(r"\d{1,2} (?:%s) \d{4}" % _MONTHS, text[:m.start()])
    return {"statusOriginal": status, "statusPt": STATUS_PT.get(status, status),
            "synopsisOriginal": m.group(2).strip(), "publishedOn": dates[-1] if dates else None,
            "brazilTendencies": BRAZIL_TENDENCIES}


def get_enso():
    html, ts, stale = _fetch(URL_ENSO, 3600, as_text=True)
    item = parse_enso(html)
    return _envelope("item", item, False, "NOAA Climate Prediction Center", URL_ENSO, ts, stale, notice=ENSO_NOTICE)


# ---------- calor e chuva no Brasil (Open-Meteo) ----------
BRAZIL_CITIES = [("Manaus", -3.12, -60.02, "Norte"), ("Belém", -1.46, -48.50, "Norte"),
                 ("Fortaleza", -3.73, -38.52, "Nordeste"), ("Recife", -8.05, -34.88, "Nordeste"),
                 ("Salvador", -12.97, -38.50, "Nordeste"), ("Brasília", -15.79, -47.88, "Centro-Oeste"),
                 ("Cuiabá", -15.60, -56.10, "Centro-Oeste"), ("São Paulo", -23.55, -46.63, "Sudeste"),
                 ("Rio de Janeiro", -22.91, -43.17, "Sudeste"), ("Curitiba", -25.43, -49.27, "Sul"),
                 ("Porto Alegre", -30.03, -51.23, "Sul")]


def parse_brazil_heat(resp):
    if isinstance(resp, dict) and "daily" in resp:
        resp = [resp]
    if not isinstance(resp, list) or len(resp) != len(BRAZIL_CITIES):
        raise InvalidResponse("open-meteo")
    out = []
    for (name, lat, lon, region), d in zip(BRAZIL_CITIES, resp):
        daily = d.get("daily", {}) if isinstance(d, dict) else {}
        tmax = [t for t in daily.get("temperature_2m_max", []) if t is not None]
        rain = [r for r in daily.get("precipitation_sum", []) if r is not None]
        out.append({"city": name, "region": region,
                    "coordinates": {"latitude": lat, "longitude": lon},
                    "maxTemperatureC7d": max(tmax) if tmax else None,
                    "rainMm7d": round(sum(rain), 1) if rain else None})
    return out


def get_brazil_heat():
    params = {"latitude": ",".join(str(c[1]) for c in BRAZIL_CITIES),
              "longitude": ",".join(str(c[2]) for c in BRAZIL_CITIES),
              "daily": "temperature_2m_max,precipitation_sum",
              "timezone": "America/Sao_Paulo", "forecast_days": "7"}
    resp, ts, stale = _fetch(URL_METEO, 1800, params=params)
    items = parse_brazil_heat(resp)
    return _envelope("items", items, not items, "Open-Meteo (previsão de 7 dias)", URL_METEO, ts, stale,
                     notice="Previsão de temperatura máxima e chuva acumulada nos próximos 7 dias, não medição.")
