import os
import oci
import streamlit as st


# O parametro _config comeca com "_" de proposito: o Streamlit nao o inclui na
# chave do cache, entao a chave privada nao fica indexada em memoria.
# Se a chamada falhar, a excecao sobe e NADA e guardado no cache.
@st.cache_data(ttl=600)
def _chamar_oracle_rag_cache(_config, compartment_id, prompt_sistema):
    genai_client = oci.generative_ai_inference.GenerativeAiInferenceClient(config=_config)

    chat_request = oci.generative_ai_inference.models.CohereChatRequest(
        message=prompt_sistema,
        max_tokens=200,
        temperature=0.3
    )

    chat_detail = oci.generative_ai_inference.models.ChatDetails(
        compartment_id=compartment_id,
        serving_mode=oci.generative_ai_inference.models.OnDemandServingMode(
            model_id="cohere.command-a-03-2025"
        ),
        chat_request=chat_request
    )

    response = genai_client.chat(chat_detail)
    return response.data.chat_response.text


import chromadb
from chromadb.utils import embedding_functions
import glob
import PyPDF2

DOCUMENTOS_DEMO = [
    "Exemplo de demonstração (cenário de enchente): iniciar a evacuação com antecedência nas áreas de vale e garantir água potável e energia no abrigo central desde as primeiras horas.",
    "Exemplo de demonstração (cenário de rompimento de barragem): sirenes terrestres podem falhar; usar também alerta por SMS, principalmente em zona rural.",
    "Exemplo de demonstração (cenário de incêndio): abrigos e tendas médicas precisam de proteção contra fumaça, como purificadores de ar."
]

METADADOS_DEMO = [{"evento": "enchente_rs"}, {"evento": "rompimento_barragem"}, {"evento": "incendio_pantanal"}]

def carregar_pdfs():
    textos_chunks = []
    metadados = []
    ids = []
    contador_id = 0
    pasta = "./documentos_oficiais"
    
    if not os.path.exists(pasta):
        return [], [], []
        
    arquivos = glob.glob(os.path.join(pasta, "*.pdf"))
    for arquivo in arquivos:
        nome_base = os.path.basename(arquivo)
        try:
            with open(arquivo, "rb") as f:
                leitor = PyPDF2.PdfReader(f)
                texto_completo = ""
                # Lendo ate 50 paginas para evitar estouro de tempo/API no hackathon
                for i, pagina in enumerate(leitor.pages):
                    if i > 50: break
                    texto = pagina.extract_text()
                    if texto: texto_completo += texto + " "
                
                # Chunking simples de ~1500 caracteres
                tamanho_chunk = 1500
                for i in range(0, len(texto_completo), tamanho_chunk):
                    chunk = texto_completo[i:i+tamanho_chunk].strip()
                    if len(chunk) > 100:
                        textos_chunks.append(chunk)
                        metadados.append({"fonte": nome_base})
                        ids.append(f"doc_{nome_base}_{contador_id}")
                        contador_id += 1
        except Exception as e:
            print(f"Erro ao ler PDF {nome_base}: {e}")
            
    return textos_chunks, metadados, ids

def obter_colecao():
    if "oci" in st.secrets and "COHERE_API_KEY" in st.secrets["oci"]:
        COHERE_API_KEY = st.secrets["oci"]["COHERE_API_KEY"]
    else:
        raise KeyError("COHERE_API_KEY não encontrada")
    
    chroma_client = chromadb.PersistentClient(path="./banco_historico")
    cohere_ef = embedding_functions.CohereEmbeddingFunction(
        api_key=COHERE_API_KEY,
        model_name="embed-multilingual-v3.0"
    )
    
    # Cria uma nova colecao focada em documentos reais
    colecao = chroma_client.get_or_create_collection(
        name="documentos_oficiais_rag",
        embedding_function=cohere_ef,
        metadata={"hnsw:space": "cosine"}
    )
    
    # Se a colecao estiver vazia, faz o processamento dos PDFs
    if colecao.count() == 0:
        chunks, metas, ids = carregar_pdfs()
        if chunks:
            # Quebra o envio em lotes de 90 para respeitar o limite da API da Cohere
            tamanho_lote = 90
            for i in range(0, len(chunks), tamanho_lote):
                lote_chunks = chunks[i:i+tamanho_lote]
                lote_metas = metas[i:i+tamanho_lote]
                lote_ids = ids[i:i+tamanho_lote]
                colecao.add(documents=lote_chunks, metadatas=lote_metas, ids=lote_ids)
        else:
            # Se nao achar PDF nenhum, insere os de demonstracao para nao quebrar
            ids_demo = [f"demo_{i}" for i in range(len(DOCUMENTOS_DEMO))]
            colecao.add(documents=DOCUMENTOS_DEMO, metadatas=METADADOS_DEMO, ids=ids_demo)
            
    return colecao

@st.cache_data(ttl=600)
def _consultar_historico_cache(evento_nome, ativo_nome=""):
    colecao = obter_colecao()
    resultados = colecao.query(query_texts=[f"{evento_nome}. {ativo_nome}".strip()], n_results=1)
    if resultados['documents'] and len(resultados['documents'][0]) > 0:
        texto_recuperado = resultados['documents'][0][0]
        meta = resultados['metadatas'][0][0]
        fonte = meta.get("fonte", "Base Interna")
        return f"{texto_recuperado} (Fonte original: {fonte})"
    return "Sem dados históricos."

def gerar_recomendacao_rag(evento_nome, ativo_nome, distancia, visao):
    
    # ==========================================
    # RECUPERAÇÃO DO BANCO VETORIAL (O "R" DO RAG)
    # ==========================================
    contexto_historico = "Sem dados históricos."
    try:
        contexto_historico = _consultar_historico_cache(evento_nome, ativo_nome)
    except Exception as e:
        print(f"[RAG] Erro ao buscar no banco vetorial: {e}")

    # ==========================================
    # CONSTRUÇÃO DO PROMPT (O "A" DO RAG)
    # ==========================================
    prompt_sistema = f"""
    Você é a IA de tomada de decisão do Omni-EcoRescue.

    DADOS DO EVENTO ATUAL (TEMPO REAL NASA):
    - Desastre: {evento_nome}
    - Infraestrutura em risco: {ativo_nome}
    - Distância: {distancia:.0f} KM
    - Perfil Solicitante: {visao}

    CONTEXTO RECUPERADO DOS DOCUMENTOS OFICIAIS (BANCO VETORIAL):
    "{contexto_historico}"

    INSTRUÇÃO:
    Você deve formular uma recomendação estratégica. Use o trecho recuperado apenas se for pertinente ao evento; se não for, ignore-o e não o cite.
    Se o perfil for "Corporativo (B2B)", foque na mitigação de risco patrimonial.
    Se o perfil for "Impacto Social / ESG", foque na evacuação e saúde pública.
    Limite a 2 ou 3 frases curtas. Inicie com "**Decisão RAG (IA):**".
    """

    try:
        config = None
        compartment_id = None

        # (a) Tenta st.secrets (arquivo .streamlit/secrets.toml, secao [oci])
        try:
            if "oci" in st.secrets:
                s = st.secrets["oci"]
                config = {
                    "user": s["user"],
                    "fingerprint": s["fingerprint"],
                    "tenancy": s["tenancy"],
                    "region": s["region"],
                    "key_content": s["key_content"],
                }
                compartment_id = s.get("compartment_id") or os.environ.get("OCI_COMPARTMENT_ID")
        except FileNotFoundError:
            pass  # Nao tem secrets.toml, segue para o modo local
        except KeyError as e:
            # Secrets existe, mas falta um campo. Loga so o NOME do campo, nunca o valor.
            print(f"[Oracle RAG] secrets [oci] incompleto: falta o campo {e}")
            config = None
        except Exception as e:
            print(f"[Oracle RAG] erro ao ler secrets ({type(e).__name__})")
            config = None

        # (b) Se nao achou em secrets, tenta o arquivo local ~/.oci/config
        if not config:
            config = oci.config.from_file()
            compartment_id = os.environ.get("OCI_COMPARTMENT_ID")

        if not compartment_id:
            raise ValueError("compartment_id nao encontrado em st.secrets nem na variavel de ambiente.")

        # Valida a config
        oci.config.validate_config(config)

        # Chama a funcao com cache (so respostas reais ficam em cache)
        resposta_oracle = _chamar_oracle_rag_cache(config, compartment_id, prompt_sistema)
        return "**Decisão RAG (IA):** " + resposta_oracle.replace("**Decisão RAG (IA):**", "").strip()

    except Exception as e:
        # Loga so o tipo do erro e uma mensagem curta, sem valores de credencial
        tipo_erro = type(e).__name__
        msg_curta = str(e).split("\n")[0][:60]
        print(f"[Oracle RAG] Fallback ativado ({tipo_erro}: {msg_curta})")

        if visao == "Corporativo (B2B)":
            return "**Modo seguro (texto local):** Interromper operação. O valor atual das ações no mercado amortiza perdas. Evitando dano estrutural bilionário."
        else:
            return "**Modo seguro (texto local):** Enviar kits de descontaminação e água potável. Acionar resgate humanitário prioritário para grupos vulneráveis."