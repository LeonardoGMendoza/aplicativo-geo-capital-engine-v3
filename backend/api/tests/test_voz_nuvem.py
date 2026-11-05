"""Testes da voz da nuvem (sem internet e sem chave de verdade)."""
import unittest

from backend.api import voz_nuvem as vn


class TestVozNuvem(unittest.TestCase):
    def test_sem_chave_nao_fala(self):
        with self.assertRaises(vn.VozNaoConfigurada):
            vn.VozNuvem(chave="", regiao="", env={}).falar("oi")

    def test_ssml_escapa_texto_e_escolhe_a_voz_do_idioma(self):
        ssml = vn.montar_ssml("Chuva <forte> & vento", vn.nome_da_voz("es", "Rafael"))
        self.assertIn("es-PE-AlexNeural", ssml)
        self.assertIn('xml:lang="es-PE"', ssml)
        self.assertIn("Chuva &lt;forte&gt; &amp; vento", ssml)
        self.assertEqual(vn.nome_da_voz("xx", "Ninguem"), "pt-BR-FranciscaNeural")

    def test_cache_e_limite_por_pessoa(self):
        enviados = []
        voz = vn.VozNuvem(chave="k", regiao="brazilsouth", enviar=lambda ssml: enviados.append(ssml) or b"mp3")
        self.assertEqual(voz.falar("Aviso de tempestade", "pt", "Clara", "1.1.1.1"), b"mp3")
        voz.falar("Aviso de tempestade", "pt", "Clara", "1.1.1.1")
        self.assertEqual(len(enviados), 1, "texto repetido sai do cache")
        for i in range(vn.POR_PESSOA_MIN - 1):
            voz.falar(f"frase {i}", "pt", "Clara", "2.2.2.2")
        voz.falar("ultima", "pt", "Clara", "2.2.2.2")
        with self.assertRaises(vn.LimiteExcedido):
            voz.falar("passou do limite", "pt", "Clara", "2.2.2.2")
        self.assertEqual(voz.falar("outra pessoa", "pt", "Clara", "3.3.3.3"), b"mp3")


if __name__ == "__main__":
    unittest.main()
