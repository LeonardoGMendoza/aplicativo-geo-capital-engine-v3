"""Testes OFFLINE (sem rede). Rodar na raiz:  python -m unittest discover -s backend/api/tests -t . -v
Usam dados de exemplo no formato do Overpass/Nominatim. Nao provam que as fontes reais respondem."""
import unittest
from unittest import mock

from backend.api import places
from backend.api.hazards import InvalidResponse, SourceUnavailable

ORIGIN = (-23.5505, -46.6333)


def node(i, name, lat=-23.551, lon=-46.634, **tags):
    return {"type": "node", "id": i, "lat": lat, "lon": lon, "tags": {"name": name, **tags}}


ELEMENTS = [
    node(1, "Hospital das Clínicas", amenity="hospital"),
    node(2, "UBS Sé"),
    node(3, "UPA Vergueiro", lat=-23.56),
    node(4, "Drogaria São Paulo", shop="chemist"),
    node(5, "Carrefour Express", shop="supermarket"),
    node(6, "Hotel Ibis", tourism="hotel"),
    node(7, "1º Distrito Policial", amenity="police"),
    node(8, "Bom Prato Centro"),
    node(9, "Ponto de Encontro Defesa Civil", emergency="assembly_point", lat=-23.58),
    node(10, "EE Caetano de Campos", amenity="school", lat=-23.552),
    node(11, "Casa de Acolhida", amenity="social_facility", social_facility="shelter"),
    node(12, "ONG Mãos Dadas"),
    {"type": "way", "id": 13, "center": {"lat": -23.555, "lon": -46.64}, "tags": {"name": "Pronto Socorro Municipal"}},
    node(14, "Hospital das Clínicas", amenity="hospital"),            # duplicata exata
    node(15, "Carrefour Express", lat=-23.60, shop="supermarket"),    # mesma rede, outro lugar
    node(16, "Banco Itaú", amenity="bank"),                           # fora das categorias
    {"type": "node", "id": 17, "lat": -23.5, "lon": -46.6, "tags": {}},  # sem nome
    {"type": "node", "id": 18, "tags": {"name": "Sem coordenada", "amenity": "hospital"}},
]


class Base(unittest.TestCase):
    def setUp(self):
        places._cache.clear()


class TestClassify(Base):
    def by_name(self):
        return {p["name"]: p for p in places.parse_elements(ELEMENTS, *ORIGIN)}

    def test_categories_follow_streamlit_rules(self):
        cat = {n: p["category"] for n, p in self.by_name().items()}
        self.assertEqual(cat["Hospital das Clínicas"], "hospital")
        self.assertEqual(cat["UBS Sé"], "clinic")
        self.assertEqual(cat["UPA Vergueiro"], "clinic")
        self.assertEqual(cat["Pronto Socorro Municipal"], "clinic")
        self.assertEqual(cat["Drogaria São Paulo"], "pharmacy")
        self.assertEqual(cat["Hotel Ibis"], "lodging")
        self.assertEqual(cat["1º Distrito Policial"], "police")
        self.assertEqual(cat["Bom Prato Centro"], "food")
        self.assertEqual(cat["ONG Mãos Dadas"], "ngo")
        self.assertNotIn("Banco Itaú", cat)

    def test_shelters_are_labeled_mapped_or_possible(self):
        d = self.by_name()
        self.assertEqual(d["Ponto de Encontro Defesa Civil"]["shelterKind"], "mapped")
        self.assertEqual(d["Casa de Acolhida"]["shelterKind"], "mapped")
        self.assertEqual(d["EE Caetano de Campos"]["shelterKind"], "possible")
        self.assertIn("confirmar com a Defesa Civil", d["EE Caetano de Campos"]["note"])

    def test_mapped_shelters_come_before_possible_even_if_farther(self):
        shelters = [p for p in places.parse_elements(ELEMENTS, *ORIGIN) if p["category"] == "shelter"]
        self.assertEqual([p["shelterKind"] for p in shelters], ["mapped", "mapped", "possible"])

    def test_dedup_keeps_chains_in_other_places_and_skips_invalid(self):
        items = places.parse_elements(ELEMENTS, *ORIGIN)
        names = [p["name"] for p in items]
        self.assertEqual(names.count("Hospital das Clínicas"), 1)
        self.assertEqual(names.count("Carrefour Express"), 2)
        self.assertNotIn("Sem coordenada", names)

    def test_item_shape_distance_and_osm_link(self):
        p = self.by_name()["Pronto Socorro Municipal"]
        self.assertEqual(p["id"], "way/13")
        self.assertEqual(p["osmUrl"], "https://www.openstreetmap.org/way/13")
        self.assertEqual(p["coordinates"], {"latitude": -23.555, "longitude": -46.64})
        self.assertAlmostEqual(p["distanceKm"], places.haversine_km(*ORIGIN, -23.555, -46.64), places=2)

    def test_limit_per_category_keeps_nearest(self):
        many = [node(100 + i, f"Farmácia {i}", lat=-23.55 - i * 0.001, amenity="pharmacy") for i in range(60)]
        items = places.parse_elements(many, *ORIGIN)
        self.assertEqual(len(items), 40)
        self.assertEqual(items[0]["name"], "Farmácia 0")
        self.assertTrue(all(a["distanceKm"] <= b["distanceKm"] for a, b in zip(items, items[1:])))

    def test_invalid_payload_raises(self):
        with self.assertRaises(InvalidResponse):
            places.parse_elements({"x": 1}, *ORIGIN)

    def test_query_uses_only_indexed_tags_and_server_timeout(self):
        q = places.build_query(-30.035, -51.218, 3000)
        self.assertNotIn('nwr["name"', q)  # busca por texto no nome estourava o tempo em cidades densas
        self.assertIn("(around:3000,-30.035,-51.218)", q)
        self.assertIn(f"[timeout:{places.OVERPASS_SERVER_TIMEOUT}]", q)
        self.assertGreater(places.OVERPASS_TIMEOUT, places.OVERPASS_SERVER_TIMEOUT)


class TestNearby(Base):
    def test_success_envelope_and_rounded_origin(self):
        with mock.patch.object(places, "_post_overpass", return_value={"elements": ELEMENTS}):
            r = places.get_nearby(-23.55051, -46.63329)
        self.assertEqual(r["state"], "success")
        self.assertEqual(r["origin"], {"latitude": -23.551, "longitude": -46.633})
        self.assertEqual(r["radiusKm"], 3)
        self.assertFalse(r["isSimulation"])
        self.assertFalse(r["riskCalculated"])
        self.assertIn("Não confirma funcionamento", r["notice"])
        counts = {c["id"]: c["count"] for c in r["categories"]}
        self.assertEqual(counts["clinic"], 3)
        self.assertEqual(sum(counts.values()), len(r["items"]))

    def test_few_results_expand_radius(self):
        calls = []

        def fake(server, query):
            calls.append(query)
            return {"elements": ELEMENTS if "around:15000" in query else ELEMENTS[:2]}
        with mock.patch.object(places, "_post_overpass", side_effect=fake):
            r = places.get_nearby(*ORIGIN)
        self.assertEqual(r["radiusKm"], 15)
        self.assertTrue(any("around:3000" in q for q in calls))

    def test_expansion_failure_keeps_small_radius(self):
        def fake(server, query):
            if "around:15000" in query:
                raise TimeoutError()
            return {"elements": ELEMENTS[:2]}
        with mock.patch.object(places, "_post_overpass", side_effect=fake):
            r = places.get_nearby(*ORIGIN)
        self.assertEqual(r["radiusKm"], 3)
        self.assertEqual(len(r["items"]), 2)

    def test_one_server_failing_is_tolerated(self):
        def fake(server, query):
            if server == places.OVERPASS_SERVERS[0]:
                raise ConnectionError()
            return {"elements": ELEMENTS}
        with mock.patch.object(places, "_post_overpass", side_effect=fake):
            self.assertEqual(places.get_nearby(*ORIGIN)["state"], "success")

    def test_all_servers_down_is_unavailable(self):
        with mock.patch.object(places, "_post_overpass", side_effect=ConnectionError()):
            with self.assertRaises(SourceUnavailable):
                places.get_nearby(*ORIGIN)

    def test_cache_and_stale_copy(self):
        with mock.patch.object(places, "_post_overpass", return_value={"elements": ELEMENTS}) as m:
            places.get_nearby(*ORIGIN)
            places.get_nearby(*ORIGIN)
        self.assertEqual(m.call_count, len(places.OVERPASS_SERVERS))  # uma corrida so
        with mock.patch.object(places, "_now", return_value=places._now() + places.NEARBY_TTL + 10), \
                mock.patch.object(places, "_post_overpass", side_effect=ConnectionError()):
            self.assertEqual(places.get_nearby(*ORIGIN)["state"], "stale")

    def test_empty_area(self):
        with mock.patch.object(places, "_post_overpass", return_value={"elements": []}):
            r = places.get_nearby(0.0, -30.0)
        self.assertEqual(r["state"], "empty")
        self.assertEqual(r["items"], [])

    def test_out_of_range_is_rejected(self):
        with self.assertRaises(ValueError):
            places.get_nearby(91, 0)


class TestGeocode(Base):
    RESP = [{"lat": "-30.0346", "lon": "-51.2177", "name": "Porto Alegre",
             "display_name": "Porto Alegre, Rio Grande do Sul, Brasil"},
            {"lat": "x", "lon": "1"}]

    def test_parse_and_envelope(self):
        with mock.patch.object(places, "_get_nominatim", return_value=self.RESP), \
                mock.patch.object(places.time, "sleep"):
            r = places.get_geocode("  porto   alegre ")
        self.assertEqual(r["state"], "success")
        self.assertEqual(r["query"], "porto alegre")
        self.assertEqual(len(r["items"]), 1)
        self.assertEqual(r["items"][0]["coordinates"], {"latitude": -30.0346, "longitude": -51.2177})

    def test_not_found_is_empty(self):
        with mock.patch.object(places, "_get_nominatim", return_value=[]):
            self.assertEqual(places.get_geocode("xyzxyz")["state"], "empty")

    def test_invalid_text_and_format(self):
        with self.assertRaises(ValueError):
            places.get_geocode(" a ")
        with mock.patch.object(places, "_get_nominatim", return_value={"error": 1}):
            with self.assertRaises(InvalidResponse):
                places.get_geocode("porto alegre")


if __name__ == "__main__":
    unittest.main()
