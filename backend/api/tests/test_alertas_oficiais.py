"""Testes offline dos alertas oficiais do mundo e da previsão da família (sem internet)."""
import unittest
from datetime import datetime, timezone

from backend.api import alertas_oficiais as ao

AGORA = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc).timestamp()

# Polígono em volta de Chapecó/Xanxerê (oeste de SC), em [lon, lat] como o INMET costuma mandar
OESTE_SC = [[-53.2, -26.6], [-52.2, -26.6], [-52.2, -27.4], [-53.2, -27.4], [-53.2, -26.6]]
# Polígono em volta de Foz do Iguaçu
FOZ = [[-54.8, -25.3], [-54.3, -25.3], [-54.3, -25.8], [-54.8, -25.8]]

INMET = {
    "hoje": [
        {"id": 51001, "descricao": "Tempestade", "severidade": "Grande Perigo", "inicio": "2026-11-04 08:00:00",
         "fim": "2026-11-05 23:00:00", "estados": "SC, PR", "municipios": "Chapecó - SC (4204202), Xanxerê - SC (4219507)",
         "riscos": ["Ventos superiores a 100 km/h", "Granizo"], "instrucoes": "Em caso de rajadas de vento: não se abrigue debaixo de árvores.",
         "poligono": str(OESTE_SC)},
        {"id": 51002, "descricao": "Acumulado de Chuva", "severidade": "Perigo Potencial", "inicio": "2026-11-05 00:00",
         "fim": "2026-11-05 23:59", "estados": "PR", "municipios": "Foz do Iguaçu - PR (4108304)"},
        {"id": 51003, "descricao": "Velha", "severidade": "Perigo", "inicio": "2026-11-01 00:00", "fim": "2026-11-02 00:00"},  # vencido
        {"id": 51004, "descricao": "Sem grau", "severidade": "???"},                                                   # ignorado
    ],
    "futuro": [
        {"id": 51010, "descricao": "Vendaval", "severidade": "Perigo", "inicio": "2026-11-06 12:00", "fim": "2026-11-07 12:00",
         "estados": "PR", "municipios": "Cascavel - PR", "poligono": FOZ},
    ],
}

CAP = """<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>urn:oid:2.49.0.1.76.0.2026.11.4.51001</identifier><sent>2026-11-04T08:00:00-03:00</sent>
  <info><language>en-US</language><event>Storm</event><severity>Extreme</severity></info>
  <info><language>pt-BR</language><event>Tempestade</event><severity>Extreme</severity>
    <onset>2026-11-04T08:00:00-03:00</onset><expires>2026-11-05T23:00:00-03:00</expires>
    <headline>Aviso de Tempestade</headline><description>Ventos superiores a 100 km/h.</description>
    <instruction>Desligue aparelhos elétricos.</instruction>
    <area><areaDesc>Oeste Catarinense</areaDesc><polygon>-26.6,-53.2 -26.6,-52.2 -27.4,-52.2 -27.4,-53.2 -26.6,-53.2</polygon></area>
  </info>
</alert>"""

NWS = {"type": "FeatureCollection", "features": [
    {"geometry": {"type": "Polygon", "coordinates": [[[-112.1, 40.9], [-111.7, 40.9], [-111.7, 40.6], [-112.1, 40.6], [-112.1, 40.9]]]},
     "properties": {"id": "urn:1", "event": "Winter Storm Warning", "severity": "Severe", "onset": "2026-11-06T06:00:00-07:00",
                    "ends": "2026-11-07T06:00:00-07:00", "areaDesc": "Salt Lake and Tooele Valleys", "geocode": {"UGC": ["UTZ105"]},
                    "headline": "Winter Storm Warning issued", "description": "Heavy snow."}},
    {"geometry": None, "properties": {"id": "urn:2", "event": "Tornado Warning", "severity": "Severe", "onset": "2026-11-05T05:00:00-06:00",
                                       "expires": "2026-11-05T07:00:00-06:00", "areaDesc": "Dallas, TX", "geocode": {"UGC": ["TXC113"]}}},
    {"geometry": None, "properties": {"id": "urn:3", "event": "Frost Advisory", "severity": "Minor", "areaDesc": "X"}},  # fraco: fora
]}

METEOALARM = {"warnings": [
    {"uuid": "u1", "alert": {"identifier": "pt-1", "info": [
        {"language": "en-GB", "event": "Red wind warning", "severity": "Extreme", "onset": "2026-11-05T10:00:00+00:00",
         "expires": "2026-11-06T10:00:00+00:00", "headline": "Wind", "area": [{"areaDesc": "Lisboa"}]},
        {"language": "pt-PT", "event": "Aviso vermelho de vento", "severity": "Extreme", "onset": "2026-11-05T10:00:00+00:00",
         "expires": "2026-11-06T10:00:00+00:00", "area": [{"areaDesc": "Lisboa"}]}]}},
    {"uuid": "u2", "alert": {"info": [{"language": "pt-PT", "event": "Amarelo", "severity": "Moderate", "area": []}]}},  # amarelo: fora
]}

TSUNAMI = """<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#">
  <entry><id>t1</id><title>Tsunami Threat Message - Peru</title><updated>2026-11-05T10:00:00Z</updated>
    <summary>Hazardous tsunami waves are possible</summary><geo:lat>-12.5</geo:lat><geo:long>-77.9</geo:long>
    <link href="https://www.tsunami.gov/events/x"/></entry>
  <entry><id>t2</id><title>Tsunami Information Statement</title><updated>2026-11-05T09:00:00Z</updated>
    <summary>No tsunami threat</summary></entry>
  <entry><id>t3</id><title>Tsunami Warning old</title><updated>2026-10-01T09:00:00Z</updated><summary>warning</summary></entry>
</feed>"""

USGS = {"features": [
    {"id": "us1", "geometry": {"coordinates": [-77.5, -12.3, 30]}, "properties": {"mag": 6.8, "time": 1793880000000, "place": "near Lima, Peru", "title": "M 6.8 - near Lima", "url": "https://earthquake.usgs.gov/x", "tsunami": 1}},
    {"id": "us2", "geometry": {"coordinates": [140, 36, 10]}, "properties": {"mag": 4.7, "place": "Japan"}},
]}


LUGARES = [  # lugares de exemplo, como o aparelho manda
    {"id": "foz", "nome": "Foz do Iguaçu", "pais": "Brasil", "latitude": -25.5469, "longitude": -54.5882},
    {"id": "lima", "nome": "Lima", "pais": "Peru", "latitude": -12.0464, "longitude": -77.0428},
    {"id": "iquitos", "nome": "Iquitos", "pais": "Peru", "latitude": -3.7437, "longitude": -73.2516},
    {"id": "slc", "nome": "Salt Lake City (Utah)", "pais": "EUA", "latitude": 40.7608, "longitude": -111.891},
    {"id": "bsb", "nome": "Brasília", "pais": "Brasil", "latitude": -15.7939, "longitude": -47.8828},
]


def open_meteo(n, excecoes=None):
    """Resposta multi-local do Open-Meteo: 7 dias tranquilos; excecoes = {indice: {variavel: (dia, valor)}}."""
    saida = []
    for i in range(n):
        d = {"time": [f"2026-11-{5 + k:02d}" for k in range(7)], "weather_code": [3] * 7, "precipitation_sum": [0] * 7,
             "wind_gusts_10m_max": [20] * 7, "temperature_2m_max": [28] * 7, "temperature_2m_min": [18] * 7}
        for chave, (dia, valor) in (excecoes or {}).get(i, {}).items():
            d[chave][dia] = valor
        saida.append({"daily": d})
    return saida


class TestFontes(unittest.TestCase):
    def test_inmet_agora_e_vem_ai(self):
        alertas = ao.parse_inmet_json(INMET, AGORA)
        self.assertEqual([a["id"] for a in alertas], ["inmet-51001", "inmet-51002", "inmet-51010"])
        tempestade = alertas[0]
        self.assertEqual((tempestade["severidade"], tempestade["quando"]), ("extremo", "agora"))
        self.assertIn("Chapecó", tempestade["area"])
        self.assertEqual(tempestade["ufs"], ["PR", "SC"])
        self.assertEqual(alertas[1]["ufs"], ["PR"])
        self.assertEqual(ao.ufs_do_texto("Foz do Iguaçu - PR (4108304)", ["SC", "XX"]), ["PR", "SC"])
        self.assertTrue(ao.dentro_do_poligono(-27.1, -52.6, tempestade["poligono"]), "polígono [lon,lat] virou [lat,lon]")
        self.assertIn("Granizo", tempestade["descricao"])
        self.assertEqual(alertas[1]["severidade"], "moderado")
        self.assertEqual(alertas[2]["quando"], "vem")

    def test_cap_prefere_portugues(self):
        [a] = ao.parse_cap(CAP, "INMET", "https://alertas2.inmet.gov.br/", "Brasil", "brasil", AGORA)
        self.assertEqual((a["evento"], a["severidade"], a["quando"]), ("Tempestade", "extremo", "agora"))
        self.assertTrue(ao.dentro_do_poligono(-27.1, -52.6, a["poligono"]))

    def test_nws_em_portugues(self):
        alertas = ao.parse_nws(NWS, AGORA)
        self.assertEqual(len(alertas), 2)
        tornado = next(a for a in alertas if a["eventoOriginal"] == "Tornado Warning")
        self.assertEqual(tornado["severidade"], "extremo")
        self.assertTrue(tornado["evento"].startswith("Tornado"))
        neve = next(a for a in alertas if a["eventoOriginal"] == "Winter Storm Warning")
        self.assertEqual((neve["evento"], neve["quando"]), ("Tempestade de neve", "vem"))

    def test_meteoalarm_so_laranja_e_vermelho(self):
        [a] = ao.parse_meteoalarm(METEOALARM, "portugal", AGORA)
        self.assertEqual((a["pais"], a["evento"], a["severidade"]), ("Portugal", "Aviso vermelho de vento", "extremo"))
        self.assertIsNotNone(a["latitude"])
        self.assertEqual(ao.evento_meteoalarm("Severe rain-flood warning"), "Chuva e enchente")
        self.assertEqual(ao.evento_meteoalarm("Red wind warning"), "Vento forte")
        self.assertIsNone(ao.evento_meteoalarm("Aviso desconhecido"))

    def test_tsunami_e_terremoto(self):
        [t] = ao.parse_tsunami(TSUNAMI, AGORA)
        self.assertEqual((t["severidade"], t["latitude"]), ("extremo", -12.5))
        sismos = ao.parse_usgs(USGS, AGORA)
        self.assertEqual(sismos[0]["severidade"], "extremo")
        self.assertEqual(sismos[1]["severidade"], "moderado")


class TestPrevisao(unittest.TestCase):
    def test_avaliar_dia(self):
        self.assertEqual(ao.avaliar_dia(99, 40, 95, 30, 18)[0], "extremo")
        nivel, motivos = ao.avaliar_dia(95, 10, 40, 30, 18)
        self.assertEqual(nivel, "moderado", "trovoada comum é só amarelo")
        self.assertIn("Pancadas de chuva com trovoada", motivos)
        self.assertEqual(ao.avaliar_dia(96, 10, 40, 30, 18)[0], "moderado", "granizo do modelo não vira laranja")
        self.assertEqual(ao.avaliar_dia(95, 51, 40, 30, 18)[0], "severo", "trovoada com chuva forte")
        self.assertEqual(ao.avaliar_dia(3, 0, 55, 28, 18), (None, []), "55 km/h é vento normal de temporal")
        # Casos reais de 05/11/2026 (Brasília, Foz): ficam amarelos, não laranja
        self.assertEqual(ao.avaliar_dia(96, 12, 45, 30, 19)[0], "moderado")
        self.assertEqual(ao.avaliar_dia(3, 0, 20, 28, 18), (None, []))
        self.assertEqual(ao.avaliar_dia(75, 0, 20, -2, -12)[0], "severo")

    def test_open_meteo_por_cidade(self):
        previsao = ao.parse_open_meteo(open_meteo(3, {0: {"weather_code": (1, 96), "wind_gusts_10m_max": (1, 92)}}), 3)
        self.assertEqual(len(previsao), 3)
        self.assertEqual(previsao[0][1]["nivel"], "extremo")
        self.assertIsNone(previsao[1][1]["nivel"])
        with self.assertRaises(ValueError):
            ao.parse_open_meteo([{}], 2)


class TestLugares(unittest.TestCase):
    def test_nenhum_lugar_escrito_no_codigo(self):
        self.assertFalse(hasattr(ao, "CIDADES_FAMILIA"))
        self.assertEqual(ao.lugares_do_ambiente(""), [])
        padrao = ao.lugares_do_ambiente("Centro|-25.5469|-54.5882|Brasil; Vila C | -25.47 | -54.56 ;ruim|x|y")
        self.assertEqual([p["nome"] for p in padrao], ["Centro", "Vila C"])
        self.assertIsNone(padrao[1]["pais"])

    def test_normaliza_o_que_vem_do_aparelho(self):
        lugares = ao.normalizar_lugares(LUGARES + [{"id": "x", "nome": "Fora", "latitude": 99, "longitude": 0}, "lixo", {"id": "foz", "nome": "repetido", "latitude": 0, "longitude": 0}])
        self.assertEqual([l["id"] for l in lugares], ["foz", "lima", "iquitos", "slc", "bsb"])
        self.assertEqual(lugares[3]["nomes"], ["salt lake city"])
        self.assertEqual(ao.normalizar_lugares([{"id": "c", "nome": "Onde eu moro", "latitude": 1, "longitude": 1}])[0]["nomes"], [])
        self.assertEqual(len(ao.normalizar_lugares([{"id": str(i), "nome": "a", "latitude": i, "longitude": 0} for i in range(30)])), ao.MAX_LUGARES)

    def test_lugar_dentro_do_poligono_ou_pelo_nome(self):
        inmet = ao.parse_inmet_json(INMET, AGORA)
        [foz] = ao.normalizar_lugares(LUGARES[:1])
        ids = [a["id"] for a in ao.alertas_do_lugar(foz, inmet)]
        self.assertIn("inmet-51002", ids, "achado pelo nome do município")
        self.assertIn("inmet-51010", ids, "achado pelo polígono")
        self.assertNotIn("inmet-51001", ids, "tempestade de Chapecó não é em Foz")
        sem_pais = ao.normalizar_lugares([{**LUGARES[0], "pais": None}])[0]
        self.assertNotIn("inmet-51002", [a["id"] for a in ao.alertas_do_lugar(sem_pais, inmet)], "sem país: não cruza pelo nome")

    def test_terremoto_perto_de_lima_e_neve_em_utah(self):
        alertas = ao.parse_usgs(USGS, AGORA) + ao.parse_nws(NWS, AGORA)
        resumo = {c["id"]: c for c in ao.resumo_lugares(ao.normalizar_lugares(LUGARES), alertas, {})}
        self.assertEqual(resumo["lima"]["nivel"], "extremo")
        self.assertIn("usgs-us1", [a["id"] for a in resumo["lima"]["alertas"]])
        self.assertEqual((resumo["slc"]["nivel"], resumo["slc"]["nivelOficial"]), ("severo", "severo"))
        self.assertIsNone(resumo["bsb"]["nivel"])
        self.assertEqual(resumo["iquitos"]["alertas"], [], "Iquitos fica a mais de 300 km")

    def test_gdacs_entra_nos_lugares(self):
        g = [{"id": "TC-1-1", "tipoNome": "Ciclone tropical", "nivel": "vermelho", "nome": "X", "latitude": -25.0, "longitude": -54.0}]
        self.assertEqual(ao.resumo_lugares(ao.normalizar_lugares(LUGARES[:1]), ao.gdacs_para_oficiais(g), {})[0]["nivel"], "extremo")


class TestServico(unittest.TestCase):
    def test_uma_fonte_cai_e_as_outras_continuam(self):
        chamadas = {"nws": 0, "previsao": []}
        def nws():
            chamadas["nws"] += 1
            if chamadas["nws"] > 1:
                raise RuntimeError("caiu")
            return ao.parse_nws(NWS, AGORA)
        def quebrada():
            raise RuntimeError("fora do ar")
        def previsao(pontos):
            chamadas["previsao"].append(list(pontos))
            return ao.parse_open_meteo(open_meteo(len(pontos), {0: {"weather_code": (2, 95), "precipitation_sum": (2, 60)}}), len(pontos))
        relogio = {"t": AGORA}
        s = ao.AlertasOficiais(buscadores={"inmet": ("INMET", lambda: ao.parse_inmet_json(INMET, AGORA)), "nws": ("NWS", nws), "x": ("X", quebrada)},
                               buscar_previsao=previsao, agora=lambda: relogio["t"], padrao=[{"id": "p", "nome": "Centro", "pais": "Brasil", "latitude": -27.1, "longitude": -52.6}])
        r = s.obter(LUGARES[:2])
        estados = {f["id"]: f["estado"] for f in r["fontes"]}
        self.assertEqual(estados, {"inmet": "sucesso", "nws": "sucesso", "x": "indisponivel", "open-meteo": "sucesso"})
        self.assertEqual((r["alertas"][0]["quando"], r["alertas"][0]["severidade"]), ("agora", "extremo"))
        self.assertEqual([l["id"] for l in r["lugares"]], ["foz", "lima"])
        self.assertEqual(r["lugares"][0]["previsao"][2]["nivel"], "severo")
        self.assertEqual(r["locaisPadrao"][0]["nivelOficial"], "extremo", "Centro (oeste de SC) dentro da tempestade")
        self.assertEqual(len(chamadas["previsao"]), 1, "uma chamada só para todos os pontos")
        # sem lugares: só os locais padrão; e a previsão vem do cache por ponto
        r2 = s.obter()
        self.assertEqual(r2["lugares"], [])
        self.assertEqual(len(chamadas["previsao"]), 1)
        relogio["t"] += ao.CACHE_ALERTAS + 1  # cache venceu e o NWS caiu: usa a última lista boa
        estados = {f["id"]: f["estado"] for f in s.obter()["fontes"]}
        self.assertEqual(estados["nws"], "antigo")


if __name__ == "__main__":
    unittest.main()
