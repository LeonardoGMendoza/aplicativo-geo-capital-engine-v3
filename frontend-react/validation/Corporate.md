# Visão Corporativa — Prompt 12

Validação em 09/10/2026, branch `feature/react-migration`.

## Implementação

- `/corporativo` apresenta o catálogo da API, contexto NASA, indicadores, mapa existente, busca, ordenação, lista e detalhes por identificador estável.
- Uma requisição POST consulta os 11 IDs únicos. A consulta individual conserva sua assinatura, payload e testes anteriores.
- Sem consulta, os indicadores derivados mostram “Não consultado”. Carregamento, falha, bloqueio, resultado completo e parcial permanecem distintos.
- Um evento pode corresponder a vários ativos. Linhas são associadas por `asset.id`; marcadores de eventos são deduplicados por `event.id`.
- Contexto inclui horário de obtenção NASA, horário de análise, data da observação, qualidade, avisos e omissões.
- Cadastro de referência, eventos reais e indicadores simulados do dashboard não são combinados.
- A triagem considera o catálogo NASA integral e não altera os filtros do explorador.
- Mudanças no contexto invalidam resultados; AbortController, geração de requisição e verificação do contexto impedem respostas antigas de preencher a tela.
- UTC `Z` e `+00:00` são comparados como o mesmo instante, preservando a precisão dos microssegundos.

## Arquivos de código criados

- `src/features/corporate/CorporatePage.tsx`
- `src/features/corporate/useCorporateScreening.ts`
- `src/features/corporate/screening.ts`
- `src/features/corporate/components/CorporateAssetList.tsx`
- `src/features/corporate/components/CorporateAssetDetails.tsx`
- `tests/corporate-screening.test.mjs`

## Arquivos de código modificados

- `src/features/nasa/proximity.ts`
- `src/app/App.tsx`
- `src/app/navigation.ts`

Backend, Streamlit, estilos globais, componentes do mapa e dashboard não foram alterados. Sem instalação, commit ou push.

## Testes executados

- `npm test`: **44 aprovados**, incluindo os 30 anteriores e 14 novos.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.

Novos testes: lote único de 11 IDs; duplicados, limite e IDs inesperados; correspondências repetidas por ativo; evento compartilhado; ordem diferente; distância menor que 600; parcial; origem simulada e geometria inválida; 409/422/503/rede; contexto diferente; UTC equivalente com microssegundos; catálogo duplicado; resposta assíncrona invalidada; estados e ordenação por ID.

Os testes de invalidação assíncrona verificam o controle de geração usado pelo hook. A troca da consulta também foi verificada manualmente no navegador. Não há nova dependência de testes de componentes.

## Consulta real

API existente em `http://127.0.0.1:8000`:

- GET `/api/v1/assets`: 11 referências, versão `panel-assets-v1`.
- GET `/api/v1/events`: HTTP 200, 7.143 eventos, estado `success`, qualidade `partial`.
- POST `/api/v1/geography/proximity`, lote: HTTP 200, estado `partial`, 78.551 pares avaliados, 9 correspondências, 2 eventos omitidos, `riskConfirmed: false`.
- Consulta individual Petrobras: EONET_11087, 371,98 km, observação de 12/09/2024, estado parcial.

JSON com requisição, resposta de lote e resposta individual: `corporate-api.json`. Quantidades representam essa consulta, não valores fixos da aplicação.

## Navegador

- 1536 px: scrollWidth 1521 px; 390 px: 375 px; 320 px: 305 px. A diferença corresponde à barra de rolagem; nenhum transbordamento horizontal.
- Nenhum texto operacional inspecionado abaixo de 12 px.
- Nenhum botão, input ou select visível do conteúdo principal com altura inferior a 44 px.
- Sem mensagens de erro ou aviso no console registrado.
- Petrobras selecionada na lista: contexto EONET_11087, 371,98 km, comunidade e coordenadas correspondentes.
- Vale selecionada pelo marcador: EONET_11075, 46,21 km, contexto atualizado corretamente.
- Busca e ordenação não alteraram indicadores ou escopo do lote.
- Atualizar NASA removeu imediatamente resultados e eventos correspondentes, mantendo o cadastro.
- Explorar NASA com categoria `severeStorms` e busca `Hurricane Simon`, navegar para corporativo, consultar e retornar: filtros preservados.
- Triagem individual com os filtros acima continuou consultando o catálogo integral.
- Dashboard: detalhe de “Deslizamento de terra” apresentou “Morro do Sol”, status “Alto”; prévia fechada normalmente.

Capturas completas: `corporate-1536.jpg`, `corporate-390.jpg`, `corporate-320.jpg`. Inspeções e contexto selecionado: `corporate-browser.json`.

## Limitações

- A regra retorna somente o evento mais próximo dentro de 600 km por ativo, não todos os eventos próximos.
- Observações antigas continuam elegíveis conforme a regra existente e recebem identificação explícita.
- Ativos e comunidades são referências não verificadas; não representam condição operacional ou impacto confirmado.
- 409, 422, 503 e rede foram cobertos por fixtures dos testes. Não foi provocada indisponibilidade do serviço real ou dos tiles OSM.
- O fallback OSM existente foi preservado. A lista não depende de tiles.
- Resultados corporativos são locais à página: sair e voltar exige nova triagem; a sessão NASA e seus filtros permanecem compartilhados.
- Sem finanças, RAG, WhatsApp, classificação de risco ou bloqueio operacional.
