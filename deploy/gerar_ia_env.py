"""Gera deploy/ia.env (chaves da IA para o servidor) a partir de .streamlit/secrets.toml.

Rodar NO PC, na pasta do projeto:   python deploy/gerar_ia_env.py
O arquivo gerado está no .gitignore: nunca vai para o GitHub. Não mande o conteúdo para ninguém.
No fim, mostra um comando para colar no terminal do servidor.
"""
import base64
import os
import sys
import tomllib

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ORIGEM = os.path.join(RAIZ, ".streamlit", "secrets.toml")
DESTINO = os.path.join(RAIZ, "deploy", "ia.env")
NO_SERVIDOR = "/opt/omni-ecorescue/deploy/ia.env"


def montar(secrets, ambiente=os.environ):
    oci = secrets.get("oci", {})
    valores = {
        "COHERE_API_KEY": oci.get("COHERE_API_KEY") or secrets.get("COHERE_API_KEY"),
        "OCI_USER": oci.get("user"),
        "OCI_FINGERPRINT": oci.get("fingerprint"),
        "OCI_TENANCY": oci.get("tenancy"),
        "OCI_REGION": oci.get("region"),
        "OCI_COMPARTMENT_ID": oci.get("compartment_id") or ambiente.get("OCI_COMPARTMENT_ID"),
        "OCI_KEY_B64": base64.b64encode(oci["key_content"].encode("utf-8")).decode("ascii") if oci.get("key_content") else None,
    }
    faltando = [nome for nome, valor in valores.items() if not valor]
    linhas = [f"{nome}={str(valor).strip()}" for nome, valor in valores.items() if valor]
    return "\n".join(linhas) + "\n", faltando


def main():
    if not os.path.exists(ORIGEM):
        sys.exit(f"Não achei {ORIGEM}. Rode este script na pasta do projeto, no PC que tem o secrets.toml.")
    with open(ORIGEM, "rb") as arquivo:
        conteudo, faltando = montar(tomllib.load(arquivo))
    if "COHERE_API_KEY" in faltando:
        sys.exit("Falta a COHERE_API_KEY no secrets.toml: sem ela a busca nos documentos não funciona.")
    with open(DESTINO, "w", encoding="utf-8", newline="\n") as arquivo:
        arquivo.write(conteudo)
    print(f"OK: gerado {DESTINO} (fora do GitHub).")
    if faltando:
        print("ATENÇÃO, faltam:", ", ".join(faltando))
        print("Sem eles a busca nos documentos funciona, mas a resposta escrita pela IA da Oracle fica desligada.")
    codificado = base64.b64encode(conteudo.encode("utf-8")).decode("ascii")
    print("\nAgora copie a linha abaixo INTEIRA e cole no terminal do SERVIDOR (não mande para ninguém):\n")
    print(f"echo '{codificado}' | base64 -d > {NO_SERVIDOR} && chmod 600 {NO_SERVIDOR} && echo IA_ENV_OK")


if __name__ == "__main__":
    main()
