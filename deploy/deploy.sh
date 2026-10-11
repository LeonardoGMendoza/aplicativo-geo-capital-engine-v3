#!/usr/bin/env bash
# Atualiza o Omni-EcoRescue no servidor: baixa o código, sobe a API e publica as telas.
# Uso (no servidor, como root):  bash /opt/omni-ecorescue/deploy/deploy.sh
set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SITE_DIR="/var/www/omni"
PUBLIC_URL="https://omni.sandlj.com.br"
cd "$REPO_DIR"

echo "== 1/4 Baixando a versão mais nova do GitHub =="
git pull --ff-only

echo "== 2/4 Subindo a API (Docker, porta 8010 só local) =="
docker compose -f deploy/docker-compose.yml up -d --build
docker image prune -f >/dev/null

echo "== 3/4 Gerando as telas (React) =="
docker run --rm -v "$REPO_DIR/frontend-react:/app" -w /app \
  -e VITE_API_BASE_URL="$PUBLIC_URL" node:22-alpine \
  sh -c "npm ci --no-audit --no-fund && npm run build"

echo "== 4/4 Publicando as telas no nginx =="
mkdir -p "$SITE_DIR"
rm -rf "$SITE_DIR.new" && cp -r frontend-react/dist "$SITE_DIR.new"
rm -rf "$SITE_DIR.old" && { [ -d "$SITE_DIR" ] && mv "$SITE_DIR" "$SITE_DIR.old" || true; }
mv "$SITE_DIR.new" "$SITE_DIR"

echo "== Conferindo =="
sleep 3
curl -s -o /dev/null -w "API status: %{http_code}\n" "http://127.0.0.1:8010/api/v1/status"
curl -s -o /dev/null -w "Site:       %{http_code}\n" "$PUBLIC_URL/"
curl -s -o /dev/null -w "Cidadao:    %{http_code}\n" "$PUBLIC_URL/cidadao"
echo "Pronto: $PUBLIC_URL  e  $PUBLIC_URL/cidadao"
