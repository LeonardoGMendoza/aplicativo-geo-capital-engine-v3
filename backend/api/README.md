# Omni-EcoRescue — API de consulta NASA EONET

Nova triagem de ativos: `GET /api/v1/assets` e `POST /api/v1/geography/proximity`. Contratos efetivos, estados, regra do painel (<600 km, mais próximo por ativo), procedência e validação em [geographic-analysis-implementation.md](../../docs/geographic-analysis-implementation.md). `/api/v1/communities` permanece pendente. Nenhuma dependência nova.

Adaptador de leitura isolado, sem importar Streamlit, motores de risco, RAG ou módulos que executem ações. O MVP permanece intacto.

## Origem da lógica

Inspecionados `frontend/painel_ceo.py` (`buscar_nasa`, `ponto_evento`), `frontend/omni_ecoresue_mvp.py`, `dados_satelite/coletor_nasa.py`, `backend/omni_engine_alertas.py` e `backend/central_executiva.py`.

`nasa.py` extrai a consulta principal do painel: EONET v3, `status=open`, categorias `wildfires,severeStorms,earthquakes,floods`, timeout de 10 segundos e TTL de 600 segundos. Nenhum import do painel, execução de Streamlit ou alteração dos arquivos existentes. O cliente HTTP é assíncrono e a API distingue falhas da lista vazia, ao contrário do tratamento original. O padrão da última geometria e do primeiro vértice do polígono foi preservado na normalização, com validação adicional. Não é centroide, distância, risco, previsão ou rota segura. As regras originais de 500/600 km permanecem intactas. A triagem nova reutiliza a seleção do painel (<600 km, evento mais próximo por ativo), sem classificação de risco.

## Instalação e execução local (PowerShell, na raiz do repositório)

Validado com Python 3.14.3. Ambiente separado do MVP; não instalar suas dependências Streamlit/OCI nesta venv.

```powershell
python -m venv backend/api/.venv
backend/api/.venv/Scripts/python -m pip install -r backend/api/requirements-lock.txt
backend/api/.venv/Scripts/python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

`requirements.txt` fixa as dependências diretas; `requirements-lock.txt` registra a resolução completa validada. OpenAPI: `http://127.0.0.1:8000/docs`.

Em outro terminal:

```powershell
cd frontend-react
npm ci
npm run dev
```

React: `http://127.0.0.1:5173`. O cliente usa `http://127.0.0.1:8000` por padrão. Para outra URL, copie `.env.example` para `.env.local`, ajuste `VITE_API_BASE_URL` e reinicie o Vite. Nenhum segredo deve estar em variáveis `VITE_*`.

O dashboard inicia em **Simulação** e não consulta NASA até selecionar **Consultar NASA**. Apenas o novo catálogo consulta a API; os demais painéis e o mapa permanecem fictícios. **Atualizar consulta** consulta o backend, respeitando seu cache. Não há polling automático.

## Configuração de servidor

Variáveis são lidas do ambiente na inicialização; nenhum arquivo `.env` é carregado automaticamente.

| Variável | Padrão | Uso |
|---|---|---|
| `NASA_EONET_ENABLED` | `true` | `false` impede chamadas NASA e retorna indisponibilidade explícita |
| `NASA_TIMEOUT_SECONDS` | `10` | Prazo total da chamada e limites HTTP por fase |
| `NASA_CACHE_SECONDS` | `600` | TTL da resposta, inclusive resultado vazio bem-sucedido |
| `NASA_MAX_STALE_SECONDS` | `3600` | Idade máxima para servir última resposta como desatualizada |
| `NASA_RETRY_SECONDS` | `30` | Intervalo mínimo de nova tentativa depois de falha |
| `NASA_OBSERVATION_MAX_AGE_SECONDS` | `86400` | Marca a observação de cada evento como antiga; não determina validade ou risco |
| `REACT_CORS_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Lista de origens permitidas, separadas por vírgula |

Durações devem ser positivas e finitas; idade máxima de cache deve ser maior ou igual ao TTL. CORS permite GET e POST, sem cookies/credenciais e sem origem curinga por padrão. Para outra porta Vite, inclua sua origem exata. A API pública EONET utilizada não precisa de token; nenhuma credencial nova foi adicionada. URL NASA é fixa no servidor.

Para verificar indisponibilidade sem acessar a internet:

```powershell
$env:NASA_EONET_ENABLED = 'false'
backend/api/.venv/Scripts/python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

Depois de encerrar esse processo, `$env:NASA_EONET_ENABLED = 'true'` habilita consulta no próximo início. `GET /status` nunca consulta a NASA.

## Contratos

- `GET /api/v1/status`: HTTP 200 significa API funcionando. `nasa.enabled`, `nasa.state`, `fetchedAt`, idade e erro descrevem o estado local da integração. `unavailable` antes da primeira consulta não significa falha de saúde da API nem ausência de eventos.
- `GET /api/v1/events`: envelope `state`, `source`, `sourceUrl`, `query`, `queriedAt`, `fetchedAt`, `ageSeconds`, `cache`, `dataQuality`, `error`, `events`, `isSimulation=false`, `riskCalculated=false`.
- Evento: `id`, `title`, `categories[]`, `source`, `coordinates` (latitude/longitude/método ou null), `coordinateState`, `geometryType`, `observedAt` (UTC ou null), `observationState`, `isSimulation=false`.

| Estado | HTTP | Significado |
|---|---|---|
| `success` | 200 | Resposta válida com eventos; localização/horário podem estar parciais |
| `empty` | 200 | Consulta válida sem eventos nas categorias consultadas; não significa ausência de risco |
| `stale` | 200 | Última resposta conhecida, fora do TTL ou após falha; pode conter zero eventos |
| `unavailable` | 503 | Desabilitado, timeout ou falha de rede sem cache utilizável |
| `error` | 502 | Erro HTTP NASA ou contrato/JSON inválido sem cache utilizável |

Erros públicos são sanitizados (`disabled`, `timeout`, `network`, `upstream_http`, `invalid_response`), sem URL de requisição, traceback ou valores de ambiente. Cache stale inclui erro quando há falha conhecida. Resposta sem o campo `events` é erro, nunca sucesso vazio. Identidade/título inválidos invalidam a resposta; problemas de geometria preservam o evento com coordenadas nulas. Datas ausentes, inválidas, futuras ou sem fuso são desconhecidas. Geometrias não suportadas não viram pontos inventados.

**Horários distintos:** `queriedAt` é atendimento da requisição API; `fetchedAt` é obtenção bem-sucedida da NASA; `observedAt` é o horário da última geometria fornecida pela fonte. Evento aberto com observação antiga não é encerrado automaticamente. `dataQuality=partial` explicita localização, categoria ou data antiga/ausente. A observação antiga usa um limiar de apresentação configurável, sem alterar qualquer regra de risco.

Cache em memória, por processo, com lock para evitar consultas simultâneas duplicadas e recuperação após falha. Não persiste após reinício e não é compartilhado entre workers. A API envia `Cache-Control: no-store`; o browser não deve mascarar estados com cache próprio. Por enquanto use um worker. Não há autenticação ou armazenamento; escopo de desenvolvimento local.

## Testes offline

```powershell
backend/api/.venv/Scripts/python -m unittest discover -s backend/api/tests -v
cd frontend-react
npm run test
npm run typecheck
npm run build
```

19 testes Python com `httpx.MockTransport`/`ASGITransport`, sem internet: normalização, coordenadas ausentes/inválidas, ponto/polígono/geometrias não suportadas, datas antigas, timeout HTTP e total, erro HTTP/rede/JSON/contrato, vazio, cache válido/stale/expirado, espera entre tentativas, concorrência, serviço desabilitado, endpoints/status e CORS. Importação testada sem carregar Streamlit.

7 testes Node do cliente tipado, sem dependência adicional: eventos parciais, vazio, HTTP 502/503, stale inclusive vazio, contrato inválido, rede/timeout, erro HTTP inesperado e status. Testes requerem Node 22.18+ ou 24 LTS (remoção nativa de tipos TS); validado com Node 24.14.1.

Revisão manual local: React → FastAPI com NASA desabilitada, mensagem de indisponibilidade sem afirmar ausência de risco, retorno à simulação e layout responsivo. Sucesso/vazio/stale usam fixtures nos testes; não foi feita consulta real NASA nesta validação. Build e typecheck aprovados.

## Limites desta fase

Nenhum mapa real, cálculo de risco, envio de alerta, WhatsApp, resgate, inferência IA ou confirmação de operação. Não há paridade funcional completa React/Streamlit. Próximas fases dependem da revisão: validar regras existentes com entradas fixas, ampliar contratos e só então mapear coordenadas, revisar alertas e estabelecer decisões humanas persistidas.

Fontes de contrato: [NASA EONET v3](https://eonet.gsfc.nasa.gov/docs/v3) e [CORS FastAPI](https://fastapi.tiangolo.com/tutorial/cors/). EONET é um catálogo curado de eventos naturais, não uma leitura direta de satélites nem uma previsão validada de risco local.
