"""Testes do cadastro do cidadão (QR code → alertas no WhatsApp). Sem internet; banco SQLite temporário."""
import os
import shutil
import tempfile
import unittest
from unittest import mock

from backend.api.cadastros import Cadastros, Invalido, LimiteExcedido, mascarar, normalizar_celular, normalizar_cep


class Validacao(unittest.TestCase):
    def test_celular_aceita_formatos_comuns(self):
        for texto in ["(51) 99999-1234", "51999991234", "+55 51 99999-1234", "55 (51) 9 9999 1234"]:
            self.assertEqual(normalizar_celular(texto), "+5551999991234", texto)

    def test_celular_recusa_fixo_sem_ddd_e_lixo(self):
        for texto in ["5133331234", "999991234", "(00) 99999-1234", "(51) 89999-1234", "(51) 99999-999", "abc", "", "(51) 99999-9999"]:
            with self.assertRaises(Invalido, msg=texto):
                normalizar_celular(texto)

    def test_cep(self):
        self.assertEqual(normalizar_cep("90010-150"), "90010150")
        for texto in ["9001015", "00000-000", "abcde-fgh"]:
            with self.assertRaises(Invalido):
                normalizar_cep(texto)

    def test_mascara_nao_mostra_o_numero_inteiro(self):
        self.assertEqual(mascarar("+5551999991234"), "(51) 9****-1234")


class Banco(unittest.TestCase):
    def setUp(self):
        self.pasta = tempfile.mkdtemp()
        self.t = [1_800_000_000.0]
        self.c = Cadastros(caminho=os.path.join(self.pasta, "sub", "cadastros.db"), agora=lambda: self.t[0])

    def tearDown(self):
        shutil.rmtree(self.pasta)

    def test_cadastra_atualiza_e_sai(self):
        r = self.c.cadastrar("(51) 99999-1234", "90010-150", True, nome=" Maria  <b>", origem="qr", ip="1")
        self.assertEqual(r, {"ok": True, "atualizado": False, "celular": "(51) 9****-1234", "cep": "90010-150"})
        r = self.c.cadastrar("51999991234", "95900-000", True, ip="2")
        self.assertTrue(r["atualizado"], "mesmo celular atualiza o CEP, não duplica")
        self.assertEqual(self.c.resumo(), {"total": 1, "peloQr": 1})
        self.c.sair("51999991234", "90010-150", ip="3")  # CEP antigo: não remove
        self.assertEqual(self.c.resumo()["total"], 1)
        self.c.sair("51999991234", "95900-000", ip="3")
        self.assertEqual(self.c.resumo()["total"], 0)

    def test_sem_aceite_nao_grava(self):
        with self.assertRaises(Invalido):
            self.c.cadastrar("51999991234", "90010150", False)
        self.assertEqual(self.c.resumo()["total"], 0)

    def test_limite_por_ip_por_hora(self):
        for i in range(5):
            self.c.cadastrar(f"519999{i:05d}", "90010150", True, ip="9")
        with self.assertRaises(LimiteExcedido):
            self.c.cadastrar("51988887777", "90010150", True, ip="9")
        self.c.cadastrar("51988887777", "90010150", True, ip="10")
        self.t[0] += 3601
        self.c.cadastrar("51977776666", "90010150", True, ip="9")

    def test_lista_so_com_token_forte(self):
        self.c.cadastrar("51999991234", "90010150", True, nome="Ana", ip="1")
        with mock.patch.dict(os.environ, {"CADASTROS_TOKEN": ""}):
            with self.assertRaises(PermissionError):
                self.c.lista("")
        token = "x" * 32
        with mock.patch.dict(os.environ, {"CADASTROS_TOKEN": token}):
            with self.assertRaises(PermissionError):
                self.c.lista("errado")
            self.assertEqual(self.c.lista(token)[0]["celular"], "+5551999991234")


try:
    from fastapi.testclient import TestClient
except ImportError:  # pragma: no cover
    TestClient = None


@unittest.skipIf(TestClient is None, "FastAPI não instalado neste ambiente")
class Rotas(unittest.TestCase):
    def test_rotas(self):
        from backend.api.main import create_app
        pasta = tempfile.mkdtemp()
        try:
            c = Cadastros(caminho=os.path.join(pasta, "c.db"))
            with TestClient(create_app(service=object(), inteligencia=object(), cadastros=c)) as cli:
                r = cli.post("/api/v1/cadastros", json={"celular": "(51) 99999-1234", "cep": "90010-150", "aceite": True, "origem": "qr"})
                self.assertEqual(r.status_code, 200)
                self.assertEqual(r.json()["celular"], "(51) 9****-1234")
                self.assertEqual(r.headers["cache-control"], "no-store")
                self.assertEqual(cli.post("/api/v1/cadastros", json={"celular": "123", "cep": "90010150", "aceite": True}).status_code, 422)
                self.assertEqual(cli.get("/api/v1/cadastros/resumo").json(), {"total": 1, "peloQr": 1})
                self.assertEqual(cli.get("/api/v1/cadastros/lista").status_code, 404)
                self.assertNotIn("99999", cli.get("/api/v1/cadastros/resumo").text)
        finally:
            shutil.rmtree(pasta)


class BoasVindas(unittest.TestCase):
    def setUp(self):
        try:
            from backend.api import cadastros_router
        except ImportError:  # FastAPI ausente neste ambiente
            self.skipTest("FastAPI não instalado")
        self.r = cadastros_router

    def test_so_chama_o_n8n_com_url_e_token_e_nunca_quebra(self):
        with mock.patch.object(self.r.httpx, "post", create=True) as post:
            with mock.patch.dict(os.environ, {"CADASTRO_WEBHOOK_URL": "", "CADASTROS_TOKEN": "t" * 30}):
                self.r.avisar_n8n("+5551999991234", "90010150", None)
            post.assert_not_called()
            with mock.patch.dict(os.environ, {"CADASTRO_WEBHOOK_URL": "https://n8n.exemplo/webhook/cadastro-omni", "CADASTROS_TOKEN": "t" * 30}):
                self.r.avisar_n8n("+5551999991234", "90010150", "Ana")
                post.side_effect = RuntimeError("fora do ar")
                self.r.avisar_n8n("+5551999991234", "90010150", "Ana")  # não levanta
        args, kwargs = post.call_args
        self.assertEqual(kwargs["headers"], {"X-Omni-Token": "t" * 30})
        self.assertEqual(kwargs["json"], {"celular": "+5551999991234", "cep": "90010150", "nome": "Ana"})
