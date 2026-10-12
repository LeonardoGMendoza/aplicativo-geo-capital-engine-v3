import unittest

from backend.api.mercado import EMPRESAS, Mercado, MercadoIndisponivel, parse_chart

try:
    from fastapi.testclient import TestClient
except ImportError:  # pragma: no cover
    TestClient = None


def chart(preco=110.0, anterior=100.0, fechamentos=(90.0, None, 100.0, 110.0), moeda="USD"):
    return {"chart": {"result": [{"meta": {"regularMarketPrice": preco, "previousClose": anterior, "currency": moeda, "regularMarketTime": 1791800000},
                                  "indicators": {"quote": [{"close": list(fechamentos)}]}}]}}


class ParseChart(unittest.TestCase):
    def test_price_daily_and_monthly_change(self):
        d = parse_chart(chart())
        self.assertEqual(d["preco"], 110.0)
        self.assertEqual(d["variacaoDia"], 10.0)
        self.assertEqual(d["variacaoMes"], 22.22)
        self.assertEqual(d["serie"], [90.0, 100.0, 110.0])  # buracos (None) saem da série
        self.assertEqual(d["moeda"], "USD")

    def test_without_previous_close_uses_series(self):
        d = parse_chart(chart(anterior=None, fechamentos=(100.0, 105.0, 110.0)))
        self.assertEqual(d["variacaoDia"], 4.76)

    def test_wrong_shapes_fail(self):
        for ruim in ({}, {"chart": {"result": []}}, {"chart": {"result": [{"meta": {}}]}}, None):
            with self.assertRaises(ValueError):
                parse_chart(ruim)


class MercadoCache(unittest.TestCase):
    def test_one_company_down_does_not_drop_the_others_and_cache_is_used(self):
        chamadas = []
        def baixar(t):
            chamadas.append(t)
            if t == "BP":
                raise RuntimeError("fora")
            return parse_chart(chart())
        agora = [1000.0]
        m = Mercado(baixar=baixar, relogio=lambda: agora[0])
        r = m.obter()
        self.assertEqual(len(r["empresas"]), len(EMPRESAS))
        bp = next(e for e in r["empresas"] if e["ticker"] == "BP")
        self.assertFalse(bp["ok"]); self.assertNotIn("preco", bp)
        self.assertTrue(next(e for e in r["empresas"] if e["ticker"] == "VALE")["ok"])
        n = len(chamadas)
        agora[0] += 60
        m.obter()
        self.assertEqual(len(chamadas), n, "dentro de 10 min usa o cache")

    def test_source_down_returns_last_good_as_old_then_fails(self):
        estado = {"fora": False}
        def baixar(t):
            if estado["fora"]:
                raise RuntimeError("fora")
            return parse_chart(chart())
        agora = [1000.0]
        m = Mercado(baixar=baixar, relogio=lambda: agora[0])
        m.obter()
        estado["fora"] = True
        agora[0] += 700
        self.assertTrue(m.obter()["antigo"])
        agora[0] += 90000
        with self.assertRaises(MercadoIndisponivel):
            m.obter()

    def test_every_linked_asset_exists_in_catalog(self):
        import json, pathlib
        ids = {a["id"] for a in json.loads((pathlib.Path(__file__).parents[1] / "assets.json").read_text(encoding="utf-8"))}
        for _, _, _, ativos in EMPRESAS:
            for a in ativos:
                self.assertIn(a, ids)


@unittest.skipIf(TestClient is None, "FastAPI não instalado neste ambiente")
class Rota(unittest.TestCase):
    def test_route_ok_and_unavailable(self):
        from backend.api.main import create_app
        class Fake:
            def __init__(self, falha): self.falha = falha
            def obter(self):
                if self.falha: raise MercadoIndisponivel("x")
                return {"fonte": "Yahoo Finance", "empresas": [{"ticker": "VALE", "ok": True, "preco": 13.5}], "antigo": False}
        with TestClient(create_app(service=object(), inteligencia=object(), mercado=Fake(False))) as c:
            r = c.get("/api/v1/mercado")
            self.assertEqual(r.status_code, 200); self.assertEqual(r.json()["empresas"][0]["ticker"], "VALE")
        with TestClient(create_app(service=object(), inteligencia=object(), mercado=Fake(True))) as c:
            r = c.get("/api/v1/mercado")
            self.assertEqual(r.status_code, 503); self.assertIn("Yahoo", r.json()["error"]["message"])


if __name__ == "__main__":
    unittest.main()
