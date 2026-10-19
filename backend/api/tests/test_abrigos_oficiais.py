"""Testes offline do cadastro de abrigos oficiais (Defesa Civil): SQLite temporário, sem internet."""
import os
import tempfile
import unittest
from unittest import mock

from backend.api.abrigos_oficiais import AbrigosOficiais, Invalido, validar

BASE = {"tipo": "abrigo", "nome": "EE Escola Exemplo", "endereco": "Rua A, 10", "latitude": -23.55, "longitude": -46.63, "status": "aberto", "capacidade": 120}


class Validar(unittest.TestCase):
    def test_limpa_e_valida(self):
        r = validar({**BASE, "nome": "  Ginásio <b>Central</b> ", "raioM": 500})
        self.assertEqual(r["nome"], "Ginásio bCentral/b")
        self.assertIsNone(r["raioM"])  # raio só vale para área de risco
        self.assertEqual(validar({**BASE, "tipo": "area_risco", "raioM": 300})["raioM"], 300)

    def test_rejeita(self):
        for ruim in [{**BASE, "tipo": "x"}, {**BASE, "nome": "a"}, {**BASE, "latitude": 999}, {**BASE, "status": "talvez"},
                     {**BASE, "capacidade": -1}, {**BASE, "tipo": "area_risco", "raioM": 1}]:
            with self.assertRaises(Invalido):
                validar(ruim)


class Repositorio(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.repo = AbrigosOficiais(os.path.join(self.dir.name, "a.db"), agora=lambda: 1_800_000_000)
        self.env = mock.patch.dict(os.environ, {"OPERADOR_CODIGO": "segredo123"})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.dir.cleanup()

    def test_codigo_obrigatorio(self):
        with self.assertRaises(PermissionError):
            self.repo.criar(BASE, "errado")
        with mock.patch.dict(os.environ, {"OPERADOR_CODIGO": ""}):
            with self.assertRaises(PermissionError):
                self.repo.criar(BASE, "")

    def test_criar_listar_status_remover(self):
        a = self.repo.criar(BASE, "segredo123")
        self.repo.criar({**BASE, "nome": "Abrigo Longe", "latitude": -22.9, "longitude": -47.06}, "segredo123")
        perto = self.repo.listar(-23.56, -46.64, 20)["itens"]
        self.assertEqual([i["nome"] for i in perto], ["EE Escola Exemplo"])
        self.assertLess(perto[0]["distanciaKm"], 2)
        todos = self.repo.listar()["itens"]
        self.assertEqual(len(todos), 2)
        self.assertNotIn("distanciaKm", todos[0])
        self.assertEqual(self.repo.mudar_status(a["id"], "lotado", "segredo123")["status"], "lotado")
        with self.assertRaises(Invalido):
            self.repo.mudar_status(a["id"], "x", "segredo123")
        self.repo.remover(a["id"], "segredo123")
        with self.assertRaises(LookupError):
            self.repo.remover(a["id"], "segredo123")
        self.assertEqual(len(self.repo.listar()["itens"]), 1)


if __name__ == "__main__":
    unittest.main()
