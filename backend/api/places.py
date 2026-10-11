"""Locais reais proximos (OpenStreetMap) e busca de cidade/endereco (Nominatim).
Porta para a API a logica do mapa de abrigos do painel Streamlit (frontend/mapa_interativo.py).
Fontes publicas, sem chave de API. Nao importa FastAPI (testavel offline); as rotas ficam em places_router.py.
Segue o contrato da API do MVP: state, source, sourceUrl, queriedAt, fetchedAt, isSimulation=false, riskCalculated=false."""
import logging
import math
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from .hazards import InvalidResponse, SourceUnavailable

log = logging.getLogger("uvicorn.error")

USER_AGENT = "Omni-EcoRescue (projeto academico, Tech4Change)"
OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
URL_NOMINATIM = "https://nominatim.openstreetmap.org/search"
OVERPASS_SERVER_TIMEOUT = 25  # limite pedido ao servidor Overpass
OVERPASS_TIMEOUT = 35         # espera do cliente: maior que o do servidor, para receber o erro dele
NOMINATIM_TIMEOUT = 10
NEARBY_TTL = 900            # 15 min
GEOCODE_TTL = 86400         # 1 dia
MAX_STALE_SECONDS = 3600
RADIUS_STEPS_M = (3000, 15000)   # amplia o raio quando a area tem poucos locais (zona rural)
MIN_RESULTS = 10
MAX_PER_CATEGORY = 40

CATEGORIES = {
    "shelter": "Abrigo / ponto de encontro",
    "hospital": "Hospital",
    "clinic": "UBS / UPA / clínica",
    "police": "Delegacia / polícia",
    "ngo": "ONG / apoio social",
    "food": "Alimento",
    "pharmacy": "Farmácia",
    "lodging": "Hospedagem",
    "shop": "Mercado",
}
NEARBY_NOTICE = ("Locais mapeados por voluntários no OpenStreetMap. Podem estar desatualizados, fechados ou "
                 "classificados de forma errada. Não confirma funcionamento, vagas, acesso ou segurança do trajeto.")
POSSIBLE_SHELTER_NOTE = "Possível ponto de apoio (escola, centro comunitário ou prefeitura): confirmar com a Defesa Civil."
MAPPED_SHELTER_NOTE = "Marcado no OpenStreetMap como ponto de encontro ou abrigo."


# ---------- cache e download ----------
_cache = {}
_lock = threading.Lock()
_nominatim_lock = threading.Lock()
_last_nominatim = [0.0]


def _now():
    return time.time()


def _iso(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def _post_overpass(server, query):
    import httpx  # import tardio: so a API real precisa dele
    r = httpx.post(server, data={"data": query}, headers={"User-Agent": USER_AGENT},
                   timeout=OVERPASS_TIMEOUT)
    r.raise_for_status()
    return r.json()


def _get_nominatim(params):
    import httpx
    # politica do Nominatim: no maximo 1 requisicao por segundo e User-Agent identificado
    with _nominatim_lock:
        wait = 1.0 - (_now() - _last_nominatim[0])
        if wait > 0:
            time.sleep(wait)
        _last_nominatim[0] = _now()
    r = httpx.get(URL_NOMINATIM, params=params, headers={"User-Agent": USER_AGENT},
                  timeout=NOMINATIM_TIMEOUT, follow_redirects=True)
    r.raise_for_status()
    return r.json()


def _cached(key, ttl, loader):
    """Devolve (dados, fetched_ts, stale). Se a fonte falhar e houver copia com menos de 1h, devolve a copia como stale."""
    now = _now()
    with _lock:
        hit = _cache.get(key)
    if hit and now - hit[0] < ttl:
        return hit[1], hit[0], False
    try:
        data = loader()
    except InvalidResponse:
        raise
    except Exception as exc:
        if hit and now - hit[0] < ttl + MAX_STALE_SECONDS:
            return hit[1], hit[0], True
        raise SourceUnavailable(type(exc).__name__) from None
    with _lock:
        _cache[key] = (now, data)
    return data, now, False


# ---------- Overpass ----------
def build_query(lat, lon, radius_m):
    """Consulta so por etiquetas (tags), que o Overpass resolve por indice.
    Nao procura texto no nome de todos os objetos da area (como o painel Streamlit fazia):
    isso estourava o tempo em cidades densas. O nome continua sendo usado na classificacao."""
    around = f"(around:{int(radius_m)},{lat},{lon})"
    parts = [
        f'nwr["amenity"~"^(hospital|clinic|doctors|health_post|police|social_facility|pharmacy|marketplace|food_bank|community_centre|townhall|school)$"]{around};',
        f'nwr["healthcare"~"^(hospital|clinic|centre|doctor)$"]{around};',
        f'nwr["shop"~"^(supermarket|convenience)$"]{around};',
        f'nwr["tourism"~"^(hotel|hostel|guest_house)$"]{around};',
        f'nwr["emergency"="assembly_point"]{around};',
        f'nwr["social_facility"="shelter"]{around};',
    ]
    return f"[out:json][timeout:{OVERPASS_SERVER_TIMEOUT}];(" + "".join(parts) + ");out center 1000;"


def _race_overpass(query):
    """Consulta os servidores ao mesmo tempo e usa o primeiro que responder com JSON valido."""
    errors = []
    pool = ThreadPoolExecutor(max_workers=len(OVERPASS_SERVERS))
    try:
        futures = {pool.submit(_post_overpass, s, query): s for s in OVERPASS_SERVERS}
        for fut in as_completed(futures):
            try:
                data = fut.result()
            except Exception as exc:  # noqa: BLE001 - tenta o proximo servidor
                errors.append(type(exc).__name__)
                status = getattr(getattr(exc, "response", None), "status_code", None)
                log.warning("Overpass %s falhou: %s%s", futures[fut], type(exc).__name__, f" HTTP {status}" if status else "")
                continue
            if isinstance(data, dict) and isinstance(data.get("elements"), list):
                return data["elements"], futures[fut]
            errors.append("InvalidResponse")
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    if errors and all(e == "InvalidResponse" for e in errors):
        raise InvalidResponse("overpass")
    raise RuntimeError("todos os servidores falharam: " + ",".join(errors))


def haversine_km(lat1, lon1, lat2, lon2):
    r = math.radians
    h = (math.sin(r(lat2 - lat1) / 2) ** 2
         + math.cos(r(lat1)) * math.cos(r(lat2)) * math.sin(r(lon2 - lon1) / 2) ** 2)
    return 6371 * 2 * math.asin(math.sqrt(min(1.0, max(0.0, h))))


_RX = {
    "pharmacy": re.compile(r"farm[aá]cia|drogaria", re.I),
    "shop": re.compile(r"mercado|supermercado|atacad[aã]o|atacado", re.I),
    "lodging": re.compile(r"hotel|albergue|pousada|hostel", re.I),
    "food": re.compile(r"banco de alimentos|cozinha comunit[aá]ria|restaurante popular|bom prato|distribui[cç][aã]o de alimentos", re.I),
    "hospital": re.compile(r"hospital", re.I),
    "upa": re.compile(r"\bUPA\b"),
    "ubs": re.compile(r"\b(UBS|UBSF|USF|AMA)\b"),
    "ubs_name": re.compile(r"Unidade (B[aá]sica )?de Sa[uú]de", re.I),
    "police": re.compile(r"delegacia|pol[ií]cia", re.I),
    "ngo": re.compile(r"\bONG\b"),
    "ngo_name": re.compile(r"abrigo|ref[uú]gio|assist[eê]ncia social", re.I),
    "urgent": re.compile(r"Pronto[- ]?(Socorro|Atendimento)|Cl[ií]nica", re.I),
}


def classify(tags):
    """Devolve (categoria, tipo_de_abrigo) ou (None, None). Ordem igual ao painel Streamlit, com abrigos sociais em 'shelter'."""
    name = tags.get("name") or ""
    amenity = (tags.get("amenity") or "").lower()
    hc = (tags.get("healthcare") or "").lower()
    social = (tags.get("social_facility") or "").lower()
    shop = (tags.get("shop") or "").lower()
    tourism = (tags.get("tourism") or "").lower()
    operator = tags.get("operator") or ""
    if tags.get("emergency") == "assembly_point" or social == "shelter":
        return "shelter", "mapped"
    if amenity in ("school", "community_centre", "townhall"):
        return "shelter", "possible"
    if amenity == "pharmacy" or _RX["pharmacy"].search(name):
        return "pharmacy", None
    if shop in ("supermarket", "convenience") or _RX["shop"].search(name):
        return "shop", None
    if tourism in ("hotel", "hostel", "guest_house") or _RX["lodging"].search(name):
        return "lodging", None
    if amenity in ("marketplace", "food_bank") or social == "food_bank" or _RX["food"].search(name):
        return "food", None
    if amenity == "hospital" or hc == "hospital" or _RX["hospital"].search(name):
        return "hospital", None
    if amenity in ("clinic", "doctors", "health_post") or hc in ("clinic", "centre", "doctor"):
        return "clinic", None
    if (_RX["upa"].search(name) or _RX["upa"].search(operator) or _RX["ubs"].search(name)
            or _RX["ubs_name"].search(name) or re.search(r"\b(UBS|SUS)\b", operator)):
        return "clinic", None
    if amenity == "police" or _RX["police"].search(name):
        return "police", None
    if amenity == "social_facility" or _RX["ngo"].search(name) or _RX["ngo_name"].search(name):
        return "ngo", None
    if _RX["urgent"].search(name):
        return "clinic", None
    return None, None


def _address(tags):
    street = tags.get("addr:street")
    if not street:
        return None
    number = tags.get("addr:housenumber")
    city = tags.get("addr:city")
    text = street + (f", {number}" if number else "")
    return text + (f" – {city}" if city else "")


def parse_elements(elements, lat, lon):
    """Classifica, remove duplicatas, calcula distancia e limita a 40 por categoria (os mais proximos)."""
    if not isinstance(elements, list):
        raise InvalidResponse("overpass")
    buckets = {k: [] for k in CATEGORIES}
    seen = set()
    for el in elements:
        if not isinstance(el, dict):
            continue
        tags = el.get("tags") or {}
        name = tags.get("name") or tags.get("name:pt") or tags.get("name:en") or tags.get("int_name")
        center = el.get("center") or {}
        la, lo = el.get("lat", center.get("lat")), el.get("lon", center.get("lon"))
        if not name or not isinstance(la, (int, float)) or not isinstance(lo, (int, float)):
            continue
        key = f"{name}|{la:.3f},{lo:.3f}"  # mesmo nome em lugares diferentes (redes de lojas) nao e duplicata
        if key in seen:
            continue
        seen.add(key)
        category, kind = classify({**tags, "name": name})
        if not category:
            continue
        osm_type = el.get("type") if el.get("type") in ("node", "way", "relation") else "node"
        item = {"id": f"{osm_type}/{el.get('id')}", "name": name, "category": category,
                "categoryLabel": CATEGORIES[category],
                "coordinates": {"latitude": la, "longitude": lo},
                "distanceKm": round(haversine_km(lat, lon, la, lo), 2),
                "address": _address(tags),
                "osmUrl": f"https://www.openstreetmap.org/{osm_type}/{el.get('id')}"}
        if category == "shelter":
            item["shelterKind"] = kind
            item["note"] = MAPPED_SHELTER_NOTE if kind == "mapped" else POSSIBLE_SHELTER_NOTE
        buckets[category].append(item)
    items = []
    for category, bucket in buckets.items():
        # pontos de encontro mapeados aparecem antes das escolas/centros comunitarios
        bucket.sort(key=lambda p: (p.get("shelterKind") == "possible", p["distanceKm"]) if category == "shelter"
                    else (p["distanceKm"],))
        items += bucket[:MAX_PER_CATEGORY]
    return items


def _services_count(items):
    return sum(1 for p in items if p["category"] != "shelter")


def get_nearby(lat, lon):
    """Locais proximos de (lat, lon). A origem e arredondada para ~100 m (cache e privacidade)."""
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("coordenadas fora do intervalo")
    rlat, rlon = round(lat, 3), round(lon, 3)
    chosen = None
    for radius in RADIUS_STEPS_M:
        query = build_query(rlat, rlon, radius)
        try:
            (elements, server), ts, stale = _cached(("nearby", rlat, rlon, radius), NEARBY_TTL,
                                                    lambda q=query: _race_overpass(q))
        except (SourceUnavailable, InvalidResponse):
            if chosen is None:
                raise
            break  # a ampliacao falhou: fica com o resultado do raio menor
        items = parse_elements(elements, rlat, rlon)
        chosen = (items, server, ts, stale, radius)
        if _services_count(items) >= MIN_RESULTS:
            break
    items, server, ts, stale, radius = chosen
    counts = {k: sum(1 for p in items if p["category"] == k) for k in CATEGORIES}
    state = "stale" if stale else ("empty" if not items else "success")
    return {"state": state, "source": "OpenStreetMap (Overpass API)", "sourceUrl": server,
            "queriedAt": _iso(_now()), "fetchedAt": _iso(ts), "isSimulation": False, "riskCalculated": False,
            "origin": {"latitude": rlat, "longitude": rlon}, "radiusKm": radius / 1000,
            "categories": [{"id": k, "label": v, "count": counts[k]} for k, v in CATEGORIES.items()],
            "items": items, "notice": NEARBY_NOTICE,
            "attribution": "© colaboradores do OpenStreetMap (ODbL)"}


# ---------- Nominatim ----------
def parse_geocode(data):
    if not isinstance(data, list):
        raise InvalidResponse("nominatim")
    out = []
    for r in data:
        try:
            la, lo = float(r["lat"]), float(r["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if not (-90 <= la <= 90 and -180 <= lo <= 180):
            continue
        out.append({"name": r.get("name") or (r.get("display_name") or "").split(",")[0],
                    "displayName": r.get("display_name"),
                    "coordinates": {"latitude": la, "longitude": lo}})
    return out


def get_geocode(q):
    q = " ".join((q or "").split())
    if not 2 <= len(q) <= 120:
        raise ValueError("texto de busca invalido")
    params = {"format": "json", "limit": "5", "q": q, "accept-language": "pt-BR"}
    data, ts, stale = _cached(("geocode", q.lower()), GEOCODE_TTL, lambda: _get_nominatim(params))
    items = parse_geocode(data)
    state = "stale" if stale else ("empty" if not items else "success")
    return {"state": state, "source": "OpenStreetMap (Nominatim)", "sourceUrl": URL_NOMINATIM,
            "queriedAt": _iso(_now()), "fetchedAt": _iso(ts), "isSimulation": False, "riskCalculated": False,
            "query": q, "items": items, "attribution": "© colaboradores do OpenStreetMap (ODbL)"}
