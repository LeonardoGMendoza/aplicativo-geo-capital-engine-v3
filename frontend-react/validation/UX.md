# Prompt 10 — refinamento UX/UI

Entrega em 09/10/2026 na branch `feature/react-migration`. Escopo exclusivo frontend; sem mudanças de backend, contratos, regras de risco, dados demonstrativos P0, RAG, dependências ou integrações. Sem commit ou push.

## Melhorias

- Título visível Situação atual; acesso NASA no início da página, antes do bloco de simulação.
- Catálogo NASA com origem, horário, estado e contagem próprios. Os indicadores locais seguem exclusivamente demonstrativos.
- Mapa e alertas prioritários ocupam a faixa principal. Fotos, condições ilustrativas e gráfico ficam na seção complementar, depois dos painéis de revisão.
- Identidade preservada: escudo oficial, azul-marinho, turquesa e cartões claros. Fotografia do cabeçalho tem menor contraste e a foto principal deixa de apresentar um slogan como informação operacional.
- Textos do dashboard com pelo menos 12 px; títulos de painel de 16 px; mais espaçamento. Botões com alvo mínimo de 44 × 44 px; controles de zoom e marcadores Leaflet ampliados com âncoras correspondentes, mantendo seleção e posicionamento.
- Indicadores B2B/ESG com duas colunas no celular; cartões superiores empilhando ícone/texto em telas pequenas. Conteúdo complementar em uma coluna mobile.
- Rótulos: Traçado ilustrativo, Pontos de apoio ilustrativos, Orientações do cenário e Orientação e revisão humana. Os mesmos controles continuam abrindo prévias, sem envio, inferência ou acionamento.
- Aviso geral de simulação separado do cartão NASA; texto do cabeçalho identifica a referência demonstrativa, sem rotular a consulta NASA como simulação.

## Arquivos de apresentação modificados

- `src/styles/globals.css`
- `src/components/layout/AppLayout.tsx`
- `src/components/shared/Brand.tsx`
- `src/components/shared/RiskBadge.tsx`
- `src/features/operations/OperationsPage.tsx`
- `src/features/operations/components/MetricCard.tsx`
- `src/features/operations/components/MapPlaceholder.tsx`
- `src/features/operations/components/AlertCenter.tsx`
- `src/features/operations/components/EvacuationPanel.tsx`
- `src/features/operations/components/ShelterList.tsx`
- `src/features/operations/components/MonitoringPanel.tsx`
- `src/features/operations/components/WaterTimeline.tsx`
- `src/features/nasa/NasaSummary.tsx`
- `src/features/nasa/NasaMapExplorer.tsx`
- `src/features/nasa/NasaGeographicMap.tsx`

Os arquivos em `validation/` registram a entrega; capturas e JSON do P0 foram preservados. O build gerou novamente `dist/`.

## Validação

- `npm test`: 30/30 aprovados; os cinco testes de consistência P0 e os testes NASA/proximidade permanecem intactos.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- Larguras 1536, 390 e 320 px: sem transbordamento horizontal da página; nenhum texto de conteúdo medido abaixo de 12 px e nenhum botão do dashboard abaixo de 44 × 44 px. Rolagem interna das abas/camadas é intencional.
- Alertas Deslizamento de terra e Alagamento: detalhes/localidade corretos, inclusive contexto global do alerta adicional. Orientação do Rio Verde abre com evento, localidade e texto correspondentes.
- Acesso pelo novo link Explorar eventos NASA: consulta real bem-sucedida, 7.143 eventos, qualidade parcial. Filtro de tempestades, busca Hurricane Simon e seleção do evento validados.
- Ativos: cadastro de 11 itens carregado. Triagem Petrobras em mobile retornou correspondência a 371,98 km com estado parcial e avisos de observação antiga. Filtro visual de tempestades não restringiu a triagem, preservando o contrato.
- Retorno ao dashboard mantém o resumo NASA independente e os indicadores demonstrativos P0. Console sem erros ou avisos na sessão verificada.

Evidências: `ux-1536.jpg`, `ux-390.jpg`, `ux-320.jpg`, `ux-browser.json`.

## Limitações

As tabelas, abas e camadas podem exigir rolagem interna em telas estreitas. NASA/OSM continuam dependentes de serviços externos; dados e contagens podem mudar. Fotografias, nível do rio, abrigos, orientações locais e demais indicadores permanecem demonstrativos. As sete áreas reservadas não receberam funcionalidades novas.
