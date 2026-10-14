"""Testes OFFLINE (sem rede). Rodar na raiz:  python -m unittest discover -s backend/api/tests -v
Usam dados de exemplo no formato das fontes. Nao provam que as fontes reais respondem."""
import unittest
from unittest import mock

from backend.api import hazards

USGS = {"features": [
    {"id": "a", "properties": {"mag": 6.1, "place": "Panama", "time": 1760000000000, "url": "https://x", "tsunami": 1},
     "geometry": {"coordinates": [-80.1, 8.2, 25.0]}},
    {"id": "b", "properties": {"mag": 5.0, "place": "Chile", "time": 1760000000000, "tsunami": 0},
     "geometry": {"coordinates": [-70.0, -23.0, 40.0]}},
    {"id": "c", "properties": {"mag": None, "time": 1}, "geometry": {"coordinates": [0, 0, 0]}},
    {"id": "d"}]}
ENSO_HTML = ("<html>NOAA 8 October 2026 <h2>ENSO DISCUSSION</h2><p>10 September 2026</p>"
             "<p>ENSO Alert System Status: El Niño Advisory</p><p>Synopsis: El Niño is strengthening, with a "
             "greater than 90% chance of a very strong event.</p><p>Outro.</p></html>")


class Base(unittest.TestCase):
    def setUp(self):
        hazards._cache.clear()


class TestEarthquakes(Base):
    def test_parse_skips_invalid_and_flags_tsunami(self):
        items = hazards.parse_earthquakes(USGS)
        self.assertEqual(len(items), 2)
        self.assertTrue(items[0]["tsunamiSignal"])
        self.assertFalse(items[1]["tsunamiSignal"])
        self.assertEqual(items[0]["coordinates"], {"latitude": 8.2, "longitude": -80.1})

    def test_invalid_format_raises(self):
        with self.assertRaises(hazards.InvalidResponse):
            hazards.parse_earthquakes({"x": 1})

    def test_tsunami_endpoint_only_flagged_and_warns(self):
        with mock.patch.object(hazards, "_download", return_value=USGS):
            r = hazards.get_tsunami_signals()
        self.assertEqual([e["id"] for e in r["items"]], ["a"])
        self.assertIn("NÃO confirma tsunami", r["notice"])
        self.assertFalse(r["isSimulation"])
        self.assertFalse(r["riskCalculated"])
        self.assertEqual(r["state"], "success")

    def test_empty_state(self):
        with mock.patch.object(hazards, "_download", return_value={"features": []}):
            self.assertEqual(hazards.get_earthquakes()["state"], "empty")

    def test_periodo_ao_vivo_usa_o_feed_certo(self):
        with mock.patch.object(hazards, "_download", return_value=USGS) as dl:
            r = hazards.get_earthquakes("dia")
            hazards.get_earthquakes("mes")
        urls = [c.args[0] for c in dl.call_args_list]
        self.assertTrue(urls[0].endswith("4.5_day.geojson"))
        self.assertTrue(urls[1].endswith("4.5_month.geojson"))
        self.assertEqual(r["periodo"], "dia")
        self.assertIn("últimas 24 horas", r["notice"])
        self.assertFalse(r["isSimulation"])

    def test_padrao_continua_a_semana(self):
        with mock.patch.object(hazards, "_download", return_value=USGS) as dl:
            r = hazards.get_earthquakes()
        self.assertTrue(dl.call_args.args[0].endswith("4.5_week.geojson"))
        self.assertEqual(r["notice"], hazards.QUAKE_NOTICE)

    def test_mes_anterior_consulta_por_data(self):
        with mock.patch.object(hazards, "_download", return_value=USGS) as dl:
            r = hazards.get_earthquakes(mes="2025-12")
        url, params = dl.call_args.args[0], dl.call_args.args[1]
        self.assertEqual(url, hazards.URL_USGS_CONSULTA)
        self.assertEqual((params["starttime"], params["endtime"], params["minmagnitude"]), ("2025-12-01", "2026-01-01", "4.5"))
        self.assertEqual(r["mes"], "2025-12")
        self.assertIn("dezembro de 2025", r["notice"])

    def test_mes_invalido_ou_ainda_nao_encerrado(self):
        from datetime import datetime, timezone
        hoje = datetime(2026, 10, 14, tzinfo=timezone.utc)
        self.assertEqual(hazards.intervalo_do_mes("2026-09", hoje)[:2], ("2026-09-01", "2026-10-01"))
        for ruim in ["2026-10", "2027-01", "2026-13", "1999-12", "set/2026", "", None]:
            with self.assertRaises(hazards.InvalidRequest, msg=str(ruim)):
                hazards.intervalo_do_mes(ruim, hoje)
        with self.assertRaises(hazards.InvalidRequest):
            hazards.get_earthquakes("ano")


class TestCache(Base):
    def test_second_call_uses_cache(self):
        with mock.patch.object(hazards, "_download", return_value=USGS) as dl:
            hazards.get_earthquakes()
            hazards.get_earthquakes()
        self.assertEqual(dl.call_count, 1)

    def test_stale_copy_when_source_fails(self):
        with mock.patch.object(hazards, "_download", return_value=USGS):
            hazards.get_earthquakes()
        key = next(iter(hazards._cache))
        hazards._cache[key] = (hazards._cache[key][0] - 1000, USGS)  # vencido, mas < 1h
        with mock.patch.object(hazards, "_download", side_effect=RuntimeError("fora")):
            r = hazards.get_earthquakes()
        self.assertEqual(r["state"], "stale")

    def test_unavailable_without_copy(self):
        with mock.patch.object(hazards, "_download", side_effect=RuntimeError("fora")):
            with self.assertRaises(hazards.SourceUnavailable):
                hazards.get_earthquakes()


class TestTornado(Base):
    def test_parse_keeps_null_geometry(self):
        geo = {"features": [{"id": "n", "properties": {"event": "Tornado Warning", "areaDesc": "Dallas, TX"},
                             "geometry": None}]}
        item = hazards.parse_nws_alerts(geo)[0]
        self.assertTrue(item["label"].startswith("AVISO"))
        self.assertIsNone(item["geometry"])

    def test_two_requests_and_notice(self):
        geo = {"features": []}
        with mock.patch.object(hazards, "_download", return_value=geo) as dl:
            r = hazards.get_tornado_alerts()
        self.assertEqual(dl.call_count, 2)
        self.assertEqual(r["state"], "empty")
        self.assertIn("EUA", r["notice"])


class TestEnso(Base):
    def test_parse(self):
        e = hazards.parse_enso(ENSO_HTML)
        self.assertEqual(e["statusOriginal"], "El Niño Advisory")
        self.assertEqual(e["publishedOn"], "10 September 2026")
        self.assertTrue(e["synopsisOriginal"].endswith("event."))
        self.assertIn("em curso", e["statusPt"])
        self.assertEqual(len(e["brazilTendencies"]), 3)

    def test_unexpected_page_raises(self):
        with self.assertRaises(hazards.InvalidResponse):
            hazards.parse_enso("<html>nada</html>")


class TestHeat(Base):
    def test_parse(self):
        one = {"daily": {"temperature_2m_max": [30, 38.5, None], "precipitation_sum": [0, 10.25, 2]}}
        out = hazards.parse_brazil_heat([one] * len(hazards.BRAZIL_CITIES))
        self.assertEqual(out[0]["maxTemperatureC7d"], 38.5)
        self.assertEqual(out[0]["rainMm7d"], 12.2)

    def test_wrong_size_raises(self):
        with self.assertRaises(hazards.InvalidResponse):
            hazards.parse_brazil_heat([{"daily": {}}])


if __name__ == "__main__":
    unittest.main()
