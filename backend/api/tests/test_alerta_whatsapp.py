"""Envio real de alerta por WhatsApp: código do operador, destino e repasse ao n8n (sem internet)."""
import os
import unittest
from types import SimpleNamespace
from unittest import mock

try:
    from backend.api.alerta_whatsapp import Invalido, Limitador, enviar, formatar_destino
except ImportError:  # FastAPI ausente neste ambiente
    enviar = None


@unittest.skipIf(enviar is None, "FastAPI não instalado neste ambiente")
class AlertaWhatsApp(unittest.TestCase):
    def pedido(self, **kw):
        base = dict(codigo="segredo123", destino="(51) 99999-1234", local="Vila de Pescadores", evento="Wildfire a 160 km", recomendacao="Evacuar", origem="NASA EONET")
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

    def test_envia_ao_n8n_com_os_campos_do_streamlit(self):
        postar = mock.Mock(return_value=SimpleNamespace(status_code=200))
        with mock.patch.dict(os.environ, {"OPERADOR_CODIGO": "segredo123", "N8N_ALERTA_URL": "http://n8n/webhook/alerta-omni"}):
            status, corpo = enviar(self.pedido(), postar)
            self.assertEqual(status, 200)
            url, = postar.call_args.args
            self.assertEqual(url, "http://n8n/webhook/alerta-omni")
            self.assertEqual(postar.call_args.kwargs["json"], {"local": "Vila de Pescadores", "evento": "Wildfire a 160 km", "recomendacao_ia": "Evacuar", "origem": "NASA EONET", "telefone": "5551999991234@c.us"})
            postar.return_value = SimpleNamespace(status_code=500)
            self.assertEqual(enviar(self.pedido(), postar)[0], 502)
            postar.side_effect = RuntimeError()
            self.assertEqual(enviar(self.pedido(), postar)[0], 502)

    def test_limite_por_ip(self):
        t = [0.0]
        lim = Limitador(agora=lambda: t[0])
        self.assertTrue(all(lim.permitir("1") for _ in range(10)))
        self.assertFalse(lim.permitir("1"))
        self.assertTrue(lim.permitir("2"))
        t[0] = 3601
        self.assertTrue(lim.permitir("1"))
