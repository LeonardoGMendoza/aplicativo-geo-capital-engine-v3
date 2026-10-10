# Omni-EcoRescue V3 — Frontend React

Estado do MVP em 10/10/2026. Aplicação React/TypeScript independente do painel legado Streamlit: transforma dados e alertas em contexto para apoiar decisões humanas. Não há paridade funcional completa com o legado, previsão própria ou acionamento operacional de emergência.

## Módulos e navegação

| Rota | Estado atual | Limites |
|---|---|---|
| `/` | Centro de Operações com indicadores, alertas, prévias locais e resumo NASA separado | Alertas, fotografias, gráfico, população, ocupação e traçados do dashboard são demonstrativos; referência fixa em 08/10/2026, 14:30, Brasília |
| `/alertas` | Redireciona para `/#central-alertas`, com rolagem/foco e fechamento do menu mobile | Uma única central demonstrativa; não cria alertas NASA |
| `/mapa` | Explorador NASA EONET com busca, categorias, lista paginada, mapa, agrupamentos e consulta individual de ativo | Consulta real via API; não confirma risco ou segurança |
| `/corporativo` | Catálogo de 11 ativos, busca, ordenação, detalhes e triagem em lote | Ativos de referência; evento mais próximo por ativo, estritamente abaixo de 600 km; sem finanças ou ação operacional |
| `/comunidade` | Descrições comunitárias associadas aos ativos, triagem individual e preparação editorial | Distância evento–ativo, não localização ou população comunitária verificada |
| `/abrigos` | Oito pontos de referência, busca/filtros, distância em linha reta, detalhes e checklist de 14 itens | Sem confirmação de abertura, vagas, acesso ou rota segura |
| `/inteligencia` | Área reservada, identificada no menu como evolução futura | IA e Oracle RAG não integrados ao React |
| `/historico`, `/configuracoes` | Rotas reservadas preservadas, temporariamente ocultas no menu | Sem histórico persistido ou configuração funcional de integrações |

Menu desktop recolhível e menu mobile disponíveis. Uma rota desconhecida apresenta aviso e retorno. Abas históricas ou de previsão do dashboard permanecem reservadas; não representam serviços implementados.

## Executar localmente

Requer Node.js 22.18+ e npm; validado com Node 24.14.1. Na raiz do repositório:

```powershell
npm --prefix frontend-react ci
npm --prefix frontend-react run dev -- --port 5173 --strictPort
```

Abra `http://127.0.0.1:5173`. Para consultas reais, inicie também o FastAPI conforme [backend/api/README.md](../backend/api/README.md), usando Python 3.14.3 e o lockfile da API. O frontend usa `http://127.0.0.1:8000` por padrão.

Para outra API, copie `.env.example` para `.env.local`, ajuste somente `VITE_API_BASE_URL` e reinicie Vite/build. Variáveis `VITE_*` são públicas no bundle: nunca incluir credenciais. O backend não carrega arquivos `.env` automaticamente. Se mudar a origem do frontend, inclua a origem exata em `REACT_CORS_ORIGINS` e reinicie a API; CORS padrão permite as origens locais da porta 5173.

```powershell
npm --prefix frontend-react test
npm --prefix frontend-react run typecheck
npm --prefix frontend-react run build
```

O build fica em `frontend-react/dist/`. Para revisar o build com o CORS padrão, encerre o Vite e use:

```powershell
npm --prefix frontend-react run preview -- --port 5173 --strictPort
```

Preview é um servidor local, sem publicação. Em hospedagem futura, configurar fallback de rotas para `index.html` (BrowserRouter). Não há autenticação nem preparação para operação pública em produção.

## Dados, sessão e proximidade

- O dashboard inicia em Simulação; NASA exige consulta explícita. O resumo NASA fica separado dos indicadores e alertas demonstrativos. Não há polling automático ou mistura com dados fictícios.
- O browser consulta o FastAPI, que acessa NASA EONET. Contratos efetivos: `GET /api/v1/status`, `GET /api/v1/events`, `GET /api/v1/assets` e `POST /api/v1/geography/proximity`. `/api/v1/communities` não está implementado.
- Sessão NASA em memória compartilha consulta, modo, filtros, busca, seleção e página entre rotas. Recarregar reinicia a sessão. Resultados de triagem são locais à página; sair e voltar exige nova triagem. Filtros do explorador não restringem o catálogo utilizado pela análise.
- Individual e lote usam validação comum de snapshot, procedência, política, versão, coordenadas e distância. A API recebe IDs cadastrados, `expectedFetchedAt` e `policyId`, sem coordenadas arbitrárias do browser.
- Regra `legacy-panel-assets-600-nearest`: Haversine com raio terrestre de 6371 km, evento mais próximo por ativo e distância estritamente inferior a 600 km. Não mede extensão do fenômeno, exposição, impacto, trajeto ou segurança.
- Estados completo, vazio, parcial, bloqueado e indisponível são distintos. O contrato preserva `riskConfirmed=false` e `requiresHumanConfirmation=true`. Observações antigas continuam elegíveis pela regra legada, com ressalvas e resultado parcial.
- Cache NASA desatualizado ou timestamp incompatível bloqueia a triagem. O cabeçalho corporativo identifica o **Estado registrado na consulta**: não garante disponibilidade atual. A triagem revalida o snapshot; se bloqueada, atualizar os eventos NASA e executar uma nova consulta válida. Não há monitoramento automático de validade na interface.
- Horário de obtenção da fonte, horário de análise e observação do evento são distintos. Falha ou lista vazia não significa ausência de risco. Detalhes dos contratos e da geometria estão em [geographic-analysis-implementation.md](../docs/geographic-analysis-implementation.md); a [proposta original](../docs/geographic-analysis-proposal.md) é histórica e contém itens ainda não implementados.

## Mapas, conectividade e persistência

Leaflet/React Leaflet e Supercluster exibem coordenadas reais NASA; grupos representam contagens, não intensidade de risco. Eventos sem localização adequada continuam na lista, sem pontos inventados. Polígonos usam o primeiro vértice da última geometria fornecida, identificado como aproximação; não são áreas de impacto. Pontos fora dos limites Web Mercator não são deslocados para posições fictícias.

Tiles OpenStreetMap são a base cartográfica, com atribuição; não acrescentam eventos. Falhas de carregamento/renderização têm boundary restrito ao mapa. Falhas de tiles exibem aviso; listas, contexto, coordenadas e detalhes permanecem acessíveis. Não há download de tiles em lote nem modo offline.

Centro de Operações demonstrativo e Abrigos/checklist não dependem da NASA. Corporativo e Impacto Social precisam do backend para cadastros e da NASA utilizável para triagem. Os oito pontos de Abrigos, cálculos e checklist são locais; mapa e links externos exigem conexão. Abertura/recarga offline não é garantida.

Somente IDs conhecidos das marcações do checklist persistem no navegador (`omni-ecorescue-family-checklist-v1`); falha de armazenamento usa estado em memória. Coordenadas de origem não persistem. Contatos `tel:` apenas abrem a opção de chamada; não confirmam atendimento. Links Google Maps/Waze usam coordenadas públicas do destino, sem confirmar percurso seguro.

## Estrutura, dependências e marca

- `src/app/`: rotas e navegação; `components/layout/`, `shared/` e `ui/`: layout, avisos e primitivas Radix/shadcn.
- `src/features/operations/`: cenário demonstrativo; `nasa/`: sessão, contratos, cliente e mapa; `corporate/`: lote; `community/`: contexto individual; `shelters/`: referências, distâncias e checklist.
- `tests/`: testes Node, com remoção nativa de tipos TypeScript; `validation/`: documentação histórica e scripts locais de QA.
- React, React Router, Leaflet, Supercluster, Recharts, Radix, TypeScript, Vite e Tailwind estão declarados em `package.json`; `package-lock.json` fixa a resolução para `npm ci`. Não versionar `node_modules`, `dist` ou ambientes locais.
- Tokens em `src/styles/globals.css`, foco visível, link para pular conteúdo, texto além da cor e respeito a movimento reduzido. Verificações por viewport não substituem auditoria completa com leitor de tela ou dispositivo físico.
- Referências oficiais em `docs/design/`. `src/assets/design-reference.png` enquadra fotografias estáticas; não é uma página inteira usada como imagem. `omni-symbol.svg` incorpora o PNG original, enquadrando escudo/folha sem redesenhar a marca; aproximadamente 2,5 MB antes da compressão HTTP. Uma versão vetorial oficial permanece melhoria futura.

## Validação e documentos históricos de QA

Estado validado: **75 testes frontend e 26 testes backend aprovados**, TypeScript e build aprovados. Testes cobrem consistência demonstrativa, contratos, snapshots incompatíveis/expirados, procedência, limites de distância, parcial/bloqueado/indisponível, invalidação assíncrona, busca/seleção, checklist e linguagem. Não há suíte automatizada completa E2E; a regressão do cabeçalho corporativo inclui renderização SSR com hooks isolados e envelope HTTP 409.

Validações manuais anteriores cobriram 1536, 390 e 320 px, consulta NASA real, indisponibilidade controlada e falhas do mapa/tiles. Quantidades e distâncias dessas execuções não são constantes nem alertas atuais. Sucesso externo numa execução não garante disponibilidade durante a demonstração. O ensaio técnico anterior levou 5min05,317s, sem narração humana; o ensaio do apresentador dentro de cinco minutos continua pendente.

Os seis relatórios Markdown em `validation/` registram etapas anteriores (P0, UX, Corporativo, Comunidade, Abrigos e P1). Suas contagens de testes, pendências, estados Git e expressões como "atuais" valem para a execução datada de cada documento, não para o estado atual do MVP. Permanecem no histórico sem edição retroativa. Referências a JPGs, JSONs e textos de evidência apontam para arquivos locais deliberadamente não versionados; esses links não ficam disponíveis num clone ou na página pública do GitHub. Não anexar evidências privadas ao PR para resolver esses links.

`validation/p1-map-failure.mjs` e `validation/shelters-map-failure.mjs` são servidores exclusivamente locais de QA, fora do fluxo do produto. Após build, parar o Vite caso ocupe 5173 e executar, na raiz, `node frontend-react/validation/p1-map-failure.mjs`; abrir `/mapa?mapFailure=load` ou `/corporativo?mapFailure=load`. Alternativas `render` e `tiles`. O cenário é global ao servidor: usar uma aba e reload/navegação completa. O segundo script usa porta 5174 para bloquear tiles de Abrigos via CSP. Encerrar os servidores QA após testar; não implantá-los como servidores de produção.

ZIP, pasta temporária de extração, capturas e JSONs locais não fazem parte do código do PR. Um arquivo não rastreado não é enviado por push, mas pode ser incluído indevidamente por staging indiscriminado: usar somente caminhos explícitos. Backup independente verificado, revisão da equipe e aprovação do congelamento continuam necessários. Não há RAG, WhatsApp, histórico persistido, acionamento de resgate ou evacuação integrada ao React.
