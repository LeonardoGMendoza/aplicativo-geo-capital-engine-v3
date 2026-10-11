"""Leitura dos PDFs oficiais e divisão em trechos para o RAG.

Sem dependência de Streamlit, OCI, Cohere ou Chroma: dá para testar offline.
- Lê TODAS as páginas (antes parava na página 51).
- Guarda a página de cada trecho, para a IA citar "brumadinho.pdf, pág. 132".
- Corta em fim de frase e repete um pedaço entre trechos vizinhos (sobreposição),
  para não perder contexto no corte.
"""
import glob
import os
import re

try:  # pypdf é o nome novo do PyPDF2; aceita qualquer um dos dois
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    from PyPDF2 import PdfReader

TAMANHO_TRECHO = 1200
SOBREPOSICAO = 200
MINIMO_TRECHO = 100

_FIM_DE_FRASE = re.compile(r"(?<=[.!?;])\s+")


def limpar_texto(texto):
    """Junta palavras hifenizadas na quebra de linha e normaliza espaços."""
    texto = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", texto or "")
    return re.sub(r"\s+", " ", texto).strip()


def ler_paginas(arquivo):
    """Lista de (número da página começando em 1, texto limpo), ignorando páginas sem texto."""
    paginas = []
    for numero, pagina in enumerate(PdfReader(arquivo).pages, start=1):
        try:
            texto = limpar_texto(pagina.extract_text())
        except Exception as erro:  # página corrompida não derruba o PDF inteiro
            print(f"[RAG] página {numero} de {os.path.basename(arquivo)} ignorada ({type(erro).__name__})")
            continue
        if texto:
            paginas.append((numero, texto))
    return paginas


def _frases(paginas, tamanho):
    """Quebra o texto em frases, cada uma com sua página; frase gigante é fatiada."""
    for numero, texto in paginas:
        for frase in _FIM_DE_FRASE.split(texto):
            frase = frase.strip()
            while len(frase) > tamanho:
                yield numero, frase[:tamanho]
                frase = frase[tamanho:].strip()
            if frase:
                yield numero, frase


def dividir_em_trechos(paginas, tamanho=TAMANHO_TRECHO, sobreposicao=SOBREPOSICAO):
    """Agrupa frases em trechos de até `tamanho` caracteres.

    Retorna dicts {texto, pagina, pagina_fim}. As últimas frases de um trecho
    (até `sobreposicao` caracteres) se repetem no começo do próximo.
    """
    trechos, atual = [], []

    def fechar():
        texto = " ".join(f for _, f in atual)
        if len(texto) >= MINIMO_TRECHO:
            trechos.append({"texto": texto, "pagina": atual[0][0], "pagina_fim": atual[-1][0]})

    for pagina, frase in _frases(paginas, tamanho):
        if atual and len(" ".join(f for _, f in atual)) + 1 + len(frase) > tamanho:
            fechar()
            repetir, total = [], 0
            for item in reversed(atual):
                total += len(item[1]) + 1
                if total > sobreposicao:
                    break
                repetir.insert(0, item)
            # a repetição nunca pode fazer o trecho passar do tamanho
            atual = repetir if len(" ".join(f for _, f in repetir)) + 1 + len(frase) <= tamanho else []
        atual.append((pagina, frase))
    if atual:
        fechar()
    return trechos


def carregar_trechos(pasta="./documentos_oficiais"):
    """Lê todos os PDFs da pasta. Retorna (documentos, metadados, ids) prontos para o Chroma."""
    documentos, metadados, ids = [], [], []
    for arquivo in sorted(glob.glob(os.path.join(pasta, "*.pdf"))):
        fonte = os.path.basename(arquivo)
        try:
            trechos = dividir_em_trechos(ler_paginas(arquivo))
        except Exception as erro:
            print(f"[RAG] Erro ao ler PDF {fonte}: {type(erro).__name__}")
            continue
        for n, trecho in enumerate(trechos):
            documentos.append(trecho["texto"])
            metadados.append({"fonte": fonte, "pagina": trecho["pagina"], "pagina_fim": trecho["pagina_fim"]})
            ids.append(f"{fonte}_p{trecho['pagina']}_{n}")
    return documentos, metadados, ids


def citar(meta):
    """'brumadinho.pdf, pág. 132' ou 'pág. 132-133'."""
    fonte = meta.get("fonte", "base interna")
    pagina, fim = meta.get("pagina"), meta.get("pagina_fim")
    if not pagina:
        return fonte
    return f"{fonte}, pág. {pagina}" + (f"-{fim}" if fim and fim != pagina else "")


def exportar_json(destino, pasta="./documentos_oficiais"):
    """Gera o arquivo de trechos usado pela API do site (backend/api/data/rag_trechos.json)."""
    import hashlib
    import json
    documentos, metadados, ids = carregar_trechos(pasta)
    trechos = [{"id": i, "texto": d, **m} for i, d, m in zip(ids, documentos, metadados)]
    versao = hashlib.sha256(json.dumps(trechos, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:16]
    with open(destino, "w", encoding="utf-8") as arquivo:
        json.dump({"versao": versao, "trechos": trechos}, arquivo, ensure_ascii=False, separators=(",", ":"))
    return versao, len(trechos)


if __name__ == "__main__":
    # python -m backend.rag_pdfs  -> atualiza backend/api/data/rag_trechos.json depois de mudar os PDFs
    print(exportar_json(os.path.join("backend", "api", "data", "rag_trechos.json")))
