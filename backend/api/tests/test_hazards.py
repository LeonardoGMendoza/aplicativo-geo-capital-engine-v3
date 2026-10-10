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
