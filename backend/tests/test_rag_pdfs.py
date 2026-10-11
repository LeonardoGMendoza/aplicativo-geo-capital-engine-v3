"""Testes offline do RAG: python -m unittest discover -s backend/tests -t ."""
import importlib
import os
import shutil
import sys
import tempfile
import types
import unittest

from backend.rag_pdfs import carregar_trechos, citar, dividir_em_trechos, limpar_texto

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PDF_PEQUENO = os.path.join(RAIZ, "documentos_oficiais", "rima_bacia_campos.pdf")  # 44 páginas


class DivisaoEmTrechos(unittest.TestCase):
    def test_limpa_hifenizacao_e_espacos(self):
        self.assertEqual(limpar_texto("inunda-\n ção   no\n\nvale"), "inundação no vale")

    def test_respeita_tamanho_corta_em_frase_e_guarda_paginas(self):
        paginas = [(1, "Primeira frase sobre enchente no vale. " * 20), (2, "Segunda página fala de abrigo. " * 20)]
        trechos = dividir_em_trechos(paginas, tamanho=300, sobreposicao=80)
        self.assertGreater(len(trechos), 3)
        for t in trechos:
            self.assertLessEqual(len(t["texto"]), 300)
            self.assertTrue(t["texto"].endswith("."), "corte deve cair em fim de frase")
            self.assertLessEqual(t["pagina"], t["pagina_fim"])
        self.assertEqual(trechos[0]["pagina"], 1)
        self.assertEqual(trechos[-1]["pagina_fim"], 2)
        self.assertTrue(any(t["pagina"] == 1 and t["pagina_fim"] == 2 for t in trechos), "trecho pode cruzar páginas")

    def test_sobreposicao_repete_final_do_trecho_anterior(self):
        paginas = [(1, " ".join(f"Frase numero {i} do plano." for i in range(60)))]
        a, b = dividir_em_trechos(paginas, tamanho=250, sobreposicao=60)[:2]
        ultima = a["texto"].split(". ")[-1]
        self.assertIn(ultima, b["texto"][:80])

    def test_frase_gigante_sem_ponto_e_fatiada(self):
        trechos = dividir_em_trechos([(5, "x" * 2500)], tamanho=1000, sobreposicao=100)
        self.assertTrue(all(len(t["texto"]) <= 1000 for t in trechos))
        self.assertEqual(sum(len(t["texto"]) for t in trechos), 2500)

    def test_citacao(self):
        self.assertEqual(citar({"fonte": "a.pdf", "pagina": 3, "pagina_fim": 3}), "a.pdf, pág. 3")
        self.assertEqual(citar({"fonte": "a.pdf", "pagina": 3, "pagina_fim": 4}), "a.pdf, pág. 3-4")
        self.assertEqual(citar({"evento": "enchente_rs"}), "base interna")


@unittest.skipUnless(os.path.exists(PDF_PEQUENO), "PDF de exemplo ausente")
class PdfReal(unittest.TestCase):
    def test_le_todas_as_paginas_e_nao_so_51(self):
        pasta = tempfile.mkdtemp()
        try:
            shutil.copy(PDF_PEQUENO, pasta)
            docs, metas, ids = carregar_trechos(pasta)
        finally:
            shutil.rmtree(pasta)
        self.assertGreater(len(docs), 20)
        self.assertEqual(len(set(ids)), len(ids), "ids precisam ser únicos para o upsert")
        self.assertGreaterEqual(max(m["pagina_fim"] for m in metas), 40)
        self.assertEqual({m["fonte"] for m in metas}, {"rima_bacia_campos.pdf"})


class _ColecaoFalsa:
    def __init__(self):
        self.dados, self.lotes = {}, []

    def upsert(self, documents, metadatas, ids):
        self.lotes.append(len(ids))
        self.dados.update({i: (d, m) for i, d, m in zip(ids, documents, metadatas)})

    def count(self):
        return len(self.dados)

    def query(self, query_texts, n_results):
        itens = list(self.dados.values())[:n_results]
        return {"documents": [[d for d, _ in itens]], "metadatas": [[m for _, m in itens]]}


class BancoVetorialSimulado(unittest.TestCase):
    """Carrega oracle_rag com Streamlit, Chroma e OCI falsos: sem chave e sem internet."""

    def setUp(self):
        self.pasta = tempfile.mkdtemp()
        self.colecao = _ColecaoFalsa()
        colecao = self.colecao

        st = types.ModuleType("streamlit")
        st.secrets = {"oci": {"COHERE_API_KEY": "teste"}}
        sem_cache = lambda *a, **k: (lambda f: f)
        st.cache_data, st.cache_resource = sem_cache, sem_cache
        chroma = types.ModuleType("chromadb")
        chroma.PersistentClient = lambda path: types.SimpleNamespace(get_or_create_collection=lambda **k: colecao)
        utils = types.ModuleType("chromadb.utils")
        utils.embedding_functions = types.SimpleNamespace(CohereEmbeddingFunction=lambda **k: None)
        self.modulos = {"streamlit": st, "chromadb": chroma, "chromadb.utils": utils, "oci": types.ModuleType("oci")}
        self.antigos = {k: sys.modules.get(k) for k in [*self.modulos, "backend.oracle_rag"]}
        sys.modules.update(self.modulos)
        sys.modules.pop("backend.oracle_rag", None)
        self.rag = importlib.import_module("backend.oracle_rag")
        self.rag.PASTA_BANCO = self.pasta
        self.rag.MARCADOR_COMPLETO = os.path.join(self.pasta, "v2.completo")
        self.trechos = ([f"trecho {i}" for i in range(200)], [{"fonte": "x.pdf", "pagina": i + 1, "pagina_fim": i + 1} for i in range(200)], [f"x_{i}" for i in range(200)])
        self.leituras = 0

        def carregar():
            self.leituras += 1
            return self.trechos
        self.rag.carregar_pdfs = carregar

    def tearDown(self):
        shutil.rmtree(self.pasta)
        for k, v in self.antigos.items():
            if v is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = v

    def test_monta_em_lotes_de_90_uma_unica_vez(self):
        self.rag.obter_colecao()
        self.assertEqual(self.colecao.lotes, [90, 90, 20])
        self.assertTrue(os.path.exists(self.rag.MARCADOR_COMPLETO))
        self.rag.obter_colecao()
        self.assertEqual(self.leituras, 1, "com o marcador, não lê os PDFs de novo")

    def test_se_cair_no_meio_recomeca_sem_duplicar(self):
        upsert = self.colecao.upsert
        def falha_no_segundo(**k):
            if len(self.colecao.lotes) == 1:
                raise RuntimeError("limite da Cohere")
            upsert(**k)
        self.colecao.upsert = falha_no_segundo
        with self.assertRaises(RuntimeError):
            self.rag.obter_colecao()
        self.assertFalse(os.path.exists(self.rag.MARCADOR_COMPLETO))
        self.colecao.upsert = upsert
        self.rag.obter_colecao()
        self.assertEqual(self.colecao.count(), 200)

    def test_consulta_traz_3_trechos_com_pagina(self):
        texto = self.rag._consultar_historico_cache("Enchente", "Abrigos")
        self.assertEqual(texto.count("(Fonte: x.pdf, pág."), 3)
        self.assertTrue(texto.startswith("[1] trecho 0"))

    def test_nome_da_colecao_novo(self):
        self.assertEqual(self.rag.NOME_COLECAO, "documentos_oficiais_rag_v2")


if __name__ == "__main__":
    unittest.main()
