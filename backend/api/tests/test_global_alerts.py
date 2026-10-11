"""Testes offline dos alertas mundiais (GDACS): sem internet."""
import unittest

from backend.api.global_alerts import AlertasGlobais, FonteIndisponivel, parse


def ponto(tipo, nivel, lon, lat, **extra):
    props = {"eventtype": tipo, "alertlevel": nivel, "eventid": extra.pop("eventid", 1), "episodeid": extra.pop("episodeid", 1), **extra}
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": props}


EXEMPLO = {"type": "FeatureCollection", "features": [
    ponto("FL", "Orange", 12.5, 45.4, eventid=10, name="Flood in Italy", country="Italy", fromdate="2026-10-09T00:00:00",
          url={"report": "https://www.gdacs.org/report.aspx?eventid=10&eventtype=FL"}),
    ponto("TC", "Red", -75.0, 25.0, eventid=20, name="Hurricane X", country="Bahamas", fromdate="2026-10-08T00:00:00"),
    ponto("EQ", "Green", 140.0, 36.0, eventid=30),                       # verde: fica de fora
    ponto("XX", "Red", 0, 0, eventid=40),                                 # tipo desconhecido: fora
    ponto("WF", "Orange", -60.0, -10.0, eventid=50, fromdate="2026-10-10T00:00:00", country="Brazil"),
    ponto("WF", "Orange", -60.0, -10.0, eventid=50, fromdate="2026-10-10T00:00:00"),  # repetido: fora
    {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": []}, "properties": {"eventtype": "FL", "alertlevel": "Red"}},
    ponto("DR", "Red", 999, 0, eventid=60),                               # coordenada inválida: fora
]}


class Parse(unittest.TestCase):
    def test_so_laranja_e_vermelho_pontos_validos_sem_repetir(self):
        alertas = parse(EXEMPLO)
        self.assertEqual([a["tipo"] for a in alertas], ["TC", "WF", "FL"])  # vermelho primeiro, depois mais recentes

    def test_campos_em_portugues_e_link_seguro(self):
        italia = next(a for a in parse(EXEMPLO) if a["tipo"] == "FL")
        self.assertEqual(italia["tipoNome"], "Enchente")
        self.assertEqual(italia["nivel"], "laranja")
        self.assertEqual(italia["pais"], "Italy")
        self.assertEqual((italia["latitude"], italia["longitude"]), (45.4, 12.5))
        self.assertTrue(italia["link"].startswith("https://www.gdacs.org/"))
        furacao = next(a for a in parse(EXEMPLO) if a["tipo"] == "TC")
        self.assertIn("eventid=20", furacao["link"])  # sem url no evento: monta o link do relatório

    def test_formato_errado_falha(self):
        with self.assertRaises(ValueError):
            parse({"nada": 1})


class Cache(unittest.TestCase):
    def test_cache_de_15_min_e_ultima_resposta_boa_se_cair(self):
        relogio = [1000.0]
        chamadas = []

        def buscar():
            chamadas.append(1)
            if len(chamadas) == 2:
                raise RuntimeError("fora do ar")
            return parse(EXEMPLO)
        alertas = AlertasGlobais(buscar=buscar, agora=lambda: relogio[0])
        self.assertEqual(alertas.obter()["estado"], "sucesso")
        alertas.obter()
        self.assertEqual(len(chamadas), 1, "dentro de 15 min usa o cache")
        relogio[0] += 901
        r = alertas.obter()
        self.assertEqual(r["estado"], "antigo")
        self.assertEqual(len(r["alertas"]), 3)

    def test_sem_nada_guardado_e_fonte_fora_avisa(self):
        def buscar():
            raise RuntimeError("fora do ar")
        with self.assertRaises(FonteIndisponivel):
            AlertasGlobais(buscar=buscar).obter()


try:
    from fastapi.testclient import TestClient
except ImportError:  # pragma: no cover
    TestClient = None


@unittest.skipIf(TestClient is None, "FastAPI não instalado neste ambiente")
class Rota(unittest.TestCase):
    def cliente(self, alertas):
        from backend.api.main import create_app

        class Falso:
            pass
        return TestClient(create_app(service=Falso(), inteligencia=Falso(), alertas=alertas))

    def test_rota_devolve_alertas_e_503_quando_cai(self):
        with self.cliente(AlertasGlobais(buscar=lambda: parse(EXEMPLO))) as c:
            r = c.get("/api/v1/alerts/global")
            self.assertEqual(r.status_code, 200)
            self.assertEqual(len(r.json()["alertas"]), 3)
            self.assertEqual(r.headers["cache-control"], "no-store")

        def quebra():
            raise RuntimeError("x")
        with self.cliente(AlertasGlobais(buscar=quebra)) as c:
            r = c.get("/api/v1/alerts/global")
            self.assertEqual(r.status_code, 503)
            self.assertNotIn("Traceback", r.text)
