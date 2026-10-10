# Omni-EcoRescue V3 — Frontend React

Triagem de ativos em `/mapa`: consulte NASA, ative **Visualizar ativos cadastrados no MVP**, selecione um ativo e clique **Consultar proximidade**. Cadastro de referência (◆), separado dos eventos NASA (círculos). Usa o evento mais próximo a menos de 600 km por ativo; não é avaliação de segurança. Contratos, regras, limites e validação: [documentação da triagem](../docs/geographic-analysis-implementation.md). Reinicie FastAPI para carregar os novos endpoints. Nenhuma dependência nova.

Centro de Operações baseado na referência visual oficial `../docs/design/mockup-centro-operacoes.png`. Aplicação independente, sem alterar o Streamlit em `../frontend/` ou os módulos Python em `../backend/`.

## Executar

Requer Node.js 22.18+ ou 24 LTS (validado com Node 24.14.1) e npm, incluindo os testes com TypeScript nativo do Node.

```powershell
cd frontend-react
npm ci
npm run dev
```

Acesse `http://127.0.0.1:5173`. Se a porta estiver ocupada, o Vite informa outra no terminal.

```powershell
npm run typecheck
npm run test
npm run build
npm run preview
```

O build fica em `dist/`. `preview` serve o build localmente; não publica o site. Para hospedagem futura, configurar fallback de rotas para `index.html` (BrowserRouter).

## Escopo e limites

- Centro de Operações responsivo: cabeçalho panorâmico, sidebar, indicadores, mapa, ações prioritárias, recomendações, câmeras ilustrativas, condições do cenário, gráfico do nível do rio, central de alertas, evacuação, abrigos, B2B e ESG.
- Dados demonstrativos em `src/features/operations/data/`; referência fixa em 08/10/2026, 14:30, America/Sao_Paulo. Não é horário de coleta ou atualização ao vivo. Números do mockup não equivalem ao cadastro Python.
- Mapas SVG sem escala ou coordenadas: camadas e marcadores ilustrativos. Busca local seleciona alertas do cenário; filtro mostra apenas críticos. Não há tiles, geocodificação ou cálculo de caminhos seguros.
- Câmeras: fotografias estáticas enquadradas a partir de uma cópia local do mockup, sem alterar a referência original. Não há vídeo, drone, sensor ou transmissão. O gráfico Recharts usa uma série fictícia; não é previsão.
- Central de alertas: filtros de risco e texto locais; detalhes abrem prévias. Abas Histórico/Previsões identificam conteúdo reservado. Evacuação tem abas locais, seleção de origem/destino e prévia de traçado fixo; a rota não é calculada ou validada para evacuação.
- As ações operacionais abrem diálogos locais. Não há envio, aprovação persistida, autenticação, exportação ou integração de IA. O novo painel NASA possui cliente HTTP tipado para o backend FastAPI.
- As demais rotas mostram claramente que são áreas reservadas; não implementam seus módulos.
- Logo oficial: `src/assets/omni-symbol.svg` enquadra exclusivamente o escudo e a folha do PNG fornecido, sem incluir nome e slogan visíveis. `BrandSymbol` reutiliza o símbolo; `Brand` compõe o cabeçalho com nome e slogan uma única vez. O menu lateral pode ser recolhido no desktop e conserva rótulos acessíveis.
- No modo Simulação, nenhum tile externo é carregado. No modo NASA, a base geográfica usa tiles OpenStreetMap via HTTPS, com atribuição visível. Não há geolocalização do usuário.
- Testes automatizados do cliente NASA com Node; TypeScript strict e build. Não há suíte automatizada completa da interface.

## Primeira integração funcional — NASA EONET

O painel superior **Catálogo de eventos · NASA EONET** inicia em **Simulação**, sem chamadas HTTP. **Consultar NASA** busca `GET /api/v1/events` no FastAPI; **Atualizar consulta** repete a consulta respeitando o cache do servidor. Agora o catálogo reúne mapa geográfico e lista paginada. O restante do dashboard e seu mapa ilustrativo continuam explicitamente fictícios em ambos os modos. Não há mistura de eventos observados com recomendações, alertas e indicadores locais.

O cliente `src/features/nasa/client.ts` usa fetch nativo, timeout de 15 segundos, cancelamento ao sair do modo e validação do contrato. Diferencia sucesso, vazio, cache desatualizado, integração indisponível e erro; mostra loading e falha de acesso ao backend. Exibe origem, horários de consulta/obtenção/observação e localização ausente. Nenhuma falha ou lista vazia afirma ausência de risco. Não há polling automático.

Base URL padrão: `http://127.0.0.1:8000`. Para outra URL, copie `.env.example` para `.env.local`, ajuste `VITE_API_BASE_URL` e reinicie o Vite. Não colocar credenciais em variáveis Vite.

Instalação do backend, CORS, contratos, cache e todos os comandos estão em [backend/api/README.md](../backend/api/README.md). A API não importa Streamlit nem altera regras de risco. Esta integração usa somente leitura EONET; não introduz envio WhatsApp ou decisão operacional.

## Estrutura

```text
src/
  app/                         Rotas e itens de navegação
  assets/                      Referência para fotos e símbolo oficial
  components/
    layout/                    Layout, sidebar e menu móvel
    shared/                    Marca oficial, títulos e risco
    ui/                        Componentes shadcn/ui versionados
  features/operations/
    components/                Mapas, câmeras, gráfico, central, abrigos e indicadores
    data/                      Fixtures demonstrativas tipadas
    OperationsPage.tsx         Tela inicial e prévias locais
  features/nasa/               Contratos, cliente HTTP e painel de consulta separado
  lib/                         Composição de classes
  styles/                      Tokens e estilos globais
  types/                       Tipos do cenário
```

## Design system

Tailwind v4 com plugin Vite, tokens CSS em `src/styles/globals.css` e componentes shadcn/ui (estilo New York). Button, Card, Badge, Dialog e Sheet foram obtidos pelo CLI oficial e adaptados para os aliases locais, primitivas Radix necessárias e texto de fechamento em português.

| Token | Valor | Uso |
|---|---|---|
| Fundo da aplicação | `#031b2c` | Azul-marinho com gradientes petróleo |
| `card` | `#f8fbff` | Cartões claros da referência oficial |
| `.dark-panel` | `#052b43` | Painéis de câmera, condições e gráfico |
| `secondary` | `#eaf3fa` | Superfícies claras secundárias |
| `primary` | `#087b88` | Ações em verde-petróleo |
| Detalhes de marca | `#19dfba` | Verde-turquesa no cabeçalho |
| `muted-foreground` | `#506b82` | Texto secundário em cartões claros |
| `risk-critical` | `#d51f3d` | Vermelho de risco crítico |
| `risk-high` | `#c76b05` | Laranja de risco alto |
| `risk-attention` | `#b56a00` | Âmbar de atenção |

Tipografia: Segoe UI/Inter/system-ui local, sem download. Desktop: sidebar fixa de 160 px (64 px recolhida) a partir de 1024 px, cabeçalho de 88 px e composição densa em três faixas. A partir de 1280 px, mapa/ações e monitoramento ficam lado a lado; abaixo disso, os grupos se empilham. Abaixo de 768 px, os painéis ocupam uma coluna. Risco sempre acompanhado de texto, além da cor. Diálogos/menu usam foco e teclado das primitivas Radix. Há link para pular ao conteúdo e respeito a preferência de movimento reduzido.

## Dependências

React, React DOM, React Router, Lucide, Radix Dialog/Slot, Recharts e utilitários de composição shadcn/ui. Toolchain: TypeScript, Vite, plugin React e Tailwind.

Recharts é usado no gráfico de nível do rio e carregado em chunk separado. Leaflet, React Leaflet e Supercluster implementam a visualização geográfica NASA; o componente Leaflet/CSS é carregado sob demanda ao abrir uma resposta utilizável. `@types/leaflet` atende ao TypeScript; Supercluster já fornece seus tipos.

`components.json` prepara futuras adições shadcn/ui. `package-lock.json` fixa a resolução reproduzível com `npm ci`.

## Verificações desta entrega

- `npm run build`: passou (inclui compilação TypeScript).
- `npm run typecheck`: passou.
- Revisão em navegador local com 1536, 390 e 320 px: sem rolagem horizontal.
- Seleção de marcador atualiza alerta e recomendação; filtro de críticos deixa apenas o marcador crítico.
- Menu móvel abre, navega para área reservada e fecha; a página permite voltar ao Centro de Operações.
- Prévia de aviso mostra contexto e identificação de simulação; fechar devolve foco ao botão de origem.
- Busca local por região seleciona o alerta correspondente; filtros da central distinguem resultados e estado vazio.
- Prévia de rota identifica traçado fixo, não calculado nem validado para evacuação.
- Nenhum aviso ou erro de console observado durante a revisão.

As verificações visuais originais cobrem a interface demonstrativa. Na integração NASA: 7 testes do cliente e 19 testes Python offline aprovados, além de typecheck/build. Revisão local React → API verificou indisponibilidade com consulta NASA desabilitada, sem interpretar falha como ausência de risco, e retorno à simulação. Não foi feita consulta real NASA nesta validação. Regras de risco não foram executadas.

## Marca oficial e revisão de interações

Fonte: `../docs/design/logo-omni-ecorescue.png`, 2200 × 715 px. SHA-256: `987B10CB2B6E9A69DB1A28761F38CA2AFB59C6BCDF556B87A65B514BCD8C1AFD`.

O SVG reutilizável incorpora os bytes originais do PNG e limita sua exibição ao retângulo `x=125, y=105, largura=425, altura=485`. Não altera cores, redesenha a marca ou transforma o desenho em vetores. Mantém a transparência/fundo presente no arquivo fornecido. O nome e o slogan rasterizados ficam fora do enquadramento; os textos do cabeçalho são elementos React. O original permanece intacto. Limitação: aproximadamente 2,5 MB antes de compressão HTTP; uma versão vetorial oficial é a alternativa futura para reduzir peso.

Revisão adicional: TypeScript e build passaram; símbolo carregado no desktop de 1536 px, mobile de 320/390 px e sidebar recolhida. Recolher/expandir e navegar pela sidebar recolhida funcionam. Menu móvel conserva símbolo e navegação. Não houve transbordamento horizontal da página; as camadas do mapa têm rolagem interna em telas estreitas.

| Controle/área | Comportamento atual | Limite funcional |
|---|---|---|
| Menu desktop/móvel, recolher/expandir, voltar e pular conteúdo | Navegação, estado visual e foco locais | Preferência de recolhimento não persistida |
| Rota `/` | Dashboard React implementado | Dados demonstrativos |
| `/mapa`, `/alertas`, `/corporativo`, `/comunidade`, `/abrigos`, `/inteligencia`, `/historico`, `/configuracoes` | Rotas e navegação funcionam | Conteúdo reservado, sem módulos funcionais; rota desconhecida mostra aviso e retorno |
| Mapa: camadas, marcadores, Buscar e Filtrar críticos | Altera SVG, seleciona alerta e filtra cenário local | Sem geografia real, zoom, GPS ou busca territorial |
| Ações prioritárias: Ver todas, Ver detalhes, Ver alerta selecionado | Abre resumo/detalhes e seleciona alertas conhecidos | Nenhuma execução ou confirmação persistida |
| Recomendações: Revisar; Prévia de aviso; Revisar protocolo; Ver resumo | Diálogos locais; recomendação acompanha seleção | Sem inferência IA, aprovação ou envio |
| Câmera principal e miniaturas | Abrem explicação/prévia ilustrativa | Fotografias estáticas; sem transmissão ou sensor |
| Gráfico do nível do rio | Série fictícia e tooltip | Sem medição ou previsão real |
| Central: risco, busca, Ver | Filtra seis exemplos e abre detalhe | Sem leitura API ou histórico persistido |
| Central: Alertas ativos e Simulações | Exibe os mesmos exemplos locais | Abas ilustrativas; não executam simulação Python |
| Central: Histórico e Previsões | Alterna para mensagem de área reservada | Conteúdo ainda não implementado |
| Evacuação: Visão Geral/Rotas Seguras/Abrigos/Orientação | Alterna desenho, lista fictícia e instruções | Sem roteamento ou disponibilidade real |
| Origem/destino e Simular rota | Seleções e mensagem com origem/destino escolhidos | Traçado fixo; não calculado nem validado para evacuação |
| Abrigos e Ver análise B2B | Prévia local de abrigo ou resumo corporativo | Sem cadastro, ocupação, perdas ou exposição calculados |
| Indicadores ESG/B2B e regiões ilustrativas | Exibição estática | Não são filtros nem dados operacionais |
| Consultar NASA / Atualizar consulta / Simulação | Cliente HTTP tipado, estados da API e cancelamento | Catálogo separado; sem risco calculado ou mapa real |

## Plano original e continuidade

A primeira integração de leitura FastAPI/NASA foi autorizada e implementada nesta etapa. Os passos abaixo registram a direção de continuidade; mapas reais, alertas e novas integrações ainda dependem de revisão. Os endpoints existentes agora são somente `/api/v1/status` e `/api/v1/events`.

Atualização da etapa de mapa: a visualização geográfica de leitura foi autorizada e implementada. Cálculo de risco, recomendações derivadas da NASA, alertas operacionais e demais integrações continuam pendentes de revisão.

1. Definir contratos FastAPI e adaptar serviços Python existentes, mantendo o Streamlit como referência. Propor metadados `source`, `observedAt`, `isSimulation`, qualidade e `requiresHumanConfirmation`; separar fixture de dado observado. Validar paridade dos cálculos com entradas fixas antes de substituir qualquer painel.
2. Conectar NASA pelo backend com credenciais somente no servidor, limites de consulta, cache e tratamento de indisponibilidade. Exibir origem, resolução e horário do produto; ausência de dado não deve virar cenário real nem produzir alerta automaticamente. Validar parsing com respostas gravadas antes de liberar consultas externas.
3. Implementar leitura de alertas e estados de revisão humana. Reutilizar critérios existentes e separar recomendação de decisão. Validar filtros, deduplicação e transições; só incluir aprovação persistida após contrato e autorização definidos. Nenhum envio WhatsApp faz parte desta fase visual.
4. Introduzir Leaflet/React Leaflet e coordenadas/camadas geográficas válidas, com atribuição e fonte aprovadas. Separar risco, ativos e abrigos confirmados; não classificar um traçado como seguro sem validação própria. Testar coordenadas, carregamento, seleção e falhas de camada.
5. Liberar um painel por vez, com alternância explícita de modo e rollback para fixtures ou MVP Streamlit. Critérios: paridade Python, dados identificados, estados de carregamento/erro, acessibilidade e build aprovado. Contratos operacionais, mapa real e aprovação de alertas continuam propostos; não existem nesta entrega.

## Preservação do MVP

Os arquivos existentes em `../frontend/`, `../backend/` e `../dados_satelite/` permanecem intactos; foi adicionada apenas a nova pasta `../backend/api/`. NASA, Yahoo Finance, Open-Meteo, RAG/OCI/Cohere, WhatsApp/n8n, abrigos e checklist continuam no MVP original. A primeira integração React/API de leitura NASA não substitui nem remove essas funcionalidades e ainda não estabelece paridade funcional completa.

Fotos de câmeras, ocupação de abrigos, rotas seguras, nível de água e indicadores adicionais do mockup não comprovam funcionalidades existentes no MVP: são apresentados apenas como simulação. Não existe nova execução de bloqueio, envio, resgate ou decisão automática.

A referência original não foi alterada. `src/assets/design-reference.png` é uma cópia idêntica usada apenas para enquadrar fotografias em componentes SVG. Os rótulos LIVE/tempo real do mockup foram substituídos por imagem estática/simulação na interface. Controles, textos, métricas, tabelas, gráfico e mapas são componentes React/SVG, não uma captura de tela usada como página.

## Mapa geográfico NASA — etapa atual

Atualização de navegação: o explorador completo agora fica em `/mapa` (**Mapa de Riscos**). O Centro de Operações `/` mantém sua composição executiva e mostra apenas um resumo NASA independente após os painéis, sem deslocar indicadores ou mapa ilustrativo. Esta atualização substitui a localização anterior do explorador no dashboard.

Arquivos novos: `src/features/nasa/NasaGeographicMap.tsx`, `NasaMapExplorer.tsx`, `geography.ts` e `tests/nasa-geography.test.mjs`. Ajustados `NasaEventsPanel.tsx`, `client.ts`, `tests/nasa-client.test.mjs`, `src/styles/globals.css`, `package.json`, `package-lock.json` e este README. Nenhuma alteração na API, nos arquivos Python ou em `frontend/` Streamlit nesta etapa.

- Fonte exclusiva de eventos: endpoint FastAPI existente `/api/v1/events`. O browser não acessa EONET diretamente. Tiles OSM são somente a base cartográfica, sem eventos adicionados de outra fonte.
- Cores e símbolos distintos para incêndios, tempestades severas, terremotos e inundações. Eventos com várias categorias aparecem em todos os filtros correspondentes; o marcador usa a primeira categoria conhecida na ordem da legenda. Categoria desconhecida usa símbolo neutro.
- Busca por nome ignora maiúsculas, espaços nas extremidades e acentos; filtro de categoria é combinado com a busca. Lista e mapa usam o mesmo conjunto filtrado. Nenhum resultado não significa ausência de risco.
- Seleção na lista centraliza no ponto e abre popup; clicar no marcador seleciona a lista e sua página. Popup mostra título, categorias, origem, observação e coordenadas. Identificação do evento e coordenadas também estão disponíveis no painel da lista.
- Contorno sólido = observação recente, tracejado = antiga, pontilhado = horário desconhecido. Esses estados vêm da API, sem inventar critérios de risco. Estado do cache e horário de obtenção permanecem separados do horário do evento. Não há atualização automática.
- Localizações inválidas são retiradas apenas do mapa; evento continua na lista. O cliente transforma pares de coordenadas inválidos em `coordinates=null`, `coordinateState=invalid`, `dataQuality=partial`, preservando os demais eventos. Falhas de envelope/contrato continuam sendo erro, sem fabricar lista vazia.
- Pontos fora do limite Web Mercator (latitude ±85,0511287798°) continuam na lista, sem serem deslocados para uma localização inventada. Polígonos usam o primeiro vértice informado pela API e são identificados como tal; não há desenho da extensão, centroide ou área de impacto.
- Supercluster agrupa pontos próximos na tela conforme zoom (raio 50 px, até zoom 16). Clique no grupo amplia. Números são quantidades, não intensidade de risco. Apenas grupos/pontos da área visível são renderizados. O evento selecionado é destacado fora do agrupamento.
- Lista limitada a 25 itens por página para manter navegação com milhares de eventos. Busca/filtros pesquisam todos os eventos, não só a página. Desktop: lista de 340 px ao lado do mapa de 340 px; mobile: mapa de 300 px e lista rolável de até 250 px. Metadados adicionais ficam em uma expansão de detalhes.
- Base `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, com atribuição visível e cache HTTP padrão do navegador. Não há download em lote, prefetch ou mapa offline. Falha de tiles mostra aviso sem remover lista ou marcadores. Disponibilidade OSM não é garantida; para uso intensivo/produção, avaliar provedor compatível e sua política.
- Modo Simulação mantém o mapa ilustrativo original e não monta o mapa geográfico nem consulta NASA/OSM. Os abrigos fictícios continuam identificados como simulação, sem marcadores de abrigo no mapa NASA. Nenhuma rota segura ou acionamento real é gerado. Decisões futuras exigem confirmação humana.

### Validar localmente

Inicie backend/frontend pelos comandos anteriores ou por `backend/api/README.md`. Backend em `http://127.0.0.1:8000`, React em `http://127.0.0.1:5173`; não mude a API. Se já houver um backend nessa porta, reutilize-o. Verifique que `NASA_EONET_ENABLED=true` e CORS autoriza a origem React.

1. Selecione **Consultar NASA** e aguarde resposta: status, fonte e obtenção aparecem acima do mapa.
2. Filtre categoria e busque um título retornado pela API. Selecione na lista e confira centralização, popup e dados.
3. Clique em um marcador e em um grupo; confira seleção na lista e ampliação. Troque de página e teste busca sem resultados.
4. Confira observações antigas e eventos sem localização na lista, quando presentes. Retorne a **Simulação** e confirme o desenho original.
5. Para verificar erro HTTP/rede sem dados externos, use os testes offline. Para erro visual de conexão, encerre somente o backend que você iniciou e clique em **Atualizar consulta**; a simulação deve continuar utilizável.

```powershell
npm run test
npm run typecheck
npm run build
```

Validação desta etapa: 17 testes Node (cliente + geografia) e 19 testes Python existentes aprovados, typecheck e build aprovados. Testes offline cobrem coordenadas válidas, ausentes e inválidas, geometrias, categorias, busca combinada, posição de seleção, agrupamento/expansão, paginação, datas e falhas da API. Revisão no navegador usa eventos retornados pelo backend local, sem inserir fixtures no mapa do produto: seleção, popup, filtros, vazio e responsividade. Nenhum fixture de teste é importado pelos componentes de produção.

Referências: [React Leaflet](https://react-leaflet.js.org/docs/start-installation/), [Leaflet](https://leafletjs.com/reference.html), [Supercluster](https://github.com/mapbox/supercluster) e [política de tiles OSM](https://operations.osmfoundation.org/policies/tiles/).

## Centro executivo e explorador dedicado

- `/`: indicadores, mapa ilustrativo, alertas, recomendações locais e demais cartões permanecem como simulação. Resumo NASA abaixo desses painéis mostra apenas estado, quantidade global do catálogo, origem e obtenção. Não altera métricas, alertas, abrigos ou recomendações fictícias.
- `/mapa`: página principal do explorador NASA com busca, filtros, seleção, agrupamento, popup e paginação. O modo Simulação mostra uma prévia do mesmo desenho ilustrativo, explicitamente sem escala e com localizações fictícias.
- **Abrir Mapa de Riscos** navega do resumo para o explorador; menu lateral e **Voltar ao Centro de Operações** também funcionam. **Consultar resumo NASA** é uma leitura explícita da API, sem montar Leaflet no dashboard.
- Sessão React em memória compartilha consulta, modo, filtros, busca, seleção e página entre rotas. Navegação não dispara consulta duplicada. Recarregar o browser reinicia em Simulação; não há armazenamento persistente. A posição/zoom livres do mapa são remontados, mas evento selecionado é novamente centralizado.
- Início em Simulação não consulta NASA automaticamente. API indisponível ou falha de integração não são convertidas em zero eventos. Resumo diferencia vazio válido e cache desatualizado; não aplica filtros do explorador à contagem global. Uma análise de proximidade ainda não existe.

Arquivos desta reorganização: `src/app/App.tsx`, `src/features/operations/OperationsPage.tsx`, `src/features/nasa/NasaEventsPanel.tsx`, `NasaMapExplorer.tsx`, `RiskMapPage.tsx`, `NasaSession.tsx`, `NasaSummary.tsx`, `summary.ts`, `tests/nasa-summary.test.mjs`, este README e `../docs/geographic-analysis-proposal.md`.

Validação automatizada: 21 testes frontend (incluindo quatro testes de estados/contagem do resumo), 19 testes Python existentes, typecheck e build aprovados. Validar manualmente: navegar pelo resumo/menu, consultar NASA, filtrar e selecionar; voltar ao dashboard e reabrir `/mapa` para conferir a sessão. Testar 320 px e indisponibilidade sem interpretar falha como ausência de risco. As demais rotas continuam reservadas.

As funções Python, regras de distância, diferenças entre versões, lacunas do cadastro de comunidades e contratos **somente propostos** estão em [proposta de análise geográfica](../docs/geographic-analysis-proposal.md). Não foram criados novos endpoints, cálculos de proximidade ou recomendações IA. API, Streamlit e regras Python permanecem intactos nesta etapa. Implementação da análise depende de aprovação.
