# Triagem de proximidade de ativos — primeira entrega

## Procedência e regra

`backend/api/assets.json`: extração fiel dos 11 registros `frontend/painel_ceo.py::mapa_dados`, com IDs explícitos, versão `panel-assets-v1`, `isReferenceData=true` e `verifiedAt=null`. Nomes, coordenadas e descrições de comunidades permanecem iguais; não se afirma operação ou verificação de campo. Testes detectam divergência futura do cadastro. O painel não é importado/executado.

`backend/api/geography.py` extrai Haversine com raio terrestre **6371 km**, ordem latitude/longitude, validação finita/geográfica e clamp de arredondamento nos antípodas. Nenhum Python original foi alterado.

Regra implementada: `legacy-panel-assets-600-nearest`, versão 1, distância **estritamente <600 km**, evento mais próximo por ativo, primeiro evento em empate, resultados ordenados por distância como `calcular_alertas_ativos`. Não retorna todos os eventos no raio: isso mudaria a seleção do MVP. Não aceita raio arbitrário/outro perfil.

**500 km** permanece no `backend/omni_engine_alertas.py`, primeiro evento dentro do raio. `backend/central_executiva.py` usa **600 km**, também primeiro evento. Esses motores não são executados nem combinados com o catálogo do painel. Regras/abrigos originais permanecem intactos.

## Contratos implementados

### GET /api/v1/assets

HTTP 200: `assets[]` com `id`, `name`, `coordinates.latitude/longitude`, `sourceFile`, `communityDescription`, `isReferenceData`, `verifiedAt`; envelope `datasetVersion`, `policy` (ID, versão, raio, operador, seleção e fonte), `isReferenceData=true`, `communitiesStatus=pending_no_verified_coordinates`.

### POST /api/v1/geography/proximity

```json
{
  "targetIds": ["mvp-petroquimico-triunfo"],
  "policyId": "legacy-panel-assets-600-nearest",
  "expectedFetchedAt": "COPIAR fetchedAt DE GET /api/v1/events"
}
```

O horário acima é placeholder: substitua pelo timestamp ISO real. Aceita 1 a 11 IDs únicos existentes. Campos extras, IDs desconhecidos e outros perfis: HTTP 422. O servidor usa **todo o catálogo NASA**, sem aceitar coordenadas/eventos do browser e sem aplicar os filtros visuais. Ativos seguem a ordem original do cadastro.

Reutiliza timeout/cache do serviço NASA existente. `expectedFetchedAt` deve coincidir com a obtenção usada pelo servidor. Cache desatualizado ou consulta diferente bloqueiam a análise e exigem atualizar o catálogo. É uma guarda de consistência; snapshots persistentes da proposta não foram implementados.

Resposta: `state`, `policy`, `method=haversine_sphere_6371km`, `source`, `sourceUrl`, `eventsFetchedAt`, `analyzedAt`, `datasetVersion`, `integrationState`, `cache`, `ageSeconds`, `evaluatedPairCount`, `matches[]`, `skipped[]`, `warnings[]`, `isSimulation=false`, `targetsAreReferenceData=true`, `riskConfirmed=false`, `requiresHumanConfirmation=true`.

Correspondência: `asset` completo, `event` normalizado completo (identidade, categorias, coordenadas/método, horário/estado da observação e origem), `distanceKm` sem arredondamento para comparar, `geometryApproximate`, `withinThreshold=true`. A tela arredonda somente a apresentação. Omitidos: ID e motivo `missing|invalid|unsupported`.

| Estado | HTTP | Significado |
|---|---|---|
| success | 200 | Correspondências sem ressalvas de qualidade |
| empty | 200 | Fonte validamente vazia ou pares válidos sem correspondências |
| partial | 200 | Localizações ignoradas, observações antigas/desconhecidas, categorias ausentes ou polígonos aproximados; pode não haver correspondências |
| blocked | 409 | Nenhuma localização utilizável, cache antigo ou consulta diferente |
| unavailable | 503 | Falha NASA; `integrationState` distingue erro de indisponibilidade |

Consulta NASA vazia legítima é diferente de todos os eventos ignorados: este último estado é bloqueado. Nenhuma falha/localização ausente vira distância zero, ausência de risco ou recomendação operacional.

`GET /api/v1/communities` **pendente, não implementado (404)**. Descrições de comunidades são texto; coordenadas dos ativos não são coordenadas das comunidades.

## Geometria e limites

A normalização existente mantém a **última geometria na ordem recebida**, mesmo se sua data não for a mais recente. Point usa o ponto; Polygon usa o primeiro vértice, `geometryApproximate=true`, nunca centroide/distância à borda. Tipos não suportados, coordenadas ausentes, não finitas/fora dos limites são ignorados com motivo. Observações antigas/desconhecidas permanecem elegíveis para preservar a regra legada, mas tornam o resultado parcial. Cache desatualizado bloqueia.

Distância geodésica aproximada não mede trajeto, extensão do fenômeno, exposição, vulnerabilidade, impacto ou segurança. Cadastros de referência limitam conclusões. Não há alto/médio/baixo, Oracle RAG, WhatsApp, notificação ou acionamento novo.

## Interface e validação

Quando a API informa indisponibilidade NASA, o catálogo local de ativos ainda pode ser visualizado, mas a triagem fica bloqueada. Uma falha de conexão durante a análise remove o resultado anterior e exibe erro explícito. O modo Simulação mantém o mapa ilustrativo separado dos ativos/NASA.

Em `/mapa`, consulte NASA e marque **Visualizar ativos cadastrados no MVP**. Eventos mantêm círculos por categoria; ativos usam quadrado azul com **◆**, borda turquesa e procedência no popup. Selecione ativo na lista ou marcador, clique **Consultar proximidade**. Filtros NASA afetam apenas o explorador; triagem usa catálogo completo. Centro de Operações não foi modificado. A camada de ativos é opcional e reinicia ao desmontar o explorador; a sessão/filtros NASA mantêm a navegação anterior.

Reinicie o backend existente para carregar os novos endpoints. Na raiz:

```powershell
backend/api/.venv/Scripts/python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

Em outro terminal: `cd frontend-react`, `npm run dev`. Não há dependências novas. CORS permite GET e POST nas origens locais configuradas, sem credenciais. OpenAPI: `http://127.0.0.1:8000/docs`.

```powershell
backend/api/.venv/Scripts/python -m unittest discover -s backend/api/tests
cd frontend-react
npm test
npm run typecheck
npm run build
```

Testes NASA usam MockTransport/ASGITransport sem internet. A paridade extrai somente funções puras/cadastro do AST do painel, sem imports, Streamlit, RAG ou ações. Cobrem distâncias conhecidas/inválidas, limites estritos 500/600, empate, seleção, múltiplas geometrias, polígonos, indisponibilidade, vazio, omissões, CORS e timestamp incompatível. Frontend verifica contrato/destino HTTP, distinção de estados e rejeição de risco confirmado/dados inválidos.

**Recomendações IA e expansão da análise aguardam aprovação.**
