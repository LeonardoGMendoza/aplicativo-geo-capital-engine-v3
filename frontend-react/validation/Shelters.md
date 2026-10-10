# Prompt 16 — Evacuação e Abrigos

Implementação restrita a frontend-react, branch feature/react-migration. Nenhuma alteração em Python, contratos, regras NASA ou Streamlit; nenhuma instalação, commit ou push.

## Entrega funcional

- Rota /abrigos: oito pontos históricos do ABRIGOS original, IDs estáveis, procedência explícita e coordenadas aproximadas. Sem ocupação, vagas ou capacidades operacionais.
- Busca por nome/cidade sem diferenciação de acentos/caixa, filtro por tipo e ordenação alfabética ou por distância.
- Lista, marcadores e detalhes selecionados por ID. O mapa mostra os oito pontos independentemente do filtro da lista. Popup antigo é fechado quando a seleção muda.
- Origem opcional, validação de limites e coordenadas zero, cálculo Haversine (R = 6371 km). Editar ou limpar os campos invalida a origem calculada. Coordenadas não persistem.
- Checklist de 14 itens do MVP, com linguagem editorial revisada. Somente IDs de marcações persistem em omni-ecorescue-family-checklist-v1. Armazenamento inválido/bloqueado tem fallback em memória.
- Contatos nacionais confirmados na Anatel: 199, 193, 192 e 190. Nenhuma chamada foi realizada durante a validação.
- Google Maps e Waze recebem somente as coordenadas públicas do destino, sem origem pessoal e sem cálculo próprio de percurso.
- Lazy loading e limite de erro no mapa. Lista e detalhes funcionam mesmo com falha de tiles. Independente de NASA e backend.

## Arquivos

Criados:
- src/features/shelters/reference.ts
- src/features/shelters/location.ts
- src/features/shelters/checklist.ts
- src/features/shelters/SupportPointMap.tsx
- src/features/shelters/SheltersPage.tsx
- src/features/shelters/shelters.css
- tests/shelters.test.mjs
- validation/Shelters.md, capturas e evidências textuais de regressão
- validation/shelters-map-failure.mjs (servidor local de validação, sem integração no produto)

Alterado: src/app/App.tsx, para registrar a rota e remover sua reserva. Componentes e clientes NASA/corporativo/comunidade preservados.

## Testes

npm test: 65 aprovados, 0 falhas (52 anteriores + 13 novos).
npm run typecheck: aprovado.
npm run build: aprovado.

Novos testes: transcrição comparada diretamente ao ABRIGOS original; IDs/procedência; busca; filtro e seleção; coordenadas e zero; entradas inválidas; Haversine com pontos iguais, equador e antípodas; ordenação; estado sem origem; URLs externas; persistência; armazenamento bloqueado/corrompido; linguagem sem falsas promessas.

## Evidências de interface

- Origem (-30.035, -51.221) → EEEF Presidente Vargas (-29.918, -51.183): 13,51 km em linha reta.
- Origem igual às coordenadas de Canoas: 0 km. Antes de origem: Distância não calculada.
- Busca BOICUCANGA encontrou Ginásio Municipal Boiçucanga; filtro Escola junto a essa busca retornou zero e aviso sobre cobertura do cadastro.
- Latitude 91 impediu cálculo e exibiu mensagem acessível.
- Seleção do marcador CEMADEN atualizou o painel correspondente no build de produção; seleção textual de Canoas atualizou destaque/enquadramento.
- Uma marcação sobreviveu à recarga; coordenadas foram apagadas. Limpar marcações e recarregar retornou 0 de 14 itens revisados.
- Tab do campo de busca para o seletor: focus-visible verdadeiro e outline solid.
- Larguras solicitadas 1536/390/320: largura útil 1521/375/305 (barra de rolagem); scrollWidth igual a clientWidth em todas. Capturas completas em shelters-1536.jpg, shelters-390.jpg e shelters-320.jpg.
- Falha de OSM reproduzida em servidor local com CSP img-src self data: blob:, que bloqueia tiles externos. Aviso de indisponibilidade apresentado e seleção textual/coordendas continuaram funcionais. Captura shelters-map-unavailable.jpg. Servidor de teste encerrado após validação.

## Regressão manual

- Dashboard: indicadores e mapa demonstrativos, avisos de simulação e acesso NASA presentes.
- Explorador: consulta real retornou 7143 eventos, 7141 localizações e 2 eventos sem localização; qualidade parcial.
- Corporativo: 11 ativos avaliados, 9 correspondências, 78551 pares avaliados, resultado parcial com avisos preservados.
- Impacto Social: referência comunitária associada à Vale consultada; resultado parcial e limites comunitários preservados. Evidência em shelters-regression-community.txt.
- Triagem individual: Petrobras → EONET_11087, 371.98 km, 7141 pares, resultado parcial, observação antiga de 12/09/2024. Evidência em shelters-regression-individual.txt.
- Consultas reais realizadas na origem de desenvolvimento 127.0.0.1:5173. O preview auxiliar 5175 foi utilizado para capturas de Abrigos; NASA nessa origem apresentou erro de API. Não foi alterada a configuração do backend para autorizar a origem auxiliar.

## Links e fontes

Anatel: https://www.gov.br/anatel/pt-br/regulado/numeracao/codigos-nacionais/servicos-de-utilidade-publica-e-de-emergencia
Google Maps: https://developers.google.com/maps/documentation/urls/get-started
Waze: https://developers.google.com/waze/deeplinks

Google Maps aberto com (-29.466, -51.961): página confirmou 29°27'57.6 S, 51°57'39.6 W.
Waze: corrigido parâmetro de visualização para z=17 conforme documentação. Abertura com (-29.918, -51.183) confirmou pino em Canoas; URL final continha to=ll.-29.918%2C-51.183. Não foi iniciado trajeto ou envio ao telefone.

## Limitações

Não há confirmação operacional dos oito pontos, validação atual de nomes/endereço ou verificação de vagas/abertura. Distâncias não são percursos. Mapa e serviços externos precisam de internet; recarga offline não é garantida. Validação mobile foi feita por viewport, sem aparelho físico, discador real ou auditoria completa com leitor de tela. Bloqueio/corrupção do armazenamento foram exercitados em testes unitários; não foi alterada a preferência de armazenamento do navegador do usuário.

Novas integrações e alterações backend permanecem fora do escopo. Servidores auxiliares de teste foram encerrados; processos existentes de desenvolvimento e FastAPI preservados.
