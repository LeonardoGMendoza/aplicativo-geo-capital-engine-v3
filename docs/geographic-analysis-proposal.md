# Análise geográfica futura — proposta, não implementada

Registro da proposta original. A primeira triagem de ativos foi posteriormente autorizada e implementada; consulte `docs/geographic-analysis-implementation.md` para o contrato efetivo. `/communities`, snapshots persistentes, outros perfis, IA e ações continuam pendentes. As seções abaixo preservam a proposta para comparação.

## Componentes atuais e destino futuro

| Origem | Componente/dado existente | Aproveitamento futuro e limite |
|---|---|---|
| `backend/api/nasa.py` | `NasaService`, `normalize_events` | Fonte comum de eventos, horários, qualidade e cache; não calcula distância |
| `backend/api/models.py` | `Event`, `Coordinates`, `EventsResponse` | IDs de evento, coordenadas validadas e método do ponto; localização de polígono é primeiro vértice |
| `frontend/painel_ceo.py` | `calcular_distancia`, `ponto_evento`, `calcular_alertas_ativos` | Extrair funções puras após aprovação; não importar o arquivo, que executa Streamlit |
| `frontend/painel_ceo.py` | `mapa_dados` (11 ativos), `ABRIGOS` (8 referências) | Catalogar em módulo sem UI, atribuir IDs estáveis e procedência. Cadastros de referência não comprovam operação/disponibilidade |
| `backend/omni_engine_alertas.py` | `calcular_distancia_km`, `ATIVOS_EMPRESA` (4 ativos) | Haversine e perfil legado de 500 km. Não chamar `rodar_motor_georreferencial`, que consulta NASA e produz mensagens operacionais |
| `backend/central_executiva.py` | `calcular_distancia`, `ATIVOS_GLOBAIS` (3 ativos) | Perfil de 600 km e contexto ESG. Não chamar `iniciar_central_executiva`: envolve bolsa, NASA e mensagens de ação |
| `frontend/omni_ecoresue_mvp.py` | Haversine, `ABRIGOS`, laço eventos/abrigos | Preservar o comportamento legado, inclusive limitação aos primeiros 50 eventos e escolha por ordem |
| Campos `comunidade_vizinha`, `risco_secundario` dos ativos | Descrições de comunidades e cenários | Não há cadastro georreferenciado independente das comunidades; não usar coordenadas do ativo como se fossem da comunidade |
| `frontend-react/src/features/nasa/` | Cliente, sessão, explorer, seleção, mapa e resumo | Apresentação de resultados separados do catálogo NASA e dos fixtures; não implementar cálculos no browser |
| `backend/oracle_rag.py` e tela RAG do painel | Recuperação/recomendação | Fora do escopo da análise de distância. Distância vetorial/cosseno do RAG não é distância em km |

## Regras atuais, sem alterações

Todas as funções geográficas inspecionadas usam Haversine em uma esfera de raio **6371 km**, com parâmetros em ordem latitude/longitude. A NASA fornece pares longitude/latitude; a inversão precisa ser explícita e testada.

| Perfil atual | Comparação | Escolha do evento |
|---|---|---|
| `omni_engine_alertas.rodar_motor_georreferencial` | `distancia < 500` km | Primeiro evento dentro do raio; interrompe o laço |
| `central_executiva.iniciar_central_executiva` | `dist < 600` km | Primeiro evento dentro do raio; interrompe o laço |
| `painel_ceo.calcular_alertas_ativos(..., raio_km=600)` | `d < raio_km` | Evento mais próximo dentro do raio para cada ativo; resultados ordenados por distância; em empate mantém o primeiro |
| Abrigos no `painel_ceo.py` | `dist < 600` km | Primeiro evento aceito por abrigo, não necessariamente o mais próximo; ordena depois por distância |
| Abrigos no `omni_ecoresue_mvp.py` | `dist < 600` km | Mesmo critério de primeiro evento, mas examina apenas `eventos[:50]` |
| Faixas legadas dos abrigos/recomendação local | `<100`, depois `<300`, depois demais correspondências `<600` | 100 km já entra na faixa intermediária; 300 km na última; 600 km não corresponde |

500 km exatos também não correspondem ao perfil de 500 km. As faixas antigas têm rótulos de alerta no MVP; a análise futura não deve reproduzir esses rótulos como risco confirmado. Há diferença de cor intermediária entre a lista e o texto da recomendação local: preservar e registrar a divergência, sem usá-la para criar nova classificação nesta fase.

`ponto_evento` escolhe a última geometria da lista e desce a primeira sequência aninhada até o primeiro par numérico. A normalização API preserva esse primeiro vértice para Polygon e rejeita geometrias não suportadas. O fluxo antigo de abrigos assume par simples e não trata polígonos da mesma forma. Não substituir silenciosamente por centroide, distância à borda ou por geometria ordenada pela data.

Limites: distância em linha geodésica aproximada não equivale a percurso, tempo de viagem, extensão do evento, exposição, vulnerabilidade ou impacto. Dados antigos/incompletos, polígonos representados por um vértice, cadastros de referência e ausência de coordenadas das comunidades limitam a análise. Falha NASA não autoriza concluir ausência de proximidade ou risco. Os cadastros e categorias consultadas também divergem entre os motores. Nenhum deles será executado ou unificado antes de revisão.

## Contratos REST propostos — não existem ainda

### `GET /api/v1/assets`

Catálogo validado com `id`, `name`, `coordinates`, `sourceFile`, `datasetVersion`, `isReferenceData`, `verifiedAt`, `communityRefs`. IDs não devem depender da posição do item no array. Expor apenas campos necessários, sem credenciais.

### `GET /api/v1/communities`

`id`, `name`, `coordinates` ou null, `locationStatus=verified|missing|reference`, `source`, `linkedAssetIds`, `verifiedAt`. Descrições atuais podem permanecer com localização ausente; análise espacial deve ser bloqueada nesses casos. Não inventar geocodificação ou população.

### `POST /api/v1/geography/proximity`

Análise de leitura, sem efeitos operacionais. Requisição proposta:

```json
{
  "eventIds": ["EONET_ID"],
  "targetType": "asset",
  "targetIds": ["CATALOG_ID"],
  "policyId": "legacy-panel-assets-600-nearest",
  "snapshotId": "SERVER_ISSUED_SNAPSHOT",
  "allowStale": false
}
```

`policyId` é uma lista permitida e versionada no servidor: preserva raio, operador estrito e escolha nearest/first, inclusive limite de 50 quando aplicável. Não aceitar raio arbitrário como nova regra de negócio. O catálogo de políticas e aprovação de cada perfil ficam pendentes. `snapshotId` é proposto para garantir consistência entre IDs, dados e horários; requer decisão posterior sobre versão de snapshot, pois não existe na API atual.

Resposta proposta:

```json
{
  "state": "success",
  "policy": {
    "id": "legacy-panel-assets-600-nearest",
    "version": "1",
    "radiusKm": 600,
    "operator": "lt",
    "selection": "nearest_per_target"
  },
  "method": "haversine_sphere_6371km",
  "source": "NASA EONET",
  "eventsFetchedAt": "TIMESTAMP",
  "analyzedAt": "TIMESTAMP",
  "datasetVersion": "VERSION",
  "isSimulation": false,
  "targetsAreReferenceData": true,
  "riskConfirmed": false,
  "requiresHumanConfirmation": true,
  "matches": [{
    "eventId": "EONET_ID",
    "targetId": "CATALOG_ID",
    "distanceKm": 42.5,
    "eventLocationMethod": "point",
    "withinThreshold": true
  }],
  "skipped": [],
  "warnings": ["Proximidade não confirma risco local."]
}
```

Os valores do exemplo são exclusivamente ilustrativos do contrato, não resultados calculados. `isSimulation` descreve a análise/eventos; `targetsAreReferenceData` identifica separadamente o cadastro de referência, evitando apresentar ativos ou abrigos como operacionais. `requiresHumanConfirmation` informa o requisito para decisões futuras; esta proposta não cria aprovação, envio ou execução.

Estados propostos: `success`, `empty` (análise válida sem correspondências), `partial` (pares ignorados com motivo), `blocked` (sem coordenadas, snapshot incompatível ou dados antigos não autorizados), `unavailable` (fonte inacessível). Nenhum par ignorado vira distância zero. `empty` só pode ocorrer depois de processar dados válidos, com `evaluatedPairCount` e motivos em `skipped`; não significa ausência de risco. Datas, versão, qualidade, estado de cache e advertências devem acompanhar o resultado.

## Critérios de aceite antes de implementar

1. Aprovar catálogo e procedência dos alvos, principalmente comunidades sem coordenadas; escolher explicitamente os perfis legados, sem consolidá-los por conveniência.
2. Extrair funções puras mantendo o Streamlit; comparar entradas/saídas fixas contra cada versão original, sem chamar seus fluxos externos.
3. Testar distância zero, coordenadas invertidas/inválidas, limites exatos 100/300/500/600, empate, primeiro versus mais próximo, primeiros 50, ausência de geometria e representação de polígonos.
4. Testar resposta vazia versus falha, observações antigas, cache, snapshot e cadastro incompleto. Identificar todas as omissões no resultado.
5. Mostrar análise de proximidade em área própria, preservando NASA/catalogação, simulação e indicadores fictícios separados; nenhuma recomendação IA ou ação operacional nesta liberação.

**Situação atual:** triagem de ativos do painel implementada conforme `geographic-analysis-implementation.md`. A proposta completa não foi implementada: comunidades, snapshots persistentes e outros perfis permanecem pendentes.
