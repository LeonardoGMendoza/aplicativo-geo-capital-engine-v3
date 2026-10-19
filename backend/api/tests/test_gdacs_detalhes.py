"""Testes offline dos detalhes de um alerta do GDACS: sem internet."""
import unittest

from backend.api.gdacs_detalhes import DetalhesGdacs, FonteIndisponivel, area_afetada, populacao, resumo_evento, validar

EVENTO = {"type": "Feature", "geometry": {"type": "Point", "coordinates": [145.0, 14.0]}, "properties": {
    "eventtype": "TC", "eventid": 1001338, "name": "CHAMPI-26", "alertlevel": "Red", "alertscore": 2.5, "episodealertscore": 1,
    "fromdate": "2026-10-14T00:00:00", "todate": "2026-10-19T00:00:00",
    "severitydata": {"severity": 278, "severitytext": "Hurricane/Typhoon > 74 mph (maximum wind speed of 278 km/h)"},
    "affectedcountries": [{"countryname": "Guam"}, {"countryname": "Japan"}, {"x": 1}],
    "url": {"report": "https://www.gdacs.org/report.aspx?eventid=1001338&episodeid=20&eventtype=TC"},
    "impacts": [{"resource": {"timeline": "https://www.gdacs.org/gdacsapi/api/export/gettimeline?id=1",
                              "evil": "https://exemplo.com/x"}},
                {"resource": {"timeline": "https://exemplo.com/nao-gdacs"}}]}}

GEOMETRIA = {"type": "FeatureCollection", "features": [
    {"type": "Feature", "properties": {"Class": "Poly_Red"},
     "geometry": {"type": "Polygon", "coordinates": [[[144.123456, 13.5], [146, 13.5], [146, 15], [144, 15], [144.123456, 13.5]]]}},
    {"type": "Feature", "properties": {"Class": "Line_Line_1"},
     "geometry": {"type": "LineString", "coordinates": [[140, 10], [142, 12], [145, 14]]}},
    {"type": "Feature", "properties": {"Class": "Point_Centroid"}, "geometry": {"type": "Point", "coordinates": [999, 0]}},  # inválido: fora
]}

TIMELINE = {"channel": {"item": [{"pop39": "120000", "pop74": 5000}, {"pop39": 300000, "pop74": "abc"}]}}


class Funcoes(unittest.TestCase):
    def test_validar(self):
        self.assertEqual(validar("tc", "1001338", "20"), ("TC", "1001338", "20"))
        self.assertEqual(validar("TC", "1", "None"), ("TC", "1", ""))
        for ruim in [("XX", "1", ""), ("TC", "1;drop", ""), ("TC", "", ""), ("TC", "../x", "")]:
            with self.assertRaises(ValueError):
                validar(*ruim)

    def test_resumo_evento(self):
        r = resumo_evento(EVENTO)
        self.assertEqual(r["nivel"], "vermelho")
        self.assertEqual(r["pontuacao"], 2.5)
        self.assertEqual(r["paises"], ["Guam", "Japan"])
        self.assertIn("278 km/h", r["severidade"])
        self.assertTrue(r["link"].startswith("https://www.gdacs.org/"))
        self.assertEqual(resumo_evento(None)["nivel"], None)

    def test_area_simplificada_e_valida(self):
        a = area_afetada(GEOMETRIA)
        self.assertEqual([f["properties"]["classe"] for f in a["features"]], ["Poly_Red", "Line_Line_1"])
        self.assertEqual(a["features"][0]["geometry"]["coordinates"][0][0], [144.123, 13.5])
        self.assertIsNone(area_afetada({"nada": 1}))

    def test_area_grande_e_reduzida(self):
        anel = [[i * 0.001, 0] for i in range(20000)] + [[0, 0]]
        a = area_afetada({"features": [{"geometry": {"type": "Polygon", "coordinates": [anel]}, "properties": {}}]})
        self.assertLessEqual(len(a["features"][0]["geometry"]["coordinates"][0]), 3100)

    def test_populacao_pega_o_maior(self):
        pop = {p["chave"]: p["valor"] for p in populacao([TIMELINE])}
        self.assertEqual(pop, {"pop39": 300000, "pop74": 5000})
        self.assertEqual(populacao([{"nada": 1}]), [])


class Servico(unittest.TestCase):
    def fake(self, respostas, chamadas):
        def buscar(url):
            chamadas.append(url)
            for trecho, resp in respostas.items():
                if trecho in url:
                    if isinstance(resp, Exception):
                        raise resp
                    return resp
            raise RuntimeError("404")
        return buscar

    def test_tudo_junto_so_busca_links_do_gdacs(self):
        chamadas = []
        s = DetalhesGdacs(self.fake({"geteventdata": EVENTO, "getgeometry": GEOMETRIA, "gettimeline": TIMELINE}, chamadas), agora=lambda: 1000.0)
        r = s.obter("TC", "1001338", "20")
        self.assertEqual(r["estado"], "sucesso")
        self.assertEqual(r["nivel"], "vermelho")
        self.assertEqual(len(r["area"]["features"]), 2)
        self.assertEqual({p["chave"] for p in r["populacao"]}, {"pop39", "pop74"})
        self.assertNotIn("impactos", r)
        self.assertTrue(all(u.startswith("https://www.gdacs.org/") for u in chamadas))
        self.assertIn("episodeid=20", chamadas[0])

    def test_parte_falhando_devolve_o_resto(self):
        s = DetalhesGdacs(self.fake({"geteventdata": RuntimeError("x"), "getgeometry": GEOMETRIA}, []), agora=lambda: 1.0)
        r = s.obter("TC", "5")
        self.assertIsNone(r["nivel"])
        self.assertEqual(r["populacao"], [])
        self.assertIsNotNone(r["area"])
        self.assertIn("eventid=5", r["fonteUrl"])

    def test_tudo_fora_e_cache(self):
        relogio = [1000.0]
        respostas = {"geteventdata": EVENTO, "getgeometry": GEOMETRIA}
        chamadas = []
        s = DetalhesGdacs(self.fake(respostas, chamadas), agora=lambda: relogio[0])
        s.obter("TC", "1")
        n = len(chamadas)
        s.obter("TC", "1")
        self.assertEqual(len(chamadas), n)  # veio do cache
        relogio[0] += 2000
        respostas["geteventdata"] = respostas["getgeometry"] = RuntimeError("fora")
        self.assertEqual(s.obter("TC", "1")["estado"], "antigo")
        with self.assertRaises(FonteIndisponivel):
            s.obter("TC", "2")


if __name__ == "__main__":
    unittest.main()
