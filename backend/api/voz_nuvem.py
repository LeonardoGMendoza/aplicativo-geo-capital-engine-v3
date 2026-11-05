"""Voz neural da Azure para o assistente do Modo acessível (Clara e Rafael, as mesmas do VinaCare).

A chave fica só no servidor (deploy/azure.env: AZURE_SPEECH_KEY e AZURE_SPEECH_REGION), nunca no GitHub.
Sem a chave, a rota responde 503 e a tela usa a voz do próprio celular (que também funciona sem internet).
Limite por pessoa e limite geral por hora, para ninguém gastar a cota da Azure.
"""
import os
import threading
import time
from collections import OrderedDict, defaultdict, deque
from xml.sax.saxutils import escape

VOZES = {
    "pt": {"Clara": "pt-BR-FranciscaNeural", "Rafael": "pt-BR-AntonioNeural"},
    "es": {"Clara": "es-PE-CamilaNeural", "Rafael": "es-PE-AlexNeural"},
    "en": {"Clara": "en-US-JennyNeural", "Rafael": "en-US-GuyNeural"},
}
MAX_TEXTO = 900
POR_PESSOA_MIN = 20        # pedidos por minuto por pessoa
GERAL_HORA = 600           # pedidos por hora no total


class LimiteExcedido(Exception):
    pass


class VozNaoConfigurada(Exception):
    pass


def nome_da_voz(idioma, assistente):
    return VOZES.get(idioma, VOZES["pt"]).get(assistente, VOZES["pt"]["Clara"])


def montar_ssml(texto, voz, velocidade="-8%"):
    lingua = "-".join(voz.split("-")[:2]) or "pt-BR"   # ex.: es-PE-CamilaNeural -> es-PE
    return (f'<speak version="1.0" xml:lang="{lingua}"><voice name="{voz}">'
            f'<prosody rate="{velocidade}">{escape(texto)}</prosody></voice></speak>')


class Limitador:
    def __init__(self, agora=time.monotonic):
        self._agora, self._lock = agora, threading.Lock()
        self._pessoa, self._geral = defaultdict(deque), deque()

    def checar(self, quem):
        t = self._agora()
        with self._lock:
            fila = self._pessoa[quem]
            while fila and t - fila[0] > 60:
                fila.popleft()
            while self._geral and t - self._geral[0] > 3600:
                self._geral.popleft()
            if len(fila) >= POR_PESSOA_MIN or len(self._geral) >= GERAL_HORA:
                raise LimiteExcedido()
            fila.append(t)
            self._geral.append(t)
            if len(self._pessoa) > 5000:  # não deixa a memória crescer
                self._pessoa = defaultdict(deque, {k: v for k, v in self._pessoa.items() if v})


class VozNuvem:
    def __init__(self, chave=None, regiao=None, enviar=None, env=os.environ):
        self.chave = chave if chave is not None else env.get("AZURE_SPEECH_KEY", "")
        self.regiao = regiao if regiao is not None else env.get("AZURE_SPEECH_REGION", "")
        self._enviar = enviar or self._enviar_azure
        self._cache, self._lock = OrderedDict(), threading.Lock()
        self.limite = Limitador()

    @property
    def configurada(self):
        return bool(self.chave and self.regiao)

    def _enviar_azure(self, ssml):
        import urllib.request
        req = urllib.request.Request(f"https://{self.regiao}.tts.speech.microsoft.com/cognitiveservices/v1",
                                     data=ssml.encode("utf-8"), method="POST", headers={
                                         "Ocp-Apim-Subscription-Key": self.chave, "Content-Type": "application/ssml+xml",
                                         "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "Omni-EcoRescue"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()

    def falar(self, texto, idioma="pt", assistente="Clara", quem="?"):
        if not self.configurada:
            raise VozNaoConfigurada()
        texto = " ".join((texto or "").split())[:MAX_TEXTO]
        if not texto:
            raise ValueError("texto vazio")
        voz = nome_da_voz(idioma, assistente)
        chave = (voz, texto)
        with self._lock:
            if chave in self._cache:  # repetido (ex.: o mesmo guia): não gasta a cota de novo
                self._cache.move_to_end(chave)
                return self._cache[chave]
        self.limite.checar(quem)
        audio = self._enviar(montar_ssml(texto, voz))
        with self._lock:
            self._cache[chave] = audio
            while len(self._cache) > 200:
                self._cache.popitem(last=False)
        return audio
