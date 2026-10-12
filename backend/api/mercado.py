"""Cotações das empresas dos ativos de referência (Yahoo Finance, público, sem chave).

Mesma lista do painel Streamlit (painel_ceo.py) + Petrobras, Toyota e Braskem, que também têm ativo na lista.
Cache de 10 min; se o Yahoo falhar, devolve a última resposta boa (até 24 h) marcada como antiga.
Só mostra preço e variação: não é recomendação de investimento.
"""
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor


log = logging.getLogger("uvicorn.error")

URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) Omni-EcoRescue/1.0"
CACHE_SEGUNDOS = 600
MAX_ANTIGO = 86400
TIMEOUT = 12

# nome, ticker, setor, ids dos ativos de referência ligados (assets.json)
EMPRESAS = [
    ("Petróleo Brent", "BZ=F", "Petróleo (barril)", []),
    ("Petrobras", "PBR", "Petróleo · Brasil", ["mvp-petrobras-pre-sal"]),
    ("ExxonMobil", "XOM", "Petróleo · EUA", ["mvp-exxon-golfo"]),
    ("Chevron", "CVX", "Petróleo · EUA", ["mvp-chevron-golfo", "mvp-chevron-california"]),
    ("Shell", "SHEL", "Petróleo · Europa", []),
    ("BP", "BP", "Petróleo · Reino Unido", ["mvp-bp-pacifico"]),
    ("Vale", "VALE", "Mineração · Brasil", ["mvp-vale-carajas"]),
    ("BHP", "BHP", "Mineração · Austrália", ["mvp-bhp-escondida"]),
    ("Rio Tinto", "RIO", "Mineração · Reino Unido", []),
    ("Bunge", "BG", "Agronegócio", []),
    ("Raízen", "RAIZ4.SA", "Energia · Brasil", ["mvp-raizen-sp"]),
    ("Braskem", "BAK", "Petroquímica · Brasil", ["mvp-petroquimico-triunfo"]),
    ("Toyota", "TM", "Indústria · Japão", ["mvp-toyota-toquio"]),
]


class MercadoIndisponivel(Exception):
    pass


def _numero(valor):
    try:
        v = float(valor)
    except (TypeError, ValueError):
        return None
    return v if v == v and v not in (float("inf"), float("-inf")) else None


def parse_chart(dados):
    """Lê a resposta do Yahoo (chart v8): preço, fechamento anterior, moeda, horário e os fechamentos dos últimos dias."""
    try:
        r = dados["chart"]["result"][0]
        meta = r["meta"]
    except (KeyError, IndexError, TypeError):
        raise ValueError("formato inesperado") from None
    preco = _numero(meta.get("regularMarketPrice"))
    if preco is None:
        raise ValueError("sem preço")
    try:
        fechamentos = [_numero(v) for v in r["indicators"]["quote"][0]["close"]]
    except (KeyError, IndexError, TypeError):
        fechamentos = []
    serie = [round(v, 4) for v in fechamentos if v is not None][-30:]
    anterior = _numero(meta.get("previousClose"))
    if anterior is None and len(serie) >= 2:
        anterior = serie[-2]
    if anterior is None:
        anterior = _numero(meta.get("chartPreviousClose"))
    base_mes = serie[0] if serie else None
    return {
        "preco": round(preco, 4),
        "moeda": str(meta.get("currency") or "USD")[:5],
        "variacaoDia": round((preco / anterior - 1) * 100, 2) if anterior else None,
        "variacaoMes": round((preco / base_mes - 1) * 100, 2) if base_mes else None,
        "serie": serie,
        "horario": int(meta["regularMarketTime"]) if isinstance(meta.get("regularMarketTime"), (int, float)) else None,
    }


def _baixar(ticker, cliente):
    resp = cliente.get(URL.format(ticker=ticker), params={"range": "1mo", "interval": "1d"})
    resp.raise_for_status()
    return parse_chart(resp.json())


class Mercado:
    def __init__(self, baixar=None, relogio=time.time):
        self._baixar = baixar
        self._relogio = relogio
        self._lock = threading.Lock()
        self._cache = None  # (ts, resposta)

    def _consultar(self):
        def um(empresa, cliente):
            nome, ticker, setor, ativos = empresa
            base = {"nome": nome, "ticker": ticker, "setor": setor, "ativos": ativos}
            try:
                dados = self._baixar(ticker) if self._baixar else _baixar(ticker, cliente)
                return {**base, **dados, "ok": True}
            except Exception as erro:  # uma empresa fora não derruba as outras
                log.info("Yahoo sem %s: %s", ticker, type(erro).__name__)
                return {**base, "ok": False}

        if self._baixar:
            with ThreadPoolExecutor(max_workers=6) as pool:
                itens = list(pool.map(lambda e: um(e, None), EMPRESAS))
        else:
            import httpx  # import tardio: os testes rodam sem rede
            with httpx.Client(timeout=TIMEOUT, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}, follow_redirects=True) as cliente:
                with ThreadPoolExecutor(max_workers=6) as pool:
                    itens = list(pool.map(lambda e: um(e, cliente), EMPRESAS))
        if not any(i["ok"] for i in itens):
            raise MercadoIndisponivel("nenhuma cotação")
        return itens

    def obter(self):
        agora = self._relogio()
        with self._lock:
            hit = self._cache
        if hit and agora - hit[0] < CACHE_SEGUNDOS:
            return {**hit[1], "antigo": False}
        try:
            itens = self._consultar()
        except Exception:
            if hit and agora - hit[0] < CACHE_SEGUNDOS + MAX_ANTIGO:
                return {**hit[1], "antigo": True}
            raise MercadoIndisponivel("Yahoo Finance indisponível") from None
        resposta = {"fonte": "Yahoo Finance", "fonteUrl": "https://finance.yahoo.com/", "obtidoEm": int(agora), "empresas": itens}
        with self._lock:
            self._cache = (agora, resposta)
        return {**resposta, "antigo": False}
