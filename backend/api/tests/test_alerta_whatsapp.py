"""Envio real de alerta por WhatsApp: código do operador, destino e repasse ao n8n (sem internet)."""
import os
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest import mock

try:
    from backend.api.alerta_whatsapp import Invalido, Limitador, calcular_nivel, enviar, formatar_destino, montar_mensagem
except ImportError:  # FastAPI ausente neste ambiente
    enviar = None


@unittest.skipIf(enviar is None, "FastAPI não instalado neste ambiente")
class AlertaWhatsApp(unittest.TestCase):
    def pedido(self, **kw):
        base = dict(codigo="segredo123", destino="(51) 99999-1234", local="Vila de Pescadores", evento="Wildfire in Brazil 1022190", recomendacao="1. Ative o alarme **já** (rima_petrobras.pdf, pág. 31-32).", origem="NASA EONET", publico="comunidade", km=372.4, observadoEm="2024-09-12T19:00:00Z", categoria="Wildfires")
        return SimpleNamespace(**{**base, **kw})

    def test_destino_igual_ao_streamlit(self):
        self.assertEqual(formatar_destino("(51) 99999-1234"), "5551999991234@c.us")
        self.assertEqual(formatar_destino("5551999991234"), "5551999991234@c.us")
        self.assertEqual(formatar_destino("120363000000000000@g.us"), "120363000000000000@g.us")
        for ruim in ["123", "abc@g.us", ""]:
            with self.assertRaises(Invalido):
                formatar_destino(ruim)

    def test_sem_configuracao_ou_codigo_errado_nao_envia(self):
        postar = mock.Mock()
        with mock.patch.dict(os.environ, {"OPERADOR_CODIGO": "", "N8N_ALERTA_URL": "http://n8n/webhook/alerta-omni"}):
            self.assertEqual(enviar(self.pedido(), postar)[0], 503)
        with mock.patch.dict(os.environ, {"OPERADOR_CODIGO": "segredo123", "N8N_ALERTA_URL": "http://n8n/webhook/alerta-omni"}):
            self.assertEqual(enviar(self.pedido(codigo="errado"), postar)[0], 403)
            self.assertEqual(enviar(self.pedido(destino="12"), postar)[0], 422)
        postar.assert_not_called()

    def test_envia_ao_n8n_mensagem_pronta_com_token(self):
        postar = mock.Mock(return_value=SimpleNamespace(status_code=200))
        env = {"OPERADOR_CODIGO": "segredo123", "N8N_ALERTA_URL": "http://n8n/webhook/alerta-omni", "CADASTROS_TOKEN": "t" * 30}
        with mock.patch.dict(os.environ, env):
            status, corpo = enviar(self.pedido(), postar)
            self.assertEqual(status, 200)
            self.assertEqual(corpo["nivel"], "MONITORAR")
            url, = postar.call_args.args
            self.assertEqual(url, "http://n8n/webhook/alerta-omni")
            self.assertEqual(postar.call_args.kwargs["headers"], {"X-Omni-Token": "t" * 30})
            enviado = postar.call_args.kwargs["json"]
            self.assertEqual(enviado["telefone"], "5551999991234@c.us")
            self.assertEqual(enviado["mensagem"], corpo["previa"])
            self.assertEqual(enviado["local"], "Vila de Pescadores")  # campos antigos continuam
            postar.return_value = SimpleNamespace(status_code=500)
            self.assertEqual(enviar(self.pedido(), postar)[0], 502)
            postar.side_effect = RuntimeError()
            self.assertEqual(enviar(self.pedido(), postar)[0], 502)

    def test_nivel_fixo_por_distancia_e_idade(self):
        self.assertEqual(calcular_nivel(30, 1), "AGIR")
        self.assertEqual(calcular_nivel(150, 5), "ATENÇÃO")
        self.assertEqual(calcular_nivel(372, 400), "MONITORAR")
        self.assertEqual(calcular_nivel(30, 400), "MONITORAR", "evento antigo nunca vira AGIR")
        self.assertEqual(calcular_nivel(None, 1), "ATENÇÃO", "evento do Mapa de Riscos (sem distância) e recente")
        self.assertEqual(calcular_nivel(None, 30), "MONITORAR")
        self.assertEqual(calcular_nivel(30, None), "MONITORAR", "sem data, nunca AGIR")

    def test_mensagem_sem_invencao_com_link_e_fonte(self):
        agora = datetime(2026, 10, 12, tzinfo=timezone.utc)
        texto, nivel = montar_mensagem(self.pedido(), agora)
        self.assertEqual(nivel, "MONITORAR")
        self.assertIn("https://omni.sandlj.com.br/cidadao", texto)
        self.assertIn("rima_petrobras.pdf, pág. 31-32", texto)
        self.assertIn("12/09/2024 (há 2 anos)", texto)
        self.assertNotIn("**", texto)
        self.assertNotIn("evacu", texto.lower(), "o modelo nunca manda evacuar sozinho")
        empresa, _ = montar_mensagem(self.pedido(publico="empresa", local="Plataforma Petrobras (Pre-Sal, Brasil)"), agora)
        self.assertIn("ALERTA OPERACIONAL", empresa)
        self.assertIn("responsável de segurança", empresa)
        self.assertNotIn("199", empresa)
        sem_km, _ = montar_mensagem(self.pedido(km=None), agora)
        self.assertIn("Wildfire in Brazil 1022190 (Wildfires). Última observação", sem_km)

    def test_limite_por_ip(self):
        t = [0.0]
        lim = Limitador(agora=lambda: t[0])
        self.assertTrue(all(lim.permitir("1") for _ in range(10)))
        self.assertFalse(lim.permitir("1"))
        self.assertTrue(lim.permitir("2"))
        t[0] = 3601
        self.assertTrue(lim.permitir("1"))
