"""Inteligência (IA) do site: busca nos documentos oficiais (RAG) + resposta da IA da Oracle.

- Os trechos dos PDFs já vêm prontos em data/rag_trechos.json (gerado por `python -m backend.rag_pdfs`).
- Na primeira vez, cada trecho vira um vetor pela Cohere (embed-multilingual-v3.0) e o resultado
  fica salvo em RAG_DATA_DIR (volume do Docker): nas próximas subidas, carrega em segundos.
- A busca é por similaridade de cosseno em Python puro (1.239 vetores), sem banco extra.
- A resposta é escrita pela IA da Oracle Cloud (OCI Generative AI, Cohere Command A).
  Sem Oracle configurada, ou se ela falhar, a API devolve só os trechos encontrados.
Chaves só por variável de ambiente (deploy/ia.env no servidor), nunca no código ou no GitHub.
"""
import base64
import json
import logging
import math
import os
import threading
import time
from array import array
from collections import OrderedDict, deque

import httpx

log = logging.getLogger("uvicorn.error")

COHERE_EMBED_URL = "https://api.cohere.com/v2/embed"
EMBED_MODEL = "embed-multilingual-v3.0"
CHAT_MODEL = "cohere.command-a-03-2025"
LOTE = 90  # a Cohere aceita até 96 textos por chamada
TRECHOS_POR_PERGUNTA = 3
PERFIS = {
    "defesa_civil": "Defesa Civil / coordenação de resposta: foque em evacuação, abrigos, comunicação com a população e prioridades.",
    "comunidade": "Cidadão / comunidade: linguagem simples, o que fazer para se proteger e onde buscar ajuda.",
    "empresa": "Empresa: foque em segurança das pessoas, continuidade da operação e mitigação de risco ao patrimônio.",
}
_PADRAO_TRECHOS = os.path.join(os.path.dirname(__file__), "data", "rag_trechos.json")


class NaoConfigurado(Exception):
    """Falta a chave da Cohere: a busca não pode funcionar."""


class Preparando(Exception):
    """Os vetores ainda estão sendo calculados."""


class LimiteExcedido(Exception):
    """Muitas perguntas em pouco tempo."""


def _normalizar(vetor):
    norma = math.sqrt(sum(v * v for v in vetor)) or 1.0
    return [v / norma for v in vetor]


class Embedder:
    """Chama a Cohere direto por HTTPS (sem SDK)."""

    def __init__(self, api_key, client=None, pausa=0.0):
        self.api_key = api_key
        self.client = client or httpx.Client(timeout=60)
        self.pausa = pausa

    def __call__(self, textos, tipo):
        for tentativa in range(5):
            resposta = self.client.post(COHERE_EMBED_URL, headers={"Authorization": f"Bearer {self.api_key}"}, json={
                "model": EMBED_MODEL, "texts": textos, "input_type": tipo, "embedding_types": ["float"]})
            if resposta.status_code == 429 and tentativa < 4:  # limite da conta: espera e tenta de novo
                time.sleep(min(60, 5 * 2 ** tentativa))
                continue
            resposta.raise_for_status()
            if self.pausa:
                time.sleep(self.pausa)
            return resposta.json()["embeddings"]["float"]
        raise RuntimeError("Cohere recusou por limite de uso")


class OracleChat:
    """Gera a resposta com a IA da Oracle Cloud. Importa o SDK só no primeiro uso (é pesado)."""

    def __init__(self, config, compartment_id):
        self.config, self.compartment_id, self._client = config, compartment_id, None
        self._lock = threading.Lock()

    def __call__(self, prompt):
        import oci  # noqa: PLC0415

        with self._lock:
            if self._client is None:
                oci.config.validate_config(self.config)
                self._client = oci.generative_ai_inference.GenerativeAiInferenceClient(config=self.config, timeout=(10, 45))
        modelos = oci.generative_ai_inference.models
        detalhe = modelos.ChatDetails(
            compartment_id=self.compartment_id,
            serving_mode=modelos.OnDemandServingMode(model_id=CHAT_MODEL),
            chat_request=modelos.CohereChatRequest(message=prompt, max_tokens=350, temperature=0.3))
        return self._client.chat(detalhe).data.chat_response.text.strip()


def oracle_do_ambiente(env=os.environ):
    """Monta o cliente Oracle a partir de OCI_*; None se faltar algo."""
    chave = env.get("OCI_KEY_CONTENT", "")
    if not chave and env.get("OCI_KEY_B64"):
        chave = base64.b64decode(env["OCI_KEY_B64"]).decode("utf-8")
    campos = {"user": env.get("OCI_USER"), "fingerprint": env.get("OCI_FINGERPRINT"),
              "tenancy": env.get("OCI_TENANCY"), "region": env.get("OCI_REGION"), "key_content": chave}
    compartimento = env.get("OCI_COMPARTMENT_ID")
    if not all(campos.values()) or not compartimento:
        return None
    return OracleChat(campos, compartimento)


class Inteligencia:
    def __init__(self, trechos_path=_PADRAO_TRECHOS, data_dir=None, embedder=None, chat=None,
                 limite_minuto=20, limite_ip_minuto=6, cache_max=200, cache_segundos=600):
        with open(trechos_path, encoding="utf-8") as arquivo:
            dados = json.load(arquivo)
        self.versao, self.trechos = dados["versao"], dados["trechos"]
        self.data_dir = data_dir or os.getenv("RAG_DATA_DIR", "/data")
        self.embedder, self.chat = embedder, chat
        self.estado = "sem_chave" if embedder is None else "parado"
        self.prontos, self.erro = 0, None
        self.vetores = None  # array('f') achatado, já normalizado
        self.dimensao = 0
        self._lock = threading.Lock()
        self._thread = None
        self._chamadas = deque()
        self._por_ip = {}
        self.limite_minuto, self.limite_ip_minuto = limite_minuto, limite_ip_minuto
        self._cache = OrderedDict()
        self.cache_max, self.cache_segundos = cache_max, cache_segundos

    # ---------- montagem dos vetores ----------
    @property
    def arquivo_vetores(self):
        return os.path.join(self.data_dir, f"rag_vetores_{self.versao}.bin")

    def iniciar(self):
        """Carrega os vetores salvos ou calcula em segundo plano. Pode ser chamado várias vezes."""
        with self._lock:
            if self.embedder is None or self.estado in ("preparando", "pronto"):
                return
            self.estado, self.erro = "preparando", None
            self._thread = threading.Thread(target=self._montar, name="rag-vetores", daemon=True)
            self._thread.start()

    def _montar(self):
        try:
            if os.path.exists(self.arquivo_vetores):
                self._carregar()
            else:
                self._calcular()
            self.estado = "pronto"
            log.info("RAG pronto: %s trechos", len(self.trechos))
        except Exception as erro:  # não derruba a API: a tela mostra "indisponível"
            self.estado, self.erro = "erro", type(erro).__name__
            log.warning("RAG falhou ao preparar (%s)", type(erro).__name__)

    def _carregar(self):
        vetores = array("f")
        with open(self.arquivo_vetores, "rb") as arquivo:
            vetores.frombytes(arquivo.read())
        if len(vetores) % len(self.trechos):
            raise ValueError("arquivo de vetores não confere com os trechos")
        self.dimensao = len(vetores) // len(self.trechos)
        self.vetores, self.prontos = vetores, len(self.trechos)

    def _calcular(self):
        vetores = array("f")
        for inicio in range(0, len(self.trechos), LOTE):
            lote = [t["texto"] for t in self.trechos[inicio:inicio + LOTE]]
            for vetor in self.embedder(lote, "search_document"):
                vetores.extend(_normalizar(vetor))
            self.prontos = min(len(self.trechos), inicio + LOTE)
        self.dimensao = len(vetores) // len(self.trechos)
        os.makedirs(self.data_dir, exist_ok=True)
        temporario = self.arquivo_vetores + ".tmp"
        with open(temporario, "wb") as arquivo:
            arquivo.write(vetores.tobytes())
        os.replace(temporario, self.arquivo_vetores)  # só aparece completo
        self.vetores = vetores

    # ---------- uso ----------
    def status(self):
        documentos = {}
        for t in self.trechos:
            documentos[t["fonte"]] = max(documentos.get(t["fonte"], 0), t["pagina_fim"])
        return {"estado": self.estado, "trechos": len(self.trechos), "prontos": self.prontos,
                "iaConfigurada": self.chat is not None, "versao": self.versao,
                "paginas": sum(documentos.values()),
                "documentos": [{"fonte": f, "paginas": p} for f, p in sorted(documentos.items())]}

    def _controlar_limite(self, ip, agora):
        for fila in (self._chamadas, self._por_ip.setdefault(ip, deque())):
            while fila and agora - fila[0] > 60:
                fila.popleft()
        if len(self._chamadas) >= self.limite_minuto or len(self._por_ip[ip]) >= self.limite_ip_minuto:
            raise LimiteExcedido()
        self._chamadas.append(agora)
        self._por_ip[ip].append(agora)
        if len(self._por_ip) > 1000:  # não cresce para sempre
            self._por_ip = {k: v for k, v in self._por_ip.items() if v}

    def buscar(self, pergunta, k=TRECHOS_POR_PERGUNTA):
        consulta = _normalizar(self.embedder([pergunta], "search_query")[0])
        d, vetores = self.dimensao, self.vetores
        notas = []
        for i in range(len(self.trechos)):
            linha = vetores[i * d:(i + 1) * d]
            notas.append((sum(a * b for a, b in zip(consulta, linha)), i))
        notas.sort(reverse=True)
        return [{"fonte": self.trechos[i]["fonte"], "pagina": self.trechos[i]["pagina"],
                 "paginaFim": self.trechos[i]["pagina_fim"], "texto": self.trechos[i]["texto"],
                 "similaridade": round(max(0.0, nota), 3)} for nota, i in notas[:k]]

    def perguntar(self, pergunta, perfil="defesa_civil", ip="?"):
        pergunta = " ".join((pergunta or "").split())
        if not 3 <= len(pergunta) <= 300 or perfil not in PERFIS:
            raise ValueError("pergunta ou perfil inválido")
        if self.embedder is None:
            raise NaoConfigurado()
        if self.estado != "pronto":
            self.iniciar()
            raise Preparando()
        chave, agora = (pergunta.lower(), perfil), time.monotonic()
        guardado = self._cache.get(chave)
        if guardado and agora - guardado[0] < self.cache_segundos:
            return guardado[1]
        self._controlar_limite(ip, agora)
        trechos = self.buscar(pergunta)
        resposta, modo = None, "documentos"
        if self.chat is not None:
            try:
                resposta, modo = self.chat(montar_prompt(pergunta, perfil, trechos)), "ia"
            except Exception as erro:
                log.warning("Oracle falhou (%s); devolvendo só os trechos", type(erro).__name__)
        resultado = {"pergunta": pergunta, "perfil": perfil, "modo": modo, "resposta": resposta,
                     "modelo": "Oracle Cloud · Cohere Command A" if modo == "ia" else None,
                     "trechos": trechos, "isSimulation": False,
                     "aviso": "Sugestão baseada em documentos oficiais de desastres passados. Não substitui a Defesa Civil: revise antes de agir."}
        self._cache[chave] = (agora, resultado)
        while len(self._cache) > self.cache_max:
            self._cache.popitem(last=False)
        return resultado


def citar(t):
    paginas = f"{t['pagina']}" + (f"-{t['paginaFim']}" if t["paginaFim"] != t["pagina"] else "")
    return f"{t['fonte']}, pág. {paginas}"


def montar_prompt(pergunta, perfil, trechos):
    contexto = "\n\n".join(f"[{n}] ({citar(t)}) {t['texto']}" for n, t in enumerate(trechos, start=1))
    return f"""Você é a IA de apoio à decisão do Omni-EcoRescue, um protótipo acadêmico de resposta a desastres.

QUEM PERGUNTA: {PERFIS[perfil]}

PERGUNTA: {pergunta}

TRECHOS DE DOCUMENTOS OFICIAIS (planos de contingência, relatório de Brumadinho, RIMAs):
{contexto}

INSTRUÇÕES:
- Responda em português, em no máximo 5 frases curtas e práticas.
- Use somente as informações dos trechos. Depois de cada informação, cite a fonte entre parênteses, por exemplo (brumadinho.pdf, pág. 12).
- Se os trechos não tratarem da pergunta, diga isso claramente e não invente.
- Não prometa rota segura, vaga em abrigo ou resgate. A decisão final é humana e da Defesa Civil."""


def criar_do_ambiente(env=os.environ):
    chave = env.get("COHERE_API_KEY")
    return Inteligencia(embedder=Embedder(chave, pausa=1.0) if chave else None, chat=oracle_do_ambiente(env))
