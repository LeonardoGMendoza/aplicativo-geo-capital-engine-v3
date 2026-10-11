"""Testes offline da Inteligência (IA): sem Cohere, sem Oracle e sem internet."""
import base64
import json
import os
import re
import shutil
import tempfile
import time
import unittest
import zlib

from backend.api.intelligence import (Inteligencia, LimiteExcedido, NaoConfigurado, Preparando, montar_prompt,
                                      oracle_do_ambiente)

DIM = 1024  # espaço grande: palavras diferentes quase nunca caem na mesma posição
TRECHOS = [
    {"id": "a", "texto": "Plano de evacuação em enchente: sair cedo das áreas de várzea e seguir para o abrigo.", "fonte": "porto_alegre.pdf", "pagina": 10, "pagina_fim": 11},
    {"id": "b", "texto": "Rompimento de barragem: sirenes podem falhar, usar SMS na zona rural.", "fonte": "brumadinho.pdf", "pagina": 132, "pagina_fim": 132},
    {"id": "c", "texto": "Deslizamento em encosta: monitorar chuva acumulada e interditar a via.", "fonte": "sao_sebastiao.pdf", "pagina": 5, "pagina_fim": 5},
    {"id": "d", "texto": "Vazamento de óleo no mar: conter a mancha com barreiras flutuantes.", "fonte": "rima_petrobras.pdf", "pagina": 40, "pagina_fim": 41},
]


def palavras(texto):
    return re.findall(r"\w{4,}", texto.lower())


class EmbedderFalso:
    """Vetor = contagem de palavras espalhadas em 1024 posições. Parecido o bastante para testar a busca."""

    def __init__(self):
        self.chamadas = []

    def __call__(self, textos, tipo):
        self.chamadas.append((len(textos), tipo))
        vetores = []
        for texto in textos:
            v = [0.0] * DIM
            for p in palavras(texto):
                v[zlib.crc32(p.encode()) % DIM] += 1
            vetores.append(v)
        return vetores


class Base(unittest.TestCase):
    def setUp(self):
        self.pasta = tempfile.mkdtemp()
        self.arquivo = os.path.join(self.pasta, "trechos.json")
        with open(self.arquivo, "w", encoding="utf-8") as f:
            json.dump({"versao": "teste1", "trechos": TRECHOS}, f)
        self.embedder = EmbedderFalso()
        self.prompts = []

        def chat(prompt):
            self.prompts.append(prompt)
            return "Saia cedo das áreas baixas (porto_alegre.pdf, pág. 10-11)."
        self.chat = chat

    def tearDown(self):
        shutil.rmtree(self.pasta)

    def nova(self, **kw):
        kw.setdefault("embedder", self.embedder)
        kw.setdefault("chat", self.chat)
        return Inteligencia(trechos_path=self.arquivo, data_dir=os.path.join(self.pasta, "dados"), **kw)

    def pronta(self, **kw):
        ia = self.nova(**kw)
        ia.iniciar()
        ia._thread.join(5)
        self.assertEqual(ia.estado, "pronto")
        return ia


class Montagem(Base):
    def test_calcula_salva_e_na_proxima_so_carrega(self):
        ia = self.pronta()
        self.assertEqual(self.embedder.chamadas, [(4, "search_document")])
        self.assertTrue(os.path.exists(ia.arquivo_vetores))
        self.embedder.chamadas.clear()
        self.pronta()
        self.assertEqual(self.embedder.chamadas, [], "com o arquivo salvo, não chama a Cohere de novo")

    def test_sem_chave_nao_quebra_e_avisa(self):
        ia = self.nova(embedder=None)
        ia.iniciar()
        self.assertEqual(ia.status()["estado"], "sem_chave")
        with self.assertRaises(NaoConfigurado):
            ia.perguntar("Como evacuar numa enchente?")

    def test_enquanto_prepara_responde_preparando(self):
        ia = self.nova()
        ia.iniciar = lambda: None  # simula a montagem ainda em andamento
        ia.estado = "preparando"
        with self.assertRaises(Preparando):
            ia.perguntar("Como evacuar numa enchente?")

    def test_erro_na_cohere_vira_estado_erro_e_tenta_de_novo_depois(self):
        def quebra(textos, tipo):
            raise RuntimeError("fora do ar")
        ia = self.nova(embedder=quebra)
        ia.iniciar()
        ia._thread.join(5)
        self.assertEqual(ia.status()["estado"], "erro")
        ia.embedder = self.embedder
        ia.iniciar()
        ia._thread.join(5)
        self.assertEqual(ia.estado, "pronto")

    def test_status_lista_documentos_e_paginas(self):
        s = self.nova().status()
        self.assertEqual(s["trechos"], 4)
        self.assertEqual(s["paginas"], 11 + 132 + 5 + 41)
        self.assertIn({"fonte": "brumadinho.pdf", "paginas": 132}, s["documentos"])


class Perguntas(Base):
    def test_busca_traz_o_trecho_certo_primeiro_com_pagina(self):
        r = self.pronta().perguntar("O que fazer quando a barragem tem rompimento e a sirene falha?")
        self.assertEqual(r["trechos"][0]["fonte"], "brumadinho.pdf")
        self.assertEqual(r["trechos"][0]["pagina"], 132)
        self.assertEqual(len(r["trechos"]), 3)
        self.assertEqual(r["modo"], "ia")
        self.assertIn("pág.", r["resposta"])
        self.assertIn("brumadinho.pdf, pág. 132", self.prompts[0])

    def test_sem_oracle_devolve_so_os_trechos(self):
        r = self.pronta(chat=None).perguntar("enchente evacuação abrigo")
        self.assertEqual(r["modo"], "documentos")
        self.assertIsNone(r["resposta"])
        self.assertEqual(r["trechos"][0]["fonte"], "porto_alegre.pdf")

    def test_oracle_falhando_nao_derruba(self):
        def quebra(prompt):
            raise TimeoutError()
        r = self.pronta(chat=quebra).perguntar("enchente evacuação abrigo")
        self.assertEqual(r["modo"], "documentos")
        self.assertTrue(r["trechos"])

    def test_valida_pergunta_e_perfil(self):
        ia = self.pronta()
        for pergunta, perfil in [("oi", "defesa_civil"), ("x" * 301, "defesa_civil"), ("Pergunta válida", "hacker")]:
            with self.assertRaises(ValueError):
                ia.perguntar(pergunta, perfil)

    def test_mesma_pergunta_usa_cache(self):
        ia = self.pronta()
        ia.perguntar("Como evacuar numa enchente?")
        ia.perguntar("  como evacuar   numa enchente? ")
        self.assertEqual(len(self.prompts), 1)

    def test_limite_por_pessoa_e_geral(self):
        ia = self.pronta(limite_ip_minuto=2, limite_minuto=3)
        ia.perguntar("pergunta um sobre enchente", ip="1")
        ia.perguntar("pergunta dois sobre enchente", ip="1")
        with self.assertRaises(LimiteExcedido):
            ia.perguntar("pergunta três sobre enchente", ip="1")
        ia.perguntar("pergunta quatro sobre enchente", ip="2")
        with self.assertRaises(LimiteExcedido):
            ia.perguntar("pergunta cinco sobre enchente", ip="3")
        ia._chamadas = type(ia._chamadas)([time.monotonic() - 61] * 3)
        ia._por_ip = {}
        ia.perguntar("pergunta seis sobre enchente", ip="3")

    def test_prompt_proibe_promessas_e_pede_citacao(self):
        trechos = [{"fonte": "a.pdf", "pagina": 2, "paginaFim": 3, "texto": "abc"}]
        prompt = montar_prompt("Pergunta?", "comunidade", trechos)
        self.assertIn("(a.pdf, pág. 2-3)", prompt)
        self.assertIn("Não prometa rota segura", prompt)
        self.assertIn("não invente", prompt)
        self.assertIn("linguagem simples", prompt)


class ConfiguracaoOracle(unittest.TestCase):
    def test_monta_so_com_todos_os_campos(self):
        env = {"OCI_USER": "u", "OCI_FINGERPRINT": "f", "OCI_TENANCY": "t", "OCI_REGION": "sa-saopaulo-1",
               "OCI_COMPARTMENT_ID": "c", "OCI_KEY_B64": base64.b64encode(b"-----BEGIN PRIVATE KEY-----\nx\n").decode()}
        chat = oracle_do_ambiente(env)
        self.assertEqual(chat.config["key_content"], "-----BEGIN PRIVATE KEY-----\nx\n")
        self.assertEqual(chat.compartment_id, "c")
        self.assertIsNone(oracle_do_ambiente({**env, "OCI_COMPARTMENT_ID": ""}))


class ArquivoDeTrechosReal(unittest.TestCase):
    def test_arquivo_publicado_tem_todos_os_pdfs(self):
        caminho = os.path.join(os.path.dirname(__file__), "..", "data", "rag_trechos.json")
        with open(caminho, encoding="utf-8") as f:
            dados = json.load(f)
        trechos = dados["trechos"]
        self.assertGreater(len(trechos), 1000)
        self.assertEqual({t["fonte"] for t in trechos}, {"brumadinho.pdf", "porto_alegre.pdf", "rima_bacia_campos.pdf", "rima_petrobras.pdf", "sao_sebastiao.pdf"})
        self.assertGreater(max(t["pagina_fim"] for t in trechos if t["fonte"] == "brumadinho.pdf"), 200)
        self.assertTrue(all(len(t["texto"]) <= 1200 for t in trechos))


try:
    from fastapi.testclient import TestClient
except ImportError:  # pragma: no cover
    TestClient = None


@unittest.skipIf(TestClient is None, "FastAPI não instalado neste ambiente")
class Rotas(Base):
    def cliente(self, ia):
        from backend.api.main import create_app

        class NasaFalsa:
            pass
        return TestClient(create_app(service=NasaFalsa(), inteligencia=ia))

    def test_status_e_pergunta(self):
        ia = self.pronta()
        with self.cliente(ia) as c:
            s = c.get("/api/v1/intelligence/status").json()
            self.assertEqual(s["estado"], "pronto")
            r = c.post("/api/v1/intelligence/ask", json={"pergunta": "O que fazer quando a barragem tem rompimento e a sirene falha?", "perfil": "defesa_civil"})
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json()["trechos"][0]["fonte"], "brumadinho.pdf")
            self.assertEqual(r.headers["cache-control"], "no-store")

    def test_erros_viram_codigos_claros(self):
        with self.cliente(self.nova(embedder=None)) as c:
            self.assertEqual(c.post("/api/v1/intelligence/ask", json={"pergunta": "enchente agora"}).status_code, 503)
            self.assertEqual(c.post("/api/v1/intelligence/ask", json={"pergunta": "x"}).status_code, 422)
        ia = self.pronta(limite_ip_minuto=1)
        with self.cliente(ia) as c:
            c.post("/api/v1/intelligence/ask", json={"pergunta": "enchente um"})
            r = c.post("/api/v1/intelligence/ask", json={"pergunta": "enchente dois"})
            self.assertEqual(r.status_code, 429)
            self.assertNotIn("Traceback", r.text)
