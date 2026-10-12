// Leitura simples dos eventos NASA para o Mapa de Riscos real (mesmo jeito da simulação do Felipe):
// nomes em português, cor por "quando foi visto" e a capital brasileira mais perto.
import type { NasaEvent } from './contracts'

/** Vermelho = visto pelo satélite nos últimos dias · laranja = visto há mais tempo · cinza = sem data. */
export const COR_EVENTO = { recente: '#fa284c', antigo: '#f4a024', semData: '#7b8794' } as const
export function corDoEvento(e: NasaEvent) {
  return e.observationState === 'recent' ? COR_EVENTO.recente : e.observationState === 'outdated' ? COR_EVENTO.antigo : COR_EVENTO.semData
}

const CATEGORIAS: Record<string, string> = {
  wildfires: 'Incêndio', severeStorms: 'Tempestade', earthquakes: 'Terremoto', floods: 'Inundação', volcanoes: 'Vulcão',
  seaLakeIce: 'Gelo no mar', snow: 'Neve', drought: 'Seca', dustHaze: 'Poeira e fumaça', landslides: 'Deslizamento',
  manmade: 'Causado pelo homem', tempExtremes: 'Temperatura extrema', waterColor: 'Cor da água',
}
export function categoriaPt(e: NasaEvent) {
  const nomes = e.categories.map(c => CATEGORIAS[c.id] ?? c.title).filter(Boolean)
  return nomes.length ? [...new Set(nomes)].join(', ') : 'Evento'
}

// Ordem importa: o mais específico primeiro.
const TROCAS: [RegExp, string][] = [
  [/^Post-Tropical Cyclone\s+/i, 'Ciclone pós-tropical '],
  [/^Extratropical Cyclone\s+/i, 'Ciclone extratropical '],
  [/^Subtropical Storm\s+/i, 'Tempestade subtropical '],
  [/^Tropical Depression\s+/i, 'Depressão tropical '],
  [/^Tropical Storm\s+/i, 'Tempestade tropical '],
  [/^Tropical Cyclone\s+/i, 'Ciclone tropical '],
  [/^Super Typhoon\s+/i, 'Supertufão '],
  [/^Typhoon\s+/i, 'Tufão '],
  [/^Hurricane\s+/i, 'Furacão '],
  [/^Cyclone\s+/i, 'Ciclone '],
  [/^Prescribed Fire\s*/i, 'Queima controlada '],
  [/^Wildfires?\s+in\s+/i, 'Incêndio florestal em '],
  [/^Wildfire\s*/i, 'Incêndio florestal '],
  [/^(.+?)\s+Wildfire$/i, 'Incêndio florestal $1'],
  [/^(.+?)\s+Fire$/i, 'Incêndio $1'],
  [/^Flooding?\s+(in\s+)?/i, 'Inundação em '],
  [/^(.+?)\s+Volcano/i, 'Vulcão $1'],
  [/^Iceberg\s+/i, 'Iceberg '],
]
const PAISES: [RegExp, string][] = [
  [/\bBrazil\b/g, 'Brasil'], [/\bUnited States\b/g, 'Estados Unidos'], [/\bMexico\b/g, 'México'], [/\bCanada\b/g, 'Canadá'],
  [/\bBolivia\b/g, 'Bolívia'], [/\bParaguay\b/g, 'Paraguai'], [/\bColombia\b/g, 'Colômbia'], [/\bUruguay\b/g, 'Uruguai'],
  [/\bJapan\b/g, 'Japão'], [/\bIndonesia\b/g, 'Indonésia'], [/\bPhilippines\b/g, 'Filipinas'], [/\bAustralia\b/g, 'Austrália'],
  [/\bRussia\b/g, 'Rússia'], [/\bItaly\b/g, 'Itália'], [/\bIceland\b/g, 'Islândia'], [/\bNew Zealand\b/g, 'Nova Zelândia'],
]
/** Nome do evento em português quando é um padrão conhecido; senão, o nome original da NASA. */
export function tituloPt(titulo: string) {
  let t = titulo.trim()
  for (const [re, por] of TROCAS) if (re.test(t)) { t = t.replace(re, por); break }
  for (const [re, por] of PAISES) t = t.replace(re, por)
  return t.replace(/\s+/g, ' ').trim()
}

const CAPITAIS: [string, number, number][] = [
  ['Rio Branco/AC', -9.975, -67.81], ['Maceió/AL', -9.665, -35.735], ['Macapá/AP', 0.035, -51.07], ['Manaus/AM', -3.119, -60.022],
  ['Salvador/BA', -12.971, -38.511], ['Fortaleza/CE', -3.732, -38.527], ['Brasília/DF', -15.794, -47.882], ['Vitória/ES', -20.315, -40.312],
  ['Goiânia/GO', -16.686, -49.265], ['São Luís/MA', -2.53, -44.303], ['Cuiabá/MT', -15.601, -56.097], ['Campo Grande/MS', -20.469, -54.62],
  ['Belo Horizonte/MG', -19.917, -43.934], ['Belém/PA', -1.456, -48.49], ['João Pessoa/PB', -7.115, -34.863], ['Curitiba/PR', -25.429, -49.271],
  ['Recife/PE', -8.048, -34.877], ['Teresina/PI', -5.089, -42.802], ['Rio de Janeiro/RJ', -22.906, -43.173], ['Natal/RN', -5.794, -35.211],
  ['Porto Alegre/RS', -30.035, -51.218], ['Porto Velho/RO', -8.761, -63.9], ['Boa Vista/RR', 2.82, -60.672], ['Florianópolis/SC', -27.595, -48.548],
  ['São Paulo/SP', -23.551, -46.633], ['Aracaju/SE', -10.947, -37.073], ['Palmas/TO', -10.249, -48.324],
]
function km(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = (x: number) => (x * Math.PI) / 180
  const h = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}
/** Capital brasileira mais perto do evento (referência simples de "onde fica"). */
export function capitalMaisPerto(e: NasaEvent): { nome: string; km: number } | null {
  const c = e.coordinates
  if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return null
  let melhor: { nome: string; km: number } | null = null
  for (const [nome, lat, lon] of CAPITAIS) { const d = km(c.latitude, c.longitude, lat, lon); if (!melhor || d < melhor.km) melhor = { nome, km: d } }
  return melhor
}
export function ondeFica(e: NasaEvent) {
  const p = capitalMaisPerto(e)
  if (!p) return 'Localização não informada'
  const d = Math.round(p.km)
  return d <= 50 ? `Perto de ${p.nome}` : `A ${d.toLocaleString('pt-BR')} km de ${p.nome} (capital mais perto)`
}

/** "Visto há N dias" pelo satélite. */
export function vistoHa(e: NasaEvent, agora = Date.now()) {
  const t = e.observedAt ? Date.parse(e.observedAt) : NaN
  if (!Number.isFinite(t)) return 'Data não informada'
  const dias = Math.floor((agora - t) / 86400000)
  return dias <= 0 ? 'Visto hoje' : dias === 1 ? 'Visto ontem' : `Visto há ${dias} dias`
}
