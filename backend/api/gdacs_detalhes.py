"""Detalhes de UM alerta do GDACS (ONU + Comissão Europeia) para mostrar dentro do Omni.

Em vez de mandar a pessoa para o site do GDACS (em inglês, com banner de cookies), o backend busca
na API pública do GDACS e devolve só o que a tela precisa:
  - nível e pontuação do alerta, datas, países e intensidade;
  - a área afetada / trajetória em GeoJSON (simplificada, para desenhar no mapa);
  - população exposta, quando o GDACS informa (estimativa de modelo, não contagem de atingidos).

Tudo é opcional: se uma parte falhar, devolve o resto. Cache de 15 min por evento.
"""
import logging
import re
import threading
import time

log = logging.getLogger("uvicorn.error")

API = "https://www.gdacs.org/gdacsapi/api"
TIPOS = {"FL", "TC", "DR", "WF", "EQ", "VO", "TS"}
NIVEIS = {"red": "vermelho", "orange": "laranja", "green": "verde"}
CACHE_SEGUNDOS = 900
MAX_CACHE = 100
TIMEOUT = 10
MAX_PONTOS = 3000  # total de coordenadas no mapa (o GDACS às vezes manda polígonos enormes)
_HTTPS_GDACS = re.compile(r"^https://www\.gdacs\.org/")

# Rótulos da população exposta (o texto vai para a tela e é traduzido pelo sistema de idiomas)
ROTULOS_POP = {
    "pop74": "Pessoas em ventos acima de 120 km/h",
    "pop39": "Pessoas em ventos acima de 63 km/h",
    "popstormsurge": "Pessoas em área de maré de tempestade",
    "POPAFFECTED": "Pessoas na área do incêndio",
    "SUMPOP5.0": "Pessoas a até 5 km do incêndio",
}


class FonteIndisponivel(Exception):
    pass


def validar(tipo, eventid, episodeid):
    """Só aceita o que o GDACS usa: tipo de 2 letras conhecido e ids numéricos. Evita montar URL com lixo."""
    tipo = str(tipo or "").strip().upper()
    if tipo not in TIPOS:
        raise ValueError("tipo inválido")
    if not re.fullmatch(r"\d{1,10}", str(eventid or "")):
        raise ValueError("eventid inválido")
    ep = str(episodeid or "").strip()
    if ep and not re.fullmatch(r"\d{1,6}", ep):
        ep = ""  # episódio desconhecido: o GDACS usa o atual
    return tipo, str(eventid), ep


def _texto(valor, limite=200):
    if valor in (None, ""):
        return None
    texto = " ".join(str(valor).split())
    return texto[:limite] if texto else None


def _numero(valor):
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return None
    return n if n == n and n not in (float("inf"), float("-inf")) else None


def _props(evento):
    """geteventdata devolve um Feature (ou, às vezes, uma coleção com um só Feature)."""
    if not isinstance(evento, dict):
        return {}
    if isinstance(evento.get("properties"), dict):
        return evento["properties"]
    feats = evento.get("features")
    if isinstance(feats, list) and feats and isinstance(feats[0], dict):
        return feats[0].get("properties") or {}
    return {}


def resumo_evento(evento):
    p = _props(evento)
    sev = p.get("severitydata") if isinstance(p.get("severitydata"), dict) else {}
    paises = p.get("affectedcountries") if isinstance(p.get("affectedcountries"), list) else []
    url = p.get("url") if isinstance(p.get("url"), dict) else {}
    relatorio = url.get("report")
    return {
        "nome": _texto(p.get("name")) or _texto(p.get("eventname")),
        "nivel": NIVEIS.get(str(p.get("alertlevel", "")).strip().lower()),
        "pontuacao": _numero(p.get("alertscore") if p.get("alertscore") is not None else p.get("episodealertscore")),  # nota geral do evento (a do site)
        "inicio": _texto(p.get("fromdate"), 40),
        "fim": _texto(p.get("todate"), 40),
        "severidade": _texto(sev.get("severitytext")),
        "paises": [n for n in (_texto(c.get("countryname"), 60) for c in paises if isinstance(c, dict)) if n][:10],
        "link": relatorio if isinstance(relatorio, str) and _HTTPS_GDACS.match(relatorio) else None,
        "impactos": p.get("impacts") if isinstance(p.get("impacts"), list) else [],
    }


def _reduzir(coords, passo):
    """Simplifica uma lista de coordenadas pegando 1 a cada `passo` (mantém a última para fechar o polígono)."""
    if passo <= 1 or len(coords) <= 4:
        return coords
    menor = coords[::passo]
    if menor[-1] != coords[-1]:
        menor.append(coords[-1])
    return menor if len(menor) >= 4 else coords


def _arredondar(c):
    try:
        lon, lat = float(c[0]), float(c[1])
    except (TypeError, ValueError, IndexError):
        return None
    if not (-180 <= lon <= 180 and -90 <= lat <= 90):
        return None
    return [round(lon, 3), round(lat, 3)]


def _contar(geom):
    t, c = geom.get("type"), geom.get("coordinates")
    if t == "Point":
        return 1
    if t in ("LineString", "MultiPoint"):
        return len(c or [])
    if t in ("Polygon", "MultiLineString"):
        return sum(len(a or []) for a in c or [])
    if t == "MultiPolygon":
        return sum(len(a or []) for p in c or [] for a in p or [])
    return 0


def _limpar(geom, passo):
    t, c = geom.get("type"), geom.get("coordinates")
    try:
        if t == "Point":
            p = _arredondar(c)
            return {"type": t, "coordinates": p} if p else None
        if t in ("LineString", "MultiPoint"):
            pts = [p for p in (_arredondar(x) for x in _reduzir(list(c), passo)) if p]
            return {"type": t, "coordinates": pts} if len(pts) >= (2 if t == "LineString" else 1) else None
        if t in ("Polygon", "MultiLineString"):
            aneis = [[p for p in (_arredondar(x) for x in _reduzir(list(a), passo)) if p] for a in c]
            aneis = [a for a in aneis if len(a) >= (4 if t == "Polygon" else 2)]
            return {"type": t, "coordinates": aneis} if aneis else None
        if t == "MultiPolygon":
            polis = []
            for poli in c:
                aneis = [[p for p in (_arredondar(x) for x in _reduzir(list(a), passo)) if p] for a in poli]
                aneis = [a for a in aneis if len(a) >= 4]
                if aneis:
                    polis.append(aneis)
            return {"type": t, "coordinates": polis} if polis else None
    except TypeError:
        return None
    return None


def area_afetada(colecao):
    """Mantém só a geometria, mais a classe do GDACS (Poly_Red, Poly_Affected, linha da trajetória…), e simplifica."""
    if not isinstance(colecao, dict) or not isinstance(colecao.get("features"), list):
        return None
    feats = [f for f in colecao["features"] if isinstance(f, dict) and isinstance(f.get("geometry"), dict)]
    total = sum(_contar(f["geometry"]) for f in feats)
    passo = max(1, -(-total // MAX_PONTOS))  # divisão arredondando para cima
    saida = []
    for f in feats:
        geom = _limpar(f["geometry"], passo)
        if not geom:
            continue
        props = f.get("properties") if isinstance(f.get("properties"), dict) else {}
        classe = _texto(props.get("Class") or props.get("class") or props.get("polygonlabel"), 40) or ""
        saida.append({"type": "Feature", "geometry": geom, "properties": {"classe": classe}})
    return {"type": "FeatureCollection", "features": saida} if saida else None


def _maximos(dado, chaves, achados=None, profundidade=0):
    """Procura as chaves de população em qualquer lugar do JSON (o formato varia por tipo de evento) e guarda o maior valor."""
    achados = {} if achados is None else achados
    if profundidade > 8:
        return achados
    if isinstance(dado, dict):
        for k, v in dado.items():
            if k in chaves:
                n = _numero(v)
                if n is not None and n >= 0:
                    achados[k] = max(achados.get(k, 0), n)
            elif isinstance(v, (dict, list)):
                _maximos(v, chaves, achados, profundidade + 1)
    elif isinstance(dado, list):
        for v in dado[:5000]:
            _maximos(v, chaves, achados, profundidade + 1)
    return achados


def populacao(dados_impacto):
    achados = {}
    for dado in dados_impacto:
        _maximos(dado, set(ROTULOS_POP), achados)
    return [{"chave": k, "rotulo": ROTULOS_POP[k], "valor": int(round(v))} for k, v in achados.items() if v > 0]


def _links_impacto(impactos):
    """URLs de timeline/impacto que o próprio GDACS indica no evento (só do domínio do GDACS)."""
    links = []
    for imp in impactos:
        res = imp.get("resource") if isinstance(imp, dict) else None
        if not isinstance(res, dict):
            continue
        for chave in ("timeline", "impact"):
            url = res.get(chave)
            if isinstance(url, str) and _HTTPS_GDACS.match(url) and url not in links:
                links.append(url)
    return links[:3]


class DetalhesGdacs:
    def __init__(self, buscar_json=None, agora=time.time):
        self._buscar_json = buscar_json or self._get
        self._agora = agora
        self._lock = threading.Lock()
        self._cache = {}

    @staticmethod
    def _get(url):
        import httpx  # importado aqui para os testes rodarem sem a biblioteca
        with httpx.Client(timeout=TIMEOUT, follow_redirects=True, headers={"Accept": "application/json"}) as client:
            resposta = client.get(url)
            resposta.raise_for_status()
            return resposta.json()

    def _tentar(self, url):
        try:
            return self._buscar_json(url)
        except Exception as erro:
            log.warning("GDACS detalhes %s falhou: %s", url.split("?")[0], type(erro).__name__)
            return None

    def obter(self, tipo, eventid, episodeid=""):
        tipo, eventid, episodeid = validar(tipo, eventid, episodeid)
        chave = (tipo, eventid, episodeid)
        agora = self._agora()
        with self._lock:
            guardado = self._cache.get(chave)
            if guardado and agora - guardado[0] < CACHE_SEGUNDOS:
                return guardado[1]

        ep = f"&episodeid={episodeid}" if episodeid else ""
        evento = self._tentar(f"{API}/events/geteventdata?eventtype={tipo}&eventid={eventid}{ep}")
        geometria = self._tentar(f"{API}/polygons/getgeometry?eventtype={tipo}&eventid={eventid}{ep}")
        if evento is None and geometria is None:
            with self._lock:
                if guardado:  # GDACS fora: devolve o último bom, mesmo velho
                    return {**guardado[1], "estado": "antigo"}
            raise FonteIndisponivel("GDACS indisponível")

        info = resumo_evento(evento)
        impactos = [d for d in (self._tentar(u) for u in _links_impacto(info.pop("impactos"))) if d is not None]
        link = info.pop("link") or f"https://www.gdacs.org/report.aspx?eventtype={tipo}&eventid={eventid}"
        resultado = {
            "estado": "sucesso", "fonte": "GDACS (ONU / Comissão Europeia)", "fonteUrl": link,
            "obtidoEm": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(agora)),
            "tipo": tipo, **info,
            "populacao": populacao(impactos + ([evento] if evento else [])),
            "area": area_afetada(geometria),
        }
        with self._lock:
            if len(self._cache) >= MAX_CACHE:
                self._cache.pop(min(self._cache, key=lambda k: self._cache[k][0]))
            self._cache[chave] = (agora, resultado)
        return resultado
