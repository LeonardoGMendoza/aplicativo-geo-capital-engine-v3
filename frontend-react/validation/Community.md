# Impacto Social — Prompt 14

Implementação e validação em 09/10/2026 (Brasília), branch `feature/react-migration`.

## Implementado

- `/comunidade` carrega as descrições exclusivamente de GET `/api/v1/assets` e seleciona referências pelo `asset.id`.
- Busca por descrição comunitária ou nome do ativo, sem distinção de acentos ou caixa. Descrições repetidas permanecem separadas; ausência recebe um rótulo, sem criação de cadastro.
- Contexto comunitário, identificação e coordenadas do ativo, triagem e avisos em cartões claros.
- Consulta somente do ativo selecionado, via `getProximityForAssets([asset.id], fetchedAt)` e `useCorporateScreening` existentes.
- Sessão NASA compartilhada, sem alterar seus filtros. Troca de referência ou atualização NASA invalida a consulta e impede respostas anteriores de preencher outro contexto.
- Distância identificada explicitamente como distância entre o evento NASA e o ativo; nenhum marcador comunitário, raio ou zona de vulnerabilidade.
- Mapa Leaflet existente, com fallback de carregamento e boundary de erro restrito ao mapa. Informações textuais permanecem fora desse boundary.
- Preparação editorial fixa com as quatro perguntas aprovadas, independente da seleção e do resultado.
- Limitações comunitárias próximas ao resultado e em seção complementar.

## Arquivos criados

- `src/features/community/CommunityPage.tsx`
- `src/features/community/reference.ts`
- `src/features/community/components/CommunityReferenceList.tsx`
- `src/features/community/components/CommunityContextPanel.tsx`
- `src/features/community/components/PreparationGuidance.tsx`
- `tests/community-reference.test.mjs`

## Arquivos alterados

- `src/app/App.tsx`: registro da rota funcional.
- `src/app/navigation.ts`: descrição de contexto e preparação geral.

Clientes, hook corporativo, mapa, dashboard, backend e Streamlit preservados. Sem instalação, commit ou push.

## Verificação automatizada

- `npm test`: **52 aprovados** (44 anteriores + 8 novos).
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- Novos testes: associação por ID após reordenar, busca comunitária/ativo, descrições repetidas/ausentes, resposta assíncrona após seleção diferente, invalidação NASA, estados parcial/bloqueado/indisponível e requisição de um único ID.
- Testes de concorrência exercitam o controle de geração reutilizado pelo hook; a troca de seleção e a atualização também foram verificadas no navegador. Não foi adicionada uma biblioteca de testes de componentes.

## Consulta real e disponibilidade

A API local permaneceu operacional. Inicialmente NASA retornou timeout e o POST respondeu `unavailable`, sem pares avaliados. Cadastro, contexto e preparação continuaram acessíveis e os botões de triagem ficaram bloqueados.

Na nova tentativa, a fonte recuperou:

- GET `/assets`: 11 ativos de referência.
- GET `/events`: HTTP 200, 7.143 eventos, `success`, qualidade `partial`.
- POST para `mvp-vale-carajas`: HTTP 200, `partial`, 7.141 pares, EONET_11075 a 46,21 km do ativo, observação de 09/09/2024 identificada como antiga, 2 eventos omitidos, `riskConfirmed: false`.
- Lote corporativo: `partial`, 78.551 pares, 9 correspondências.
- Individual Petrobras: `partial`, EONET_11087, 371,98 km do ativo.

Requisição e resposta atuais em `community-api.json`. Os números são resultados dessa consulta, não constantes usadas pela página.

## Navegador

- Pesquisa por Pescadores e Vale; comunidade, nome, ID e coordenadas corresponderam ao ativo selecionado.
- Consulta iniciada para Petrobras seguida imediatamente de seleção Vale: contexto novo mostrou “Não consultado”; a consulta Vale apresentou somente seu evento.
- Atualização NASA limpou o resultado concluído e manteve cadastro e conteúdo editorial.
- Preparação permaneceu idêntica após troca de seleção.
- Categoria `severeStorms` e busca `Hurricane Simon` preservadas ao navegar por Impacto Social.
- Dashboard: prévia de Deslizamento de terra mostrou Morro do Sol, Alto; fechamento normal.
- Corporativo e explorador individual foram consultados novamente após recuperação NASA.
- 1536/390/320 px: scrollWidth 1521/375/305 px, sem transbordamento horizontal.
- Nenhum texto operacional inspecionado abaixo de 12 px; nenhum botão, input ou select visível do conteúdo principal abaixo de 44 px de altura.
- Console registrado sem erros ou avisos.

Capturas completas: `community-1536.jpg`, `community-390.jpg`, `community-320.jpg`. Contexto e inspeções: `community-browser.json`.

## Limitações e pendências

- Sem localização comunitária verificada, população, vulnerabilidade ou avaliação operacional.
- Correspondência é apenas do ativo; observações antigas continuam elegíveis conforme a regra existente.
- Fonte externa pode falhar; o timeout real foi observado e recuperou sem alterações Python.
- Erros 409/422 e demais respostas inválidas permanecem cobertos pelos testes existentes do cliente; não foram provocados no serviço real nesta etapa.
- O fallback para falha total do componente do mapa não foi induzido manualmente. O mapa OSM carregou durante a validação e seu fallback de tiles existente foi preservado.
- Resultados são locais à página: voltar após sair exige nova triagem.
- Sem RAG, WhatsApp, ONGs, ações operacionais ou novos dados de simulação. Nenhuma pendência de implementação dentro do escopo aprovado.
