export const sourceFile = 'frontend/painel_ceo.py · ABRIGOS (também presente em frontend/omni_ecoresue_mvp.py)'
export type SupportPoint = { id: string; name: string; city: string; type: string; latitude: number; longitude: number; sourceFile: string; coordinatesApproximate: true; operationallyVerified: false }
const rows = [
  ['lajeado-ginasio', 'Ginásio Municipal Lajeado', 'Lajeado / RS', 'Ginásio', -29.466, -51.961],
  ['canoas-presidente-vargas', 'EEEF Presidente Vargas', 'Canoas / RS', 'Escola', -29.918, -51.183],
  ['porto-alegre-rodoviaria', 'Rodoviária de Porto Alegre', 'Porto Alegre / RS', 'Terminal', -30.035, -51.221],
  ['porto-alegre-harmonia', 'Parque Harmonia', 'Porto Alegre / RS', 'Parque', -30.030, -51.238],
  ['sao-sebastiao-litoral-norte', 'CEMADEN Abrigo Litoral Norte', 'São Sebastião / SP', 'Centro de Apoio', -23.808, -45.408],
  ['sao-sebastiao-boicucanga', 'Ginásio Municipal Boiçucanga', 'São Sebastião / SP', 'Ginásio', -23.780, -45.542],
  ['sao-paulo-bom-prato', 'Centro de Acolhida Bom Prato', 'São Paulo / SP', 'Centro de Apoio', -23.543, -46.634],
  ['sao-paulo-ibirapuera', 'Ginásio do Ibirapuera', 'São Paulo / SP', 'Ginásio', -23.587, -46.657],
] as const
export const supportPoints: SupportPoint[] = rows.map(([id, name, city, type, latitude, longitude]) => ({ id, name, city, type, latitude, longitude, sourceFile, coordinatesApproximate: true, operationallyVerified: false }))
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim()
export function searchPoints(query: string, type = '') { return supportPoints.filter(p => (!type || p.type === type) && normalize(`${p.name} ${p.city}`).includes(normalize(query))) }
export function selectPoint(id: string) { return supportPoints.find(p => p.id === id) }
export const distanceNotice = 'Distância em linha reta entre a origem informada e o ponto de referência. Não representa percurso nem confirma condições de acesso, abertura ou disponibilidade.'
export const referenceNotice = 'Cadastro histórico de referência, sem verificação operacional. Coordenadas aproximadas. A utilização como abrigo, abertura e vagas não foram confirmadas.'
