# Omni-EcoRescue V3 — API NASA EONET e triagem de proximidade

Estado do MVP em 10/10/2026. Triagem de 11 ativos de referência: `GET /api/v1/assets` e `POST /api/v1/geography/proximity`. Contratos efetivos, estados, regra do painel (<600 km, mais próximo por ativo), procedência e validação em [geographic-analysis-implementation.md](../../docs/geographic-analysis-implementation.md). `/api/v1/communities` permanece pendente (404). Dependências diretas e resolução completa constam dos arquivos requirements versionados.

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

O Centro de Operações inicia em **Simulação** e seus alertas/indicadores permanecem demonstrativos. Consulta NASA exige ação explícita; resumo e explorador `/mapa` usam esta API. `/corporativo` carrega o cadastro e consulta os 11 ativos em lote; `/comunidade` consulta o ativo associado à referência selecionada. `/abrigos` usa cadastro, distâncias e checklist locais, sem esta API. Consultas respeitam o cache do servidor; não há polling automático. Estado registrado numa consulta não comprova disponibilidade atual.

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
- `GET /api/v1/assets`: catálogo de 11 ativos de referência, versão `panel-assets-v1`, política e descrições comunitárias sem coordenadas comunitárias verificadas.
- `POST /api/v1/geography/proximity`: de 1 a 11 IDs únicos, `policyId` e `expectedFetchedAt`; Haversine, evento mais próximo por ativo, distância estritamente inferior a 600 km. Estados `success`, `empty`, `partial` (200), `blocked` (409), `unavailable` (503); requisição inválida retorna 422. Preserva `riskConfirmed=false`, `targetsAreReferenceData=true` e `requiresHumanConfirmation=true`.
- Snapshot stale ou horário incompatível bloqueia a triagem, sem correspondências. Atualizar os eventos e enviar nova triagem com o `fetchedAt` válido; atualizar não força ignorar TTL/regras do cache.
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

Estado validado em 10/10/2026: **26 testes Python** e **75 testes frontend**, TypeScript e build aprovados. Testes Python usam `httpx.MockTransport`/`ASGITransport`, sem chamadas NASA reais: normalização, geometrias/datas, vazio, falhas HTTP/rede/contrato, timeout, cache válido/stale/expirado, concorrência, endpoints e CORS; proximidade cobre paridade com o cadastro/funções puras do painel, distância estrita, empate, múltiplas geometrias, parcial e bloqueio por snapshot incompatível. O painel não é importado nem executado pelos serviços da API.

Testes frontend usam Node 22.18+ (validado com Node 24.14.1): contratos, busca/geografia, validação individual/lote, estados parciais/bloqueados/indisponíveis, procedência, cancelamento/invalidação, consistência demonstrativa, checklist e comunicação do snapshot. A regressão do cabeçalho renderiza o componente real em SSR com hooks isolados; não substitui uma suíte E2E completa.

Validações manuais anteriores fizeram consultas reais NASA e testes controlados de indisponibilidade/mapas, conforme [README React](../../frontend-react/README.md). São registros anteriores, sem garantia de resultados atuais ou disponibilidade externa. Os relatórios de QA são históricos; capturas e JSONs citados são locais e não versionados.

## Limites atuais

A API implementa consulta de eventos e triagem geográfica, não classificação de risco, previsão, avaliação de segurança, roteamento, disponibilidade operacional de abrigos, impacto/população comunitária, recomendação Oracle RAG ou envio de comunicação. O React possui mapas geográficos de leitura e preserva informações textuais quando o mapa falha. Não há paridade completa React/Streamlit, autenticação, persistência de snapshots ou decisões operacionais. Para a demonstração local, usar um worker; operação pública em produção exige revisão separada.

Fontes de contrato: [NASA EONET v3](https://eonet.gsfc.nasa.gov/docs/v3) e [CORS FastAPI](https://fastapi.tiangolo.com/tutorial/cors/). EONET é um catálogo curado de eventos naturais, não uma leitura direta de satélites nem uma previsão validada de risco local.
