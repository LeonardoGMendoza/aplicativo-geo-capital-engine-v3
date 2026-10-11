"""Alertas mundiais de desastres do GDACS (ONU + Comissão Europeia), sem chave.

GDACS = Global Disaster Alert and Coordination System: enchentes, ciclones tropicais, secas,
incêndios florestais, terremotos e vulcões no mundo todo, com nível verde/laranja/vermelho.
Mostramos só laranja e vermelho. Cache de 15 min; se o GDACS cair, devolve a última resposta boa.
"""
import logging
import threading
import time

import httpx

log = logging.getLogger("uvicorn.error")

# Endpoints públicos da API do GDACS, tentados em ordem (GeoJSON com um ponto por evento).
URLS = [
    "https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP",
    "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP",
]
TIPOS = {"FL": "Enchente", "TC": "Ciclone tropical", "DR": "Seca", "WF": "Incêndio florestal",
         "EQ": "Terremoto", "VO": "Vulcão", "TS": "Tsunami"}
NIVEIS = {"red": "vermelho", "orange": "laranja"}
CACHE_SEGUNDOS = 900
TIMEOUT = 20
MAX_ALERTAS = 200


class FonteIndisponivel(Exception):
    pass


def _texto(valor):
    return str(valor).strip() if valor not in (None, "") else None


def parse(geojson):
    """Converte o GeoJSON do GDACS na nossa lista. Ignora o que não for ponto ou não for laranja/vermelho."""
    if not isinstance(geojson, dict) or not isinstance(geojson.get("features"), list):
        raise ValueError("formato inesperado")
    alertas, vistos = [], set()
    for feature in geojson["features"]:
        props = feature.get("properties") or {}
        geometria = feature.get("geometry") or {}
        nivel = NIVEIS.get(str(props.get("alertlevel", "")).strip().lower())
        tipo = str(props.get("eventtype", "")).strip().upper()
        if not nivel or tipo not in TIPOS or geometria.get("type") != "Point":
            continue
        try:
            lon, lat = float(geometria["coordinates"][0]), float(geometria["coordinates"][1])
        except (KeyError, IndexError, TypeError, ValueError):
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        chave = (tipo, props.get("eventid"), props.get("episodeid"))
        if chave in vistos:
            continue
        vistos.add(chave)
        url = props.get("url") or {}
        link = url.get("report") if isinstance(url, dict) else None
        if not link and props.get("eventid"):
            link = f"https://www.gdacs.org/report.aspx?eventtype={tipo}&eventid={props.get('eventid')}"
        alertas.append({
            "id": f"{tipo}-{props.get('eventid')}-{props.get('episodeid')}",
            "tipo": tipo, "tipoNome": TIPOS[tipo], "nivel": nivel,
            "nome": _texto(props.get("name")) or _texto(props.get("eventname")) or TIPOS[tipo],
            "pais": _texto(props.get("country")),
            "inicio": _texto(props.get("fromdate")), "fim": _texto(props.get("todate")),
            "latitude": round(lat, 4), "longitude": round(lon, 4),
            "link": link if isinstance(link, str) and link.startswith("https://") else None,
        })
    alertas.sort(key=lambda a: a["inicio"] or "", reverse=True)  # mais recentes primeiro
    alertas.sort(key=lambda a: a["nivel"] != "vermelho")  # vermelhos no topo (ordenação estável)
    return alertas[:MAX_ALERTAS]


class AlertasGlobais:
    def __init__(self, buscar=None, agora=time.time):
        self._buscar = buscar or self._buscar_gdacs
        self._agora = agora
        self._lock = threading.Lock()
        self._cache = None  # (momento, resultado)

    def _buscar_gdacs(self):
        ultimo_erro = None
        with httpx.Client(timeout=TIMEOUT, follow_redirects=True, headers={"Accept": "application/json"}) as client:
            for url in URLS:
                try:
                    resposta = client.get(url)
                    resposta.raise_for_status()
                    return parse(resposta.json())
                except Exception as erro:  # tenta o próximo endpoint
                    ultimo_erro = erro
                    log.warning("GDACS %s falhou: %s", url, type(erro).__name__)
        raise FonteIndisponivel(type(ultimo_erro).__name__ if ultimo_erro else "sem resposta")

    def obter(self):
        agora = self._agora()
        with self._lock:
            if self._cache and agora - self._cache[0] < CACHE_SEGUNDOS:
                return {**self._cache[1], "estado": "sucesso"}
        try:
            alertas = self._buscar()
        except Exception:
            with self._lock:
                if self._cache:  # GDACS fora do ar: mostra a última lista boa, marcada como antiga
                    return {**self._cache[1], "estado": "antigo"}
            raise FonteIndisponivel("GDACS indisponível")
        resultado = {"fonte": "GDACS (ONU / Comissão Europeia)", "fonteUrl": "https://www.gdacs.org/",
                     "obtidoEm": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(agora)),
                     "alertas": alertas, "isSimulation": False}
        with self._lock:
            self._cache = (agora, resultado)
        return {**resultado, "estado": "sucesso"}
