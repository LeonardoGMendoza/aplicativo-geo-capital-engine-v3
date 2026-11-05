"""Alertas OFICIAIS do mundo + previsão de perigo para as cidades da família. Tudo grátis e sem chave.

Por que existe: a NASA (EONET) e o GDACS só catalogam eventos grandes e globais. Tornado, vendaval,
granizo e temporal local (como o de Chapecó em 04/11/2026) só aparecem nos avisos dos serviços
meteorológicos de cada país. Aqui juntamos esses avisos e separamos em "agora" e "vem aí".

Fontes:
- INMET (Brasil): avisos de tempestade, vendaval, chuva, granizo ("Perigo" e "Grande Perigo").
- NWS / NOAA (EUA): todos os alertas oficiais (tornado, furacão, nevasca, enchente...).
- MeteoAlarm (Europa): avisos laranja e vermelho de ~38 países.
- NOAA Tsunami (PTWC/NTWC): alertas de tsunami.
- USGS: terremotos fortes das últimas 24 h.
- Open-Meteo: previsão de 7 dias para cada cidade da família (tempestade, vento, chuva, calor, frio, neve).

Cada fonte tem cache próprio. Se uma fonte cair, as outras continuam e a última lista boa dela é usada.
Nenhum dado pessoal é enviado: só pedimos dados públicos por coordenada.
"""
import json
import os
import logging
import math
import re
import threading
import time
import unicodedata
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

log = logging.getLogger("uvicorn.error")

UA = "Omni-EcoRescue/1.0 (alertas publicos; https://omni.sandlj.com.br)"
UA_NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
TIMEOUT = 15
CACHE_ALERTAS = 600      # 10 min
CACHE_PREVISAO = 1800    # 30 min
MAX_POR_FONTE = 300
MAX_PONTOS_POLIGONO = 150

INMET_JSON = "https://apiprevmet3.inmet.gov.br/avisos/ativos"
INMET_RSS = "https://apiprevmet3.inmet.gov.br/avisos/rss"
NWS_URL = "https://api.weather.gov/alerts/active?status=actual&severity=Extreme,Severe"
METEOALARM_URL = "https://feeds.meteoalarm.org/api/v1/warnings/feeds-{pais}"
TSUNAMI_URLS = ["https://www.tsunami.gov/events/xml/PHEBAtom.xml", "https://www.tsunami.gov/events/xml/PAAQAtom.xml"]
USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# Nenhum lugar fica escrito no código. Cada pessoa manda os SEUS lugares (guardados só no aparelho dela)
# e cada instalação (ex.: uma prefeitura) pode ter locais monitorados por padrão, configurados no servidor:
#   OMNI_LOCAIS="Centro|-25.5469|-54.5882|Brasil;Vila C|-25.47|-54.56|Brasil"
RAIO_LUGAR_KM = 300   # terremoto, ciclone ou tsunami a até 300 km do lugar
MAX_LUGARES = 12
MAX_LOCAIS_PADRAO = 50

NIVEL_ORDEM = {"extremo": 0, "severo": 1, "moderado": 2}
CAP_SEVERIDADE = {"extreme": "extremo", "severe": "severo", "moderate": "moderado"}
INMET_SEVERIDADE = {"grande perigo": "extremo", "perigo": "severo", "perigo potencial": "moderado"}

# Europa: país do feed do MeteoAlarm -> (nome em português, latitude e longitude do centro, para o mapa)
METEOALARM_PAISES = {
    "austria": ("Áustria", 47.6, 14.1), "belgium": ("Bélgica", 50.6, 4.6), "bosnia-herzegovina": ("Bósnia", 44.2, 17.8),
    "bulgaria": ("Bulgária", 42.7, 25.3), "croatia": ("Croácia", 45.4, 15.9), "cyprus": ("Chipre", 35.0, 33.2),
    "czechia": ("Tchéquia", 49.8, 15.5), "denmark": ("Dinamarca", 56.0, 9.5), "estonia": ("Estônia", 58.7, 25.5),
    "finland": ("Finlândia", 62.5, 26.0), "france": ("França", 46.6, 2.4), "germany": ("Alemanha", 51.1, 10.4),
    "greece": ("Grécia", 39.3, 22.2), "hungary": ("Hungria", 47.2, 19.4), "iceland": ("Islândia", 64.9, -18.6),
    "ireland": ("Irlanda", 53.2, -8.1), "israel": ("Israel", 31.4, 35.0), "italy": ("Itália", 42.8, 12.6),
    "latvia": ("Letônia", 56.9, 24.6), "lithuania": ("Lituânia", 55.2, 23.9), "luxembourg": ("Luxemburgo", 49.8, 6.1),
    "malta": ("Malta", 35.9, 14.4), "moldova": ("Moldávia", 47.2, 28.5), "montenegro": ("Montenegro", 42.7, 19.3),
    "netherlands": ("Holanda", 52.2, 5.5), "north-macedonia": ("Macedônia do Norte", 41.6, 21.7), "norway": ("Noruega", 61.5, 9.0),
    "poland": ("Polônia", 52.0, 19.4), "portugal": ("Portugal", 39.6, -8.0), "romania": ("Romênia", 45.9, 24.9),
    "serbia": ("Sérvia", 44.0, 20.9), "slovakia": ("Eslováquia", 48.7, 19.7), "slovenia": ("Eslovênia", 46.1, 14.8),
    "spain": ("Espanha", 40.2, -3.6), "sweden": ("Suécia", 62.0, 15.0), "switzerland": ("Suíça", 46.8, 8.2),
    "united-kingdom": ("Reino Unido", 54.0, -2.5), "ukraine": ("Ucrânia", 49.0, 31.4),
}

# Nomes dos alertas dos EUA em português (os mais comuns e perigosos)
NWS_EVENTOS = {
    "tornado warning": "Tornado (alerta: está acontecendo)", "tornado watch": "Tornado possível (vigilância)",
    "tornado emergency": "Emergência de tornado",
    "severe thunderstorm warning": "Tempestade severa", "severe thunderstorm watch": "Tempestade severa possível",
    "flash flood warning": "Enxurrada", "flash flood emergency": "Emergência de enxurrada", "flood warning": "Enchente",
    "hurricane warning": "Furacão", "hurricane watch": "Furacão possível", "tropical storm warning": "Tempestade tropical",
    "storm surge warning": "Ressaca / maré de tempestade", "extreme wind warning": "Vento extremo",
    "high wind warning": "Vento forte", "winter storm warning": "Tempestade de neve", "blizzard warning": "Nevasca",
    "ice storm warning": "Chuva congelante", "extreme cold warning": "Frio extremo", "wind chill warning": "Frio extremo",
    "excessive heat warning": "Calor extremo", "extreme heat warning": "Calor extremo", "red flag warning": "Risco alto de incêndio",
    "fire warning": "Incêndio", "tsunami warning": "Tsunami", "tsunami advisory": "Tsunami (aviso)", "dust storm warning": "Tempestade de poeira",
    "avalanche warning": "Avalanche", "civil danger warning": "Perigo civil", "shelter in place warning": "Fique abrigado",
    "evacuation immediate": "Evacuação imediata", "nuclear power plant warning": "Usina nuclear", "radiological hazard warning": "Perigo radiológico",
    "hazardous materials warning": "Produtos perigosos",
}

# Tipos de aviso do MeteoAlarm (Europa) em português. O texto vem como "Severe rain-flood warning", "Red wind warning"...
METEOALARM_TIPOS = [("rain-flood", "Chuva e enchente"), ("flooding", "Enchente"), ("thunderstorm", "Tempestade"), ("snow-ice", "Neve e gelo"),
                    ("high-temperature", "Calor extremo"), ("low-temperature", "Frio extremo"), ("coastalevent", "Ressaca no litoral"),
                    ("coastal", "Ressaca no litoral"), ("forest-fire", "Risco de incêndio florestal"), ("avalanche", "Avalanche"),
                    ("fog", "Neblina"), ("rain", "Chuva forte"), ("wind", "Vento forte"), ("snow", "Neve")]


def evento_meteoalarm(texto):
    t = _sem_acento(texto)
    return next((pt for chave, pt in METEOALARM_TIPOS if chave in t), None)


# Códigos de tempo do Open-Meteo (WMO)
TEMPESTADE = {95, 96, 99}
GRANIZO = {96, 99}
NEVE_FORTE = {75, 86}
NEVE = {71, 73, 75, 77, 85, 86}


class FonteIndisponivel(Exception):
    pass


# ----------------------------------------------------------------- utilidades
def _texto(valor, limite=300):
    if valor in (None, ""):
        return None
    if isinstance(valor, (list, tuple)):
        valor = "; ".join(str(v) for v in valor if v not in (None, ""))
    texto = re.sub(r"<[^>]+>", " ", str(valor))  # tira HTML solto
    texto = " ".join(texto.split())
    return texto[:limite] if texto else None


def _sem_acento(texto):
    return "".join(c for c in unicodedata.normalize("NFD", str(texto or "").lower()) if unicodedata.category(c) != "Mn")


def _data_iso(valor):
    """Aceita ISO (com ou sem fuso), 'AAAA-MM-DD HH:MM' e 'DD/MM/AAAA HH:MM'. Sem fuso = horário de Brasília."""
    if not valor:
        return None
    s = str(valor).strip()
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).isoformat()
    except ValueError:
        pass
    for formato in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S.%f"):
        try:
            return datetime.strptime(s, formato).isoformat()
        except ValueError:
            pass
    return None


BRASILIA = timezone(timedelta(hours=-3))


def _ts(iso):
    if not iso:
        return None
    try:
        d = datetime.fromisoformat(iso)
    except ValueError:
        return None
    return (d if d.tzinfo else d.replace(tzinfo=BRASILIA)).timestamp()


def _quando(inicio_iso, agora):
    t = _ts(inicio_iso)
    return "vem" if t is not None and t > agora else "agora"


def _expirado(fim_iso, agora):
    t = _ts(fim_iso)
    return t is not None and t < agora


def distancia_km(lat1, lon1, lat2, lon2):
    r = math.radians
    h = math.sin(r(lat2 - lat1) / 2) ** 2 + math.cos(r(lat1)) * math.cos(r(lat2)) * math.sin(r(lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(min(1, h)))


def dentro_do_poligono(lat, lon, poligono):
    """Ray casting. poligono = [[lat, lon], ...]."""
    dentro = False
    n = len(poligono)
    for i in range(n):
        la1, lo1 = poligono[i]
        la2, lo2 = poligono[(i + 1) % n]
        if (la1 > lat) != (la2 > lat):
            x = lo1 + (lat - la1) * (lo2 - lo1) / ((la2 - la1) or 1e-12)
            if lon < x:
                dentro = not dentro
    return dentro


def _simplificar(pontos):
    pontos = [[round(float(a), 4), round(float(b), 4)] for a, b in pontos if -90 <= float(a) <= 90 and -180 <= float(b) <= 180]
    if len(pontos) > MAX_PONTOS_POLIGONO:
        passo = math.ceil(len(pontos) / MAX_PONTOS_POLIGONO)
        pontos = pontos[::passo]
    return pontos if len(pontos) >= 3 else None


def _centro(poligono):
    if not poligono:
        return None, None
    return round(sum(p[0] for p in poligono) / len(poligono), 4), round(sum(p[1] for p in poligono) / len(poligono), 4)


def _geojson_para_poligono(geometria):
    """GeoJSON Polygon/MultiPolygon ([lon, lat]) -> maior anel como [[lat, lon]]."""
    if not isinstance(geometria, dict):
        return None
    try:
        if geometria.get("type") == "Polygon":
            aneis = [geometria["coordinates"][0]]
        elif geometria.get("type") == "MultiPolygon":
            aneis = [p[0] for p in geometria["coordinates"]]
        else:
            return None
        anel = max(aneis, key=len)
        return _simplificar([[p[1], p[0]] for p in anel])
    except (KeyError, IndexError, TypeError, ValueError):
        return None


def _poligono_cap(texto):
    """CAP: 'lat,lon lat,lon ...'."""
    try:
        return _simplificar([[float(a), float(b)] for a, b in (par.split(",")[:2] for par in str(texto).split())])
    except (ValueError, TypeError):
        return None


def _poligono_livre(valor):
    """Polígono em formato desconhecido (INMET): lista/str JSON aninhada. Descobre se é [lat,lon] ou [lon,lat]."""
    if valor in (None, ""):
        return None
    if isinstance(valor, str):
        s = valor.strip()
        if not s.startswith("[") and not s.startswith("{"):
            return _poligono_cap(s)
        try:
            valor = json.loads(s)
        except ValueError:
            return None
    if isinstance(valor, dict):
        return _geojson_para_poligono(valor.get("geometry", valor))
    pares = valor
    while isinstance(pares, list) and pares and isinstance(pares[0], list) and pares[0] and isinstance(pares[0][0], list):
        pares = max(pares, key=len)  # desce até a lista de pares
    try:
        pares = [[float(p[0]), float(p[1])] for p in pares]
    except (TypeError, ValueError, IndexError):
        return None
    if not pares:
        return None
    # No Brasil a longitude é sempre < -34 e a latitude > -34: se o 1º número for "mais oeste", é [lon, lat].
    if sum(1 for a, _ in pares if a < -34.5) > len(pares) / 2:
        pares = [[b, a] for a, b in pares]
    return _simplificar(pares)


def _alerta(**campos):
    base = {"id": None, "fonte": None, "fonteUrl": None, "pais": None, "regiao": "mundo", "evento": None, "eventoOriginal": None,
            "severidade": "severo", "quando": "agora", "inicio": None, "fim": None, "area": None, "titulo": None,
            "descricao": None, "instrucao": None, "latitude": None, "longitude": None, "poligono": None, "link": None, "ufs": []}
    base.update(campos)
    if base["poligono"] and base["latitude"] is None:
        base["latitude"], base["longitude"] = _centro(base["poligono"])
    return base


# ----------------------------------------------------------------- INMET (Brasil)
def _campo(d, *chaves):
    for chave in chaves:
        if isinstance(d, dict) and d.get(chave) not in (None, "", []):
            return d[chave]
    return None


def _inmet_data(item, data_chaves, hora_chaves, iso_chaves):
    iso = _campo(item, *iso_chaves)
    if iso:
        return _data_iso(iso)
    data, hora = _campo(item, *data_chaves), _campo(item, *hora_chaves)
    if data:
        return _data_iso(f"{data} {hora}".strip() if hora else str(data))
    return None


def _nomes(valor):
    if isinstance(valor, list):
        return [str(_campo(v, "nome", "municipio", "name") or "") if isinstance(v, dict) else str(v) for v in valor]
    return valor


UFS = {"AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
       "RS", "RO", "RR", "SC", "SP", "SE", "TO"}


def ufs_do_texto(*textos):
    """Siglas dos estados citadas no aviso ("SC, PR" ou "Chapecó - SC (4204202)")."""
    achadas = set()
    for t in textos:
        achadas |= {m for m in re.findall(r"\b([A-Z]{2})\b", str(_nomes(t) or "")) if m in UFS}
    return sorted(achadas)


def _area_inmet(estados, municipios):
    estados, municipios = _texto(_nomes(estados), 120), _texto(_nomes(municipios), 5000)  # completo: a busca da família usa o texto todo
    return f"{estados}: {municipios}" if estados and municipios else (municipios or estados)


def parse_inmet_json(dados, agora=None):
    """Avisos ativos do INMET. Formato esperado {"hoje": [...], "futuro": [...]} (ou uma lista)."""
    agora = agora or time.time()
    if isinstance(dados, dict):
        grupos = [(dados.get("hoje") or [], "agora"), (dados.get("futuro") or [], "vem")]
        if not any(g for g, _ in grupos):
            grupos = [(dados.get("avisos") or dados.get("data") or [], None)]
    elif isinstance(dados, list):
        grupos = [(dados, None)]
    else:
        raise ValueError("formato inesperado do INMET")
    alertas, vistos = [], set()
    for itens, quando_grupo in grupos:
        for item in itens if isinstance(itens, list) else []:
            if not isinstance(item, dict):
                continue
            sev_txt = _sem_acento(_campo(item, "severidade", "severity", "grau") or "")
            sev_txt = re.sub(r"^.*grau:\s*", "", sev_txt).strip()
            severidade = INMET_SEVERIDADE.get(sev_txt) or next((v for k, v in INMET_SEVERIDADE.items() if k in sev_txt and k != "perigo"), None) \
                or ("severo" if "perigo" in sev_txt else None)
            if not severidade:
                continue
            ident = str(_campo(item, "id", "id_aviso", "codigo") or len(alertas))
            if ident in vistos:
                continue
            vistos.add(ident)
            inicio = _inmet_data(item, ("data_inicio",), ("hora_inicio",), ("inicio", "onset", "data_hora_inicio"))
            fim = _inmet_data(item, ("data_fim",), ("hora_fim",), ("fim", "expires", "data_hora_fim"))
            if _expirado(fim, agora):
                continue
            evento = _texto(_campo(item, "descricao", "evento", "event", "tipo"), 80) or "Aviso meteorológico"
            municipios = _campo(item, "municipios", "areas", "area")
            poligono = _poligono_livre(_campo(item, "poligono", "polygon", "geometria", "geometry"))
            alertas.append(_alerta(
                id=f"inmet-{ident}", fonte="INMET", fonteUrl="https://alertas2.inmet.gov.br/", pais="Brasil", regiao="brasil",
                evento=evento, eventoOriginal=evento, severidade=severidade,
                quando=quando_grupo or _quando(inicio, agora), inicio=inicio, fim=fim,
                area=_area_inmet(_campo(item, "estados", "ufs"), municipios),
                ufs=ufs_do_texto(_campo(item, "estados", "ufs"), municipios),
                titulo=f"{evento} · {sev_txt.title() or severidade}",
                descricao=_texto(_campo(item, "riscos", "risco", "description"), 600),
                instrucao=_texto(_campo(item, "instrucoes", "instrucao", "instruction"), 500),
                poligono=poligono, link=f"https://alertas2.inmet.gov.br/{ident}" if ident.isdigit() else "https://alertas2.inmet.gov.br/",
            ))
    return alertas[:MAX_POR_FONTE]


CAP_NS = {"cap": "urn:oasis:names:tc:emergency:cap:1.2"}


def parse_cap(xml_texto, fonte, fonte_url, pais, regiao, agora=None, link=None):
    """Um alerta CAP 1.2 (padrão mundial). Prefere a informação em português, espanhol ou inglês."""
    agora = agora or time.time()
    raiz = ET.fromstring(xml_texto)
    ns = {"cap": raiz.tag[1:].split("}")[0]} if raiz.tag.startswith("{") else CAP_NS
    p = "cap:" if raiz.tag.startswith("{") else ""
    infos = raiz.findall(f"{p}info", ns)
    if not infos:
        return []
    def prioridade(info):
        lingua = (info.findtext(f"{p}language", "", ns) or "").lower()
        return 0 if lingua.startswith("pt") else 1 if lingua.startswith("es") else 2 if lingua.startswith("en") else 3
    info = sorted(infos, key=prioridade)[0]
    t = lambda tag: info.findtext(f"{p}{tag}", None, ns)
    sev_cap = (t("severity") or "").lower()
    severidade = CAP_SEVERIDADE.get(sev_cap)
    if not severidade:
        return []
    inicio = _data_iso(t("onset") or t("effective") or raiz.findtext(f"{p}sent", None, ns))
    fim = _data_iso(t("expires"))
    if _expirado(fim, agora):
        return []
    areas = info.findall(f"{p}area", ns)
    poligono = None
    for area in areas:
        for pol in area.findall(f"{p}polygon", ns):
            poligono = _poligono_cap(pol.text)
            if poligono:
                break
        if poligono:
            break
    evento = _texto(t("event"), 80) or "Alerta"
    ident = raiz.findtext(f"{p}identifier", None, ns) or evento
    return [_alerta(
        id=f"{fonte.lower()}-{ident}"[:120], fonte=fonte, fonteUrl=fonte_url, pais=pais, regiao=regiao,
        evento=evento, eventoOriginal=evento, severidade=severidade, quando=_quando(inicio, agora), inicio=inicio, fim=fim,
        area=_texto([a.findtext(f"{p}areaDesc", "", ns) for a in areas], 400), titulo=_texto(t("headline"), 200) or evento,
        ufs=ufs_do_texto(*[a.findtext(f"{p}areaDesc", "", ns) for a in areas]) if pais == "Brasil" else [],
        descricao=_texto(t("description"), 600), instrucao=_texto(t("instruction"), 500), poligono=poligono,
        link=t("web") if (t("web") or "").startswith("https://") else link,
    )]


def parse_inmet_rss(xml_texto):
    """RSS do INMET: devolve os links de cada aviso (cada um aponta para um CAP)."""
    raiz = ET.fromstring(xml_texto)
    return [item.findtext("link") for item in raiz.iter("item") if (item.findtext("link") or "").startswith("http")]


# ----------------------------------------------------------------- NWS (EUA)
def parse_nws(geojson, agora=None):
    agora = agora or time.time()
    if not isinstance(geojson, dict) or not isinstance(geojson.get("features"), list):
        raise ValueError("formato inesperado do NWS")
    alertas = []
    for f in geojson["features"]:
        props = f.get("properties") or {}
        severidade = CAP_SEVERIDADE.get(str(props.get("severity", "")).lower())
        if severidade not in ("extremo", "severo"):
            continue
        fim = _data_iso(props.get("ends") or props.get("expires"))
        if _expirado(fim, agora):
            continue
        inicio = _data_iso(props.get("onset") or props.get("effective"))
        original = _texto(props.get("event"), 80) or "Alerta"
        evento = NWS_EVENTOS.get(original.lower(), original)
        if original.lower() in ("tornado warning", "tornado emergency", "flash flood emergency", "extreme wind warning", "tsunami warning"):
            severidade = "extremo"
        estados = sorted({str(u)[:2] for u in (props.get("geocode") or {}).get("UGC", []) if isinstance(u, str)})
        alertas.append(_alerta(
            id=f"nws-{props.get('id') or len(alertas)}"[-120:], fonte="NWS / NOAA (EUA)", fonteUrl="https://www.weather.gov/",
            pais="EUA", regiao="americas", evento=evento, eventoOriginal=original, severidade=severidade,
            quando=_quando(inicio, agora), inicio=inicio, fim=fim,
            area=_texto(((", ".join(estados) + ": ") if estados else "") + str(props.get("areaDesc") or ""), 400),
            titulo=_texto(props.get("headline"), 200) or evento, descricao=_texto(props.get("description"), 600),
            instrucao=_texto(props.get("instruction"), 500), poligono=_geojson_para_poligono(f.get("geometry")),
            link="https://alerts.weather.gov/",
        ))
    alertas.sort(key=lambda a: NIVEL_ORDEM[a["severidade"]])
    return alertas[:MAX_POR_FONTE]


# ----------------------------------------------------------------- MeteoAlarm (Europa)
def parse_meteoalarm(dados, pais_feed, agora=None):
    agora = agora or time.time()
    nome, lat, lon = METEOALARM_PAISES.get(pais_feed, (pais_feed, None, None))
    alertas = []
    for w in (dados or {}).get("warnings", []) if isinstance(dados, dict) else []:
        alerta = (w or {}).get("alert") or {}
        infos = alerta.get("info") or []
        if not infos:
            continue
        info = sorted(infos, key=lambda i: 0 if str(i.get("language", "")).lower().startswith(("pt", "es")) else 1 if str(i.get("language", "")).lower().startswith("en") else 2)[0]
        severidade = CAP_SEVERIDADE.get(str(info.get("severity", "")).lower())
        if severidade not in ("extremo", "severo"):  # só laranja e vermelho
            continue
        fim = _data_iso(info.get("expires"))
        if _expirado(fim, agora):
            continue
        inicio = _data_iso(info.get("onset") or info.get("effective"))
        original = _texto(info.get("event"), 80) or "Aviso"
        evento = evento_meteoalarm(original) or original
        alertas.append(_alerta(
            id=f"meteoalarm-{alerta.get('identifier') or w.get('uuid') or len(alertas)}"[:120], fonte="MeteoAlarm (Europa)",
            fonteUrl="https://meteoalarm.org/", pais=nome, regiao="europa", evento=evento, eventoOriginal=original,
            severidade=severidade, quando=_quando(inicio, agora), inicio=inicio, fim=fim,
            area=_texto([a.get("areaDesc") for a in info.get("area") or [] if isinstance(a, dict)], 400),
            titulo=_texto(info.get("headline"), 200) or f"{evento} · {nome}", descricao=_texto(info.get("description"), 600),
            instrucao=_texto(info.get("instruction"), 500), latitude=lat, longitude=lon, link="https://meteoalarm.org/",
        ))
    return alertas[:MAX_POR_FONTE]


# ----------------------------------------------------------------- Tsunami (NOAA)
ATOM = "{http://www.w3.org/2005/Atom}"
GEO = "{http://www.w3.org/2003/01/geo/wgs84_pos#}"


def parse_tsunami(xml_texto, agora=None, janela_horas=24):
    agora = agora or time.time()
    raiz = ET.fromstring(xml_texto)
    alertas = []
    for e in raiz.iter(f"{ATOM}entry"):
        titulo = _texto(e.findtext(f"{ATOM}title"), 200) or ""
        resumo = _texto(e.findtext(f"{ATOM}summary") or e.findtext(f"{ATOM}content"), 600) or ""
        texto = _sem_acento(titulo + " " + resumo)
        atualizado = _data_iso(e.findtext(f"{ATOM}updated"))
        t = _ts(atualizado)
        if t is not None and agora - t > janela_horas * 3600:
            continue
        if "no tsunami" in texto or "not expected" in texto or "no threat" in texto:
            continue
        if "warning" in texto or "threat" in texto:
            severidade = "extremo"
        elif "advisory" in texto or "watch" in texto:
            severidade = "severo"
        else:
            continue
        try:
            lat, lon = float(e.findtext(f"{GEO}lat")), float(e.findtext(f"{GEO}long"))
        except (TypeError, ValueError):
            lat = lon = None
        link = next((l.get("href") for l in e.findall(f"{ATOM}link") if (l.get("href") or "").startswith("https://")), "https://www.tsunami.gov/")
        alertas.append(_alerta(
            id=f"tsunami-{e.findtext(f'{ATOM}id') or titulo}"[:120], fonte="NOAA Tsunami", fonteUrl="https://www.tsunami.gov/",
            pais=None, regiao="mundo", evento="Tsunami", eventoOriginal=titulo, severidade=severidade, quando="agora",
            inicio=atualizado, titulo=titulo or "Tsunami", descricao=resumo, area=titulo, latitude=lat, longitude=lon, link=link,
            instrucao="Se estiver no litoral e sentir tremor forte ou o mar recuar: suba para um lugar alto ou longe da praia agora.",
        ))
    return alertas


# ----------------------------------------------------------------- USGS (terremotos)
def parse_usgs(geojson, agora=None):
    agora = agora or time.time()
    alertas = []
    for f in (geojson or {}).get("features", []) if isinstance(geojson, dict) else []:
        p = f.get("properties") or {}
        try:
            lon, lat = float(f["geometry"]["coordinates"][0]), float(f["geometry"]["coordinates"][1])
            mag = float(p.get("mag"))
        except (KeyError, IndexError, TypeError, ValueError):
            continue
        severidade = "extremo" if mag >= 6.5 else "severo" if mag >= 5.5 else "moderado"
        quando = datetime.fromtimestamp(p["time"] / 1000, timezone.utc).isoformat() if isinstance(p.get("time"), (int, float)) else None
        alertas.append(_alerta(
            id=f"usgs-{f.get('id')}", fonte="USGS (terremotos)", fonteUrl="https://earthquake.usgs.gov/", pais=None,
            regiao=_regiao_por_coordenada(lat, lon), evento=f"Terremoto M{mag:.1f}", eventoOriginal=p.get("title"),
            severidade=severidade, quando="agora", inicio=quando, area=_texto(p.get("place"), 200),
            titulo=_texto(p.get("title"), 200), latitude=round(lat, 4), longitude=round(lon, 4),
            descricao="Sinal de tsunami emitido pelo USGS." if p.get("tsunami") else None,
            link=p.get("url") if str(p.get("url") or "").startswith("https://") else "https://earthquake.usgs.gov/",
        ))
    return alertas


def _regiao_por_coordenada(lat, lon):
    if lat is None or lon is None:
        return "mundo"
    if -34 <= lat <= 6 and -74 <= lon <= -34:
        return "brasil"
    if lon < -30:
        return "americas"
    if lat > 35 and -25 <= lon <= 45:
        return "europa"
    if lon > 60 or (lat > 0 and lon > 45):
        return "asia"
    return "mundo"


# ----------------------------------------------------------------- Previsão (Open-Meteo)
def avaliar_dia(codigo, chuva, rajada, tmax, tmin):
    """Perigos previstos num dia. Devolve (nivel ou None, motivos)."""
    motivos, niveis = [], []
    def add(nivel, texto):
        niveis.append(nivel); motivos.append(texto)
    # Régua parecida com a do INMET. Trovoada sozinha é comum (primavera, Amazônia): só amarelo.
    # Laranja/vermelho só quando a previsão junta trovoada com vento forte ou muita chuva.
    # O "granizo" do modelo (códigos 96/99) só é confiável na Europa Central: não anunciamos granizo pela previsão.
    if codigo in TEMPESTADE:
        g, c = rajada or 0, chuva or 0
        if g >= 90 or c >= 100:
            add("extremo", "Tempestade forte com vento e chuva: risco de vendaval/tornado")
        elif g >= 70 or c >= 50:
            add("severo", "Tempestade forte")
        else:
            add("moderado", "Pancadas de chuva com trovoada")
    if rajada is not None:
        if rajada >= 100: add("extremo", f"Rajadas de até {round(rajada)} km/h")
        elif rajada >= 75: add("severo", f"Rajadas de até {round(rajada)} km/h")
        elif rajada >= 60: add("moderado", f"Vento forte ({round(rajada)} km/h)")
    if chuva is not None:
        if chuva >= 100: add("extremo", f"Chuva muito forte: {round(chuva)} mm (risco de enchente)")
        elif chuva >= 50: add("severo", f"Chuva forte: {round(chuva)} mm")
        elif chuva >= 30: add("moderado", f"Chuva de {round(chuva)} mm")
    if tmax is not None:
        if tmax >= 42: add("extremo", f"Calor extremo: {round(tmax)} °C")
        elif tmax >= 38: add("severo", f"Calor forte: {round(tmax)} °C")
    if tmin is not None:
        if tmin <= -18: add("extremo", f"Frio extremo: {round(tmin)} °C")
        elif tmin <= -8: add("severo", f"Frio forte: {round(tmin)} °C")
        elif tmin <= 0: add("moderado", f"Geada / congelamento: {round(tmin)} °C")
    if codigo in NEVE:
        add("severo" if codigo in NEVE_FORTE else "moderado", "Neve forte" if codigo in NEVE_FORTE else "Neve")
    nivel = min(niveis, key=NIVEL_ORDEM.get) if niveis else None
    return nivel, list(dict.fromkeys(motivos))


def parse_open_meteo(dados, quantidade):
    """Resposta do Open-Meteo para N pontos -> lista (mesma ordem) com os 7 dias avaliados de cada ponto."""
    lista = dados if isinstance(dados, list) else [dados]
    if len(lista) != quantidade:
        raise ValueError("Open-Meteo devolveu um número diferente de lugares")
    saida = []
    for d in lista:
        daily = (d or {}).get("daily") or {}
        dias = []
        for i, data in enumerate(daily.get("time") or []):
            v = lambda k: (daily.get(k) or [])[i] if i < len(daily.get(k) or []) else None
            nivel, motivos = avaliar_dia(v("weather_code"), v("precipitation_sum"), v("wind_gusts_10m_max"), v("temperature_2m_max"), v("temperature_2m_min"))
            dias.append({"data": data, "nivel": nivel, "motivos": motivos, "codigo": v("weather_code"),
                         "tmax": v("temperature_2m_max"), "tmin": v("temperature_2m_min"), "chuva": v("precipitation_sum"), "rajada": v("wind_gusts_10m_max")})
        saida.append(dias)
    return saida


# ----------------------------------------------------------------- Lugares (de cada pessoa ou da prefeitura)
GENERICOS = {"onde eu moro", "meu lugar", "casa", "minha casa", "trabalho"}


def normalizar_lugares(lista, limite=MAX_LUGARES):
    """Valida os lugares recebidos. Cada um: {id, nome, pais?, latitude, longitude}."""
    saida, vistos = [], set()
    for item in lista or []:
        if not isinstance(item, dict):
            continue
        try:
            lat, lon = float(item.get("latitude", item.get("lat"))), float(item.get("longitude", item.get("lon")))
        except (TypeError, ValueError):
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        ident = re.sub(r"[^\w-]", "", str(item.get("id") or f"{lat:.2f}_{lon:.2f}"))[:40] or f"l{len(saida)}"
        if ident in vistos:
            continue
        vistos.add(ident)
        nome = _texto(item.get("nome"), 80) or "Meu lugar"
        base = _sem_acento(re.split(r"[(,]", nome)[0]).strip()
        saida.append({"id": ident, "nome": nome, "pais": _texto(item.get("pais"), 40), "lat": round(lat, 4), "lon": round(lon, 4),
                      "nomes": [base] if len(base) >= 3 and base not in GENERICOS else []})
        if len(saida) >= limite:
            break
    return saida


def lugares_do_ambiente(valor=None):
    """Locais monitorados por padrão nesta instalação. Formato: 'Nome|lat|lon|País;Nome|lat|lon|País'."""
    valor = os.getenv("OMNI_LOCAIS", "") if valor is None else valor
    itens = []
    for i, parte in enumerate(p for p in valor.split(";") if p.strip()):
        campos = [c.strip() for c in parte.split("|")]
        if len(campos) >= 3:
            itens.append({"id": f"padrao-{i}", "nome": campos[0], "latitude": campos[1], "longitude": campos[2], "pais": campos[3] if len(campos) > 3 else None})
    return normalizar_lugares(itens, MAX_LOCAIS_PADRAO)


def alertas_do_lugar(lugar, alertas):
    """Alertas que atingem o lugar: dentro do polígono, perto (terremoto/tsunami/ciclone) ou com o nome no texto."""
    achados = []
    padroes = [re.compile(r"\b" + re.escape(n) + r"\b") for n in lugar["nomes"]]
    for a in alertas:
        if a.get("poligono"):
            if dentro_do_poligono(lugar["lat"], lugar["lon"], a["poligono"]):
                achados.append(a)
            continue
        if a.get("pais") is None and a.get("latitude") is not None:  # evento sem país (terremoto, tsunami, GDACS)
            if distancia_km(lugar["lat"], lugar["lon"], a["latitude"], a["longitude"]) <= RAIO_LUGAR_KM:
                achados.append(a)
            continue
        if not padroes or not lugar.get("pais") or a.get("pais") != lugar["pais"]:
            continue  # pelo nome só no mesmo país (há "Lima" no Peru e nos EUA)
        texto = _sem_acento(a.get("area"))
        if any(p.search(texto) for p in padroes):
            achados.append(a)
    achados.sort(key=lambda a: (a["quando"] != "agora", NIVEL_ORDEM.get(a["severidade"], 3)))
    return achados


def chave_ponto(lugar):
    return (round(lugar["lat"], 2), round(lugar["lon"], 2))


def resumo_lugares(lugares, alertas, previsao):
    """previsao: {(lat, lon) arredondados: dias}."""
    saida = []
    for c in lugares:
        dele = alertas_do_lugar(c, alertas)
        dias = (previsao or {}).get(chave_ponto(c), [])
        niveis = [a["severidade"] for a in dele] + [d["nivel"] for d in dias if d.get("nivel")]
        nivel = min(niveis, key=NIVEL_ORDEM.get) if niveis else None
        oficial = min((a["severidade"] for a in dele), key=NIVEL_ORDEM.get) if dele else None
        saida.append({"id": c["id"], "nome": c["nome"], "pais": c["pais"], "latitude": c["lat"], "longitude": c["lon"],
                      "nivel": nivel, "nivelOficial": oficial, "previsao": dias,
                      "alertas": [{k: a.get(k) for k in ("id", "evento", "severidade", "quando", "fonte", "inicio", "fim", "area", "instrucao", "link")}
                                  for a in dele][:10]})
    return saida


def gdacs_para_oficiais(lista_gdacs):
    """Converte os alertas do GDACS (já buscados pelo Omni) para o mesmo formato, para cruzar com a família."""
    saida = []
    for g in lista_gdacs or []:
        saida.append(_alerta(
            id=f"gdacs-{g.get('id')}", fonte="GDACS (ONU)", fonteUrl="https://www.gdacs.org/", pais=None,
            regiao=_regiao_por_coordenada(g.get("latitude"), g.get("longitude")), evento=g.get("tipoNome"), eventoOriginal=g.get("nome"),
            severidade="extremo" if g.get("nivel") == "vermelho" else "severo", quando="agora", inicio=g.get("inicio"), fim=None,
            area=g.get("pais"), titulo=g.get("nome"), descricao=g.get("severidade") or g.get("descricao"),
            latitude=g.get("latitude"), longitude=g.get("longitude"), link=g.get("link"),
        ))
    return saida


# ----------------------------------------------------------------- Serviço
class AlertasOficiais:
    def __init__(self, buscadores=None, buscar_previsao=None, gdacs=None, agora=time.time, padrao=None):
        self._agora = agora
        self._buscadores = buscadores if buscadores is not None else {
            "inmet": ("INMET (Brasil)", self._inmet), "nws": ("NWS / NOAA (EUA)", self._nws),
            "meteoalarm": ("MeteoAlarm (Europa)", self._meteoalarm), "tsunami": ("NOAA Tsunami", self._tsunami),
            "usgs": ("USGS (terremotos)", self._usgs),
        }
        self._buscar_previsao = buscar_previsao or self._open_meteo
        self._gdacs = gdacs  # função que devolve a lista do GDACS (ou None)
        self._cache = {}     # fonte -> (momento, alertas)
        self._previsao = {}  # (lat, lon) -> (momento, dias)
        self._padrao = lugares_do_ambiente() if padrao is None else normalizar_lugares(padrao, MAX_LOCAIS_PADRAO)
        self._lock = threading.Lock()

    # --- rede (httpx só é importado aqui: os testes rodam sem internet)
    def _get(self, url, navegador=False, json_=True, **params):
        import httpx
        cabecalho = {"User-Agent": UA_NAVEGADOR if navegador else UA, "Accept": "application/json" if json_ else "application/xml, text/xml, */*"}
        with httpx.Client(timeout=TIMEOUT, follow_redirects=True, headers=cabecalho) as cliente:
            r = cliente.get(url, params=params or None)
            r.raise_for_status()
            return r.json() if json_ else r.text

    def _inmet(self):
        agora = self._agora()
        try:
            alertas = parse_inmet_json(self._get(INMET_JSON, navegador=True), agora)
            return alertas
        except Exception as erro:
            log.warning("INMET JSON falhou (%s); tentando o RSS com CAP", type(erro).__name__)
        links = parse_inmet_rss(self._get(INMET_RSS, navegador=True, json_=False))[:80]
        def um(link):
            try:
                return parse_cap(self._get(link, navegador=True, json_=False), "INMET", "https://alertas2.inmet.gov.br/", "Brasil", "brasil", agora, link)
            except Exception:
                return []
        with ThreadPoolExecutor(max_workers=8) as pool:
            return [a for lista in pool.map(um, links) for a in lista][:MAX_POR_FONTE]

    def _nws(self):
        return parse_nws(self._get(NWS_URL, json_=True), self._agora())

    def _meteoalarm(self):
        agora = self._agora()
        def um(pais):
            try:
                return parse_meteoalarm(self._get(METEOALARM_URL.format(pais=pais)), pais, agora)
            except Exception:
                return None
        with ThreadPoolExecutor(max_workers=10) as pool:
            resultados = list(pool.map(um, METEOALARM_PAISES))
        if all(r is None for r in resultados):
            raise FonteIndisponivel("MeteoAlarm")
        return [a for r in resultados if r for a in r][:MAX_POR_FONTE]

    def _tsunami(self):
        saida, erros = [], 0
        for url in TSUNAMI_URLS:
            try:
                saida += parse_tsunami(self._get(url, json_=False), self._agora())
            except Exception:
                erros += 1
        if erros == len(TSUNAMI_URLS):
            raise FonteIndisponivel("tsunami")
        return saida

    def _usgs(self):
        return parse_usgs(self._get(USGS_URL), self._agora())

    def _open_meteo(self, pontos):
        return parse_open_meteo(self._get(
            OPEN_METEO_URL, latitude=",".join(str(p[0]) for p in pontos), longitude=",".join(str(p[1]) for p in pontos),
            daily="weather_code,precipitation_sum,wind_gusts_10m_max,temperature_2m_max,temperature_2m_min",
            forecast_days=7, timezone="auto", wind_speed_unit="kmh"), len(pontos))

    # --- cache
    def _fonte(self, chave, buscar, agora):
        salvo = self._cache.get(chave)
        if salvo and agora - salvo[0] < CACHE_ALERTAS:
            return salvo[1], "sucesso", salvo[0]
        try:
            alertas = buscar()
            self._cache[chave] = (agora, alertas)
            return alertas, "sucesso", agora
        except Exception as erro:
            log.warning("Alertas oficiais: fonte %s falhou (%s)", chave, type(erro).__name__)
            if salvo:
                return salvo[1], "antigo", salvo[0]
            return [], "indisponivel", None

    def _obter_previsao(self, pontos, agora):
        """Previsão por ponto, com cache de 30 min por ponto. Busca de uma vez só os que faltam."""
        faltam = [p for p in dict.fromkeys(pontos) if not (p in self._previsao and agora - self._previsao[p][0] < CACHE_PREVISAO)]
        estado = "sucesso"
        for i in range(0, len(faltam), 50):
            lote = faltam[i:i + 50]
            try:
                for p, dias in zip(lote, self._buscar_previsao(lote)):
                    self._previsao[p] = (agora, dias)
            except Exception as erro:
                log.warning("Previsão Open-Meteo falhou (%s)", type(erro).__name__)
                estado = "antigo" if any(p in self._previsao for p in lote) else "indisponivel"
        return {p: self._previsao[p][1] for p in pontos if p in self._previsao}, estado if pontos else "sucesso"

    def obter(self, lugares=None):
        """lugares: os da pessoa (vêm do aparelho dela a cada pedido; o servidor não guarda)."""
        meus = normalizar_lugares(lugares)
        with self._lock:  # um pedido de cada vez: os outros esperam e usam o cache
            agora = self._agora()
            with ThreadPoolExecutor(max_workers=len(self._buscadores) or 1) as pool:
                futuros = {k: pool.submit(self._fonte, k, b, agora) for k, (_, b) in self._buscadores.items()}
                resultados = {k: f.result() for k, f in futuros.items()}
            previsao, estado_prev = self._obter_previsao([chave_ponto(c) for c in meus + self._padrao], agora)
        fontes, alertas = [], []
        for chave, (nome, _) in self._buscadores.items():
            lista, estado, momento = resultados[chave]
            alertas += [a for a in lista if not _expirado(a.get("fim"), agora)]
            fontes.append({"id": chave, "nome": nome, "estado": estado, "quantidade": len(lista),
                           "atualizadoEm": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(momento)) if momento else None})
        fontes.append({"id": "open-meteo", "nome": "Open-Meteo (previsão 7 dias)", "estado": estado_prev, "quantidade": len(previsao), "atualizadoEm": None})
        extras = []
        if self._gdacs:
            try:
                extras = gdacs_para_oficiais(self._gdacs())
            except Exception:
                extras = []
        alertas.sort(key=lambda a: (a["quando"] != "agora", NIVEL_ORDEM.get(a["severidade"], 3), -(_ts(a.get("inicio")) or 0)))
        return {
            "obtidoEm": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(agora)),
            "fontes": fontes, "alertas": alertas,
            "lugares": resumo_lugares(meus, alertas + extras, previsao),
            "locaisPadrao": resumo_lugares(self._padrao, alertas + extras, previsao),
            "aviso": "Alertas oficiais de cada país. Em perigo, siga sempre a Defesa Civil local (Brasil 199).",
        }
