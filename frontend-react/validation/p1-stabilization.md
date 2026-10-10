# Estabilização P1 — Omni-EcoRescue V3

Validação em 10/10/2026. Base: branch `feature/react-migration`, HEAD `3c46827bdf43ea76b6fd081f5a764e9eca97043e`.

## Resultado e escopo

Alterações exclusivamente no frontend React. Nenhum backend, Streamlit, contrato HTTP, regra de distância, dado demonstrativo ou biblioteca alterado. Nenhuma instalação, integração nova, comunicação real, commit ou push.

- Alertas redireciona `/alertas` para `/#central-alertas`, com uma única central existente, rolagem e foco acessível. O menu mobile fecha e o foco permanece na central.
- Histórico e Configurações foram ocultados no menu desktop/mobile. Suas rotas reservadas continuam presentes.
- Inteligência (IA) está rotulada como futura, com aviso explícito de que IA/Oracle RAG ainda não estão integrados ao React.
- Marca e layout passaram a comunicar dados/contexto e apoio à decisão humana, sem promessas de previsão própria ou recomendações de IA em operação.
- NASA e Corporativo recebem um boundary apenas em torno do mapa lazy/Suspense; erros de carregamento ou renderização não removem listas, detalhes, filtros ou contexto. O aviso tem `role=alert`. Os boundaries existentes de Impacto Social/Abrigos foram preservados.
- A consulta individual delega à mesma função usada pelo lote. Passa a validar IDs, horário, identidade do snapshot com microssegundos e fusos equivalentes, procedência demonstrativa/real, confirmação humana, versão do cadastro, política e contexto geográfico. Os estados partial/blocked/unavailable, avisos e omissões são preservados. `riskConfirmed=false` não é convertido em risco confirmado.
- A API continua recebendo apenas targetIds, expectedFetchedAt e policyId. A regra permanece distância estritamente menor que 600 km e evento mais próximo por ativo.

## Arquivos modificados ou novos

- `src/app/App.tsx`
- `src/app/navigation.ts`
- `src/components/layout/AppLayout.tsx`
- `src/components/shared/Brand.tsx`
- `src/components/shared/MapErrorBoundary.ts`
- `src/features/corporate/CorporatePage.tsx`
- `src/features/nasa/NasaMapExplorer.tsx`
- `src/features/nasa/proximity.ts`
- `src/features/operations/components/AlertCenter.tsx`
- `tests/proximity.test.mjs`
- `tests/p1-stabilization.test.mjs`
- `validation/p1-map-failure.mjs`
- `validation/p1-stabilization.md`

As capturas JPG e medições JSON estão no diretório validation, ignoradas pelas regras já existentes. Nenhuma regra de gitignore foi alterada nesta etapa.

## Verificações automáticas

- `npm --prefix frontend-react test`: 74/74 aprovados (65 existentes e 9 novos); nenhum skip ou falha.
- `npm --prefix frontend-react run typecheck`: aprovado.
- `npm --prefix frontend-react run build`: aprovado.
- `git diff --check`: aprovado. Avisos LF/CRLF são informativos do Git no Windows.

Os novos testes cobrem seleção do menu e identificação futura; ligação da rota Alertas/foco; textos; boundary normal/degradado; matriz individual/lote de snapshot, procedência, política, distância, risco falso e contexto; estados parciais, bloqueados/indisponíveis e input inválido antes da chamada. Parte das verificações de ligação de componentes/navegação é estrutural; o comportamento real foi complementado no navegador.

## Validação manual

Aplicação/build real no navegador, larguras 1536, 390 e 320 px. Centro, Corporativo, Impacto Social, Abrigos e IA inspecionados nas três larguras. NASA e Corporativo também inspecionados com mapas e dados reais nas três larguras. As medições de scrollWidth e clientWidth foram iguais em cada página: sem overflow horizontal global. A barra de rolagem vertical consome 15 px em algumas telas. As rolagens internas do dashboard/listas foram preservadas.

- Alertas desktop, 390 e 320: hash correto, uma central, foco `central-alertas` e fechamento do menu mobile.
- Menu mobile: sete entradas, sem Histórico/Configurações, IA futura visível.
- NASA: uma primeira chamada sofreu timeout; a UI informou indisponibilidade e não ausência de risco. Uma tentativa posterior retornou 7.143 eventos, 7.141 representáveis e 2 sem localização representável, com qualidade parcial. Não houve geração de dados NASA para contingência.
- Corporativo: consulta real avaliou 11 ativos e 78.551 pares, retornando 9 correspondências em estado parcial e 2 omissões. O snapshot NASA foi mantido ao navegar pelo menu.
- Impacto Social: consulta individual real para mvp-petrobras-pre-sal passou pela validação compartilhada. Retornou correspondência a 371,98 km em estado parcial, com observação antiga e 2 omissões devidamente contextualizadas.
- Mapa NASA em 320: seleção de Hurricane Simon abriu popup dentro dos limites horizontais do mapa (234 px de popup em mapa de 259 px), mantendo detalhes textuais.
- Abrigos em 320: cálculo de distância em linha reta funcionou, sem significado de rota segura. Checklist foi marcado, recarregado e persistiu; a marcação de teste foi desfeita, preservando a marcação anterior do navegador. Links tel e externos foram inspecionados sem acionamento.

## Evidências de erro

O servidor QA `validation/p1-map-failure.mjs` serve o build existente em localhost e permite provocar falhas por query apenas para inspeção. Ele não pertence ao fluxo do produto, não sobrescreve dist e não simula respostas NASA. Reproduzir após build e com a API local já em execução: parar Vite na porta 5173, executar `node validation/p1-map-failure.mjs` dentro de frontend-react, abrir `/mapa?mapFailure=load` ou `/corporativo?mapFailure=load`. Alternativas: render e tiles. O servidor aplica o cenário ao chunk do mapa ou bloqueia imagens externas via CSP. Usar uma única aba por vez e navegação completa/reload; o cenário é global ao servidor QA.

- Load: HTTP 503 no chunk do mapa em NASA e Corporativo. Aviso visível, lista NASA real selecionável e cadastro de 11 ativos/detalhes utilizáveis.
- Render: módulo QA carrega e lança erro ao renderizar em ambas as telas; boundary protege o restante da página.
- Tiles: bloqueio local das imagens OSM em ambas as telas; aviso existente de base parcialmente indisponível, marcadores, listas e detalhes preservados. Leaflet e seu código não foram modificados.

Capturas principais:

- [Alertas desktop](p1-alertas-1536.jpg)
- [Menu mobile 390](p1-menu-390.jpg)
- [IA futura 320](p1-inteligencia-320.jpg)
- [Falha load Corporativo](p1-corporativo-falha-load-detalhes-1536.jpg)
- [Falha load NASA](p1-nasa-falha-load-1536.jpg)
- [Falha render Corporativo](p1-corporativo-falha-render-390.jpg)
- [Falha render NASA](p1-nasa-falha-render-390.jpg)
- [Falha OSM Corporativo](p1-corporativo-osm-320.jpg)
- [Falha OSM NASA](p1-nasa-osm-320.jpg)
- [NASA indisponível](p1-nasa-indisponivel-390.jpg)
- [Triagem corporativa real](p1-corporativo-real-1536.jpg)
- [Triagem individual real](p1-comunidade-triagem-390.jpg)
- [Popup NASA 320](p1-nasa-popup-320.jpg)
- [Distância Abrigos 320](p1-abrigos-distancia-320.jpg)
- [Medições das larguras](p1-layout-measurements.json)

## Limitações e pendências

- NASA e tiles OSM continuam dependentes de rede/serviços externos. A primeira consulta real demonstrou o risco de timeout; não há garantia de consulta ao vivo durante a apresentação.
- O boundary protege erros de importação/renderização; não cria dados substitutos nem altera Leaflet. Para tentar carregar novamente um chunk que falhou, recarregar a página; não foi criado botão de retry nesta etapa.
- Observações antigas permanecem elegíveis pela regra legada da API e aparecem contextualizadas nos resultados parciais. Não representam risco atual confirmado.
- Estados bloqueados/indisponíveis da proximidade foram cobertos por testes contratuais offline; a integração real retornou partial. Não houve alteração do backend para forçar esses estados no navegador.
- Testes visuais foram manuais em navegador desktop com viewport reduzido, sem dispositivo físico, leitor de tela ou teste completo de acessibilidade.
- Nenhuma pendência exige mudança de backend/contrato para os ajustes P1 realizados. P2 não iniciada.

## Git

9 arquivos rastreados modificados e 4 arquivos novos de código/testes/documentação QA, todos em frontend-react. Índice sem staging; HEAD e branch preservados. Capturas e medições locais ignoradas. Nenhum commit/push criado.
