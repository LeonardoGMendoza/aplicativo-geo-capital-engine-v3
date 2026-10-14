// Placas tectônicas (bordas PB2002) e terremotos reais da semana (USGS), pela nossa API.
// Dados reais: nada aqui é simulado. Proximidade de uma borda não é previsão de terremoto.

export type Sismo = {
  id: string; magnitude: number; place: string | null; observedAt: string; depthKm: number | null
  coordinates: { latitude: number; longitude: number }; url: string | null; tsunamiSignal: boolean
}
export type Borda = { nome: string; positions: [number, number][][] }
/** 'dia' (últimas 24 h), 'semana', 'mes' (últimos 30 dias) ou um mês já encerrado 'AAAA-MM' (histórico). */
export type Periodo = string
export type PlacasDados = { bordas: Borda[]; sismos: Sismo[]; erroPlacas: boolean; erroSismos: boolean; fonteSismos: string; periodo: Periodo }

type Options = { baseUrl?: string; signal?: AbortSignal; fetcher?: typeof fetch }
const base = (o: Options) => (o.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')

async function pedir(caminho: string, o: Options) {
  const r = await (o.fetcher ?? fetch)(`${base(o)}/api/v1/${caminho}`, { signal: o.signal, headers: { Accept: 'application/json' }, cache: 'no-store' })
  const corpo = await r.json().catch(() => null)
  if (!r.ok || !corpo || corpo.isSimulation !== false) throw new Error('indisponível')
  return corpo
}

const PLACAS: Record<string, string> = {
  PA: 'Pacífico', NA: 'Norte-Americana', SA: 'Sul-Americana', NZ: 'Nazca', CO: 'Cocos', CA: 'Caribe', PM: 'Panamá',
  ND: 'Andes do Norte', AP: 'Altiplano', JF: 'Juan de Fuca', RI: 'Rivera', GP: 'Galápagos', EA: 'Ilha de Páscoa', JZ: 'Juan Fernández',
  SC: 'Scotia', SW: 'Sandwich', SL: 'Shetland', AN: 'Antártica', AF: 'Africana', EU: 'Eurasiática', AU: 'Australiana', IN: 'Indiana',
  AR: 'Arábica', SO: 'Somali', PS: 'Mar das Filipinas', OK: 'Okhotsk', ON: 'Okinawa', YA: 'Yangtzé', SU: 'Sunda', MA: 'Marianas',
  TO: 'Tonga', KE: 'Kermadec', NH: 'Novas Hébridas', AT: 'Anatólia', AS: 'Egeu', CL: 'Carolinas', BS: 'Mar de Banda', BH: 'Cabeça de Pássaro',
  MS: 'Mar das Molucas', TI: 'Timor', BU: 'Birmânia', WL: 'Woodlark', SB: 'Bismarck do Sul', NB: 'Bismarck do Norte', MN: 'Manus',
  SS: 'Mar de Salomão', FT: 'Futuna', NI: 'Niuafo’ou', CR: 'Recife Conway', BR: 'Recife Balmoral', MO: 'Maoke',
}
/** "NZ\SA" ou "NZ-SA" → "Placa de Nazca × Placa Sul-Americana". */
export function nomeBorda(codigo: unknown) {
  const partes = String(codigo ?? '').split(/[-/\\]/).map(p => p.trim()).filter(Boolean)
  const nomes = partes.map(p => PLACAS[p] ?? p)
  return nomes.length === 2 ? `Placa ${nomes[0]} × Placa ${nomes[1]}` : 'Borda entre placas tectônicas'
}

/** Linhas do GeoJSON em [lat, lon], partidas onde cruzam o meridiano 180 (senão o traço atravessa o mapa). */
export function bordasDoGeojson(geo: unknown): Borda[] {
  const feats = (geo as { features?: unknown[] } | null)?.features
  if (!Array.isArray(feats)) return []
  const out: Borda[] = []
  for (const f of feats as { geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> }[]) {
    const g = f?.geometry
    const linhas = g?.type === 'LineString' ? [g.coordinates] : g?.type === 'MultiLineString' ? (g.coordinates as unknown[]) : []
    const positions: [number, number][][] = []
    for (const linha of linhas) {
      if (!Array.isArray(linha)) continue
      let atual: [number, number][] = []
      let lonAnterior: number | null = null
      for (const p of linha) {
        const lon = Number((p as number[])[0]), lat = Number((p as number[])[1])
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
        if (lonAnterior !== null && Math.abs(lon - lonAnterior) > 180) { if (atual.length > 1) positions.push(atual); atual = [] }
        atual.push([lat, lon]); lonAnterior = lon
      }
      if (atual.length > 1) positions.push(atual)
    }
    if (positions.length) out.push({ nome: nomeBorda(f.properties?.Name ?? f.properties?.name), positions })
  }
  return out
}

const RUMOS: Record<string, string> = { N: 'N', S: 'S', E: 'L', W: 'O' }
const PAISES: [RegExp, string][] = [
  [/\b(Central|Southern|Northern) (Peru|Chile|Mexico|Ecuador)\b/g, '$1 do $2'], [/\b(Central|Southern|Northern) (Colombia|California)\b/g, '$1 da $2'],
  [/\bCentral (do|da)\b/g, 'centro $1'], [/\bSouthern (do|da)\b/g, 'sul $1'], [/\bNorthern (do|da)\b/g, 'norte $1'],
  [/\bPanama City\b/g, 'Cidade do Panamá'], [/\bMexico\b/g, 'México'], [/\bPanama\b/g, 'Panamá'], [/\bEcuador\b/g, 'Equador'], [/\bColombia\b/g, 'Colômbia'], [/\bNicaragua\b/g, 'Nicarágua'],
  [/\bJapan\b/g, 'Japão'], [/\bPhilippines\b/g, 'Filipinas'], [/\bIndonesia\b/g, 'Indonésia'], [/\bNew Zealand\b/g, 'Nova Zelândia'],
  [/\bRussia\b/g, 'Rússia'], [/\bAlaska\b/g, 'Alasca'], [/\bCalifornia\b/g, 'Califórnia'], [/, CA$/g, ', Califórnia (EUA)'],
  [/\bBolivia\b/g, 'Bolívia'], [/\bArgentina\b/g, 'Argentina'], [/\bChile\b/g, 'Chile'], [/\bPeru\b/g, 'Peru'],
]
/** "45 km SW of Trujillo, Peru" → "a 45 km a SO de Trujillo, Peru". Texto do USGS, só traduzido. */
export function lugarPt(lugar: string | null | undefined) {
  if (!lugar) return 'Local não informado'
  let t = lugar.trim()
  const m = t.match(/^(\d+(?:\.\d+)?) km ([NSEW]{1,3}) of (.+)$/)
  if (m) t = `a ${m[1]} km a ${m[2].split('').map(c => RUMOS[c] ?? c).join('')} de ${m[3]}`
  t = t.replace(/^near the coast of /i, 'perto da costa de ').replace(/^off the coast of /i, 'na costa de ').replace(/^south of /i, 'ao sul de ').replace(/^north of /i, 'ao norte de ')
  for (const [re, por] of PAISES) t = t.replace(re, por)
  return t.replace(/\bde (centro|sul|norte) (do|da)\b/g, 'do $1 $2')
}

export function corDoSismo(m: number) { return m >= 7 ? '#b0002a' : m >= 6 ? '#ff3b4f' : m >= 5 ? '#f08c1a' : '#f5c518' }
export function raioDoSismo(m: number) { return Math.max(4, Math.min(20, 4 + (m - 4.5) * 4)) }
export function magnitudePt(m: number) { return m.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }
export function haQuanto(iso: string, agora = Date.now()) {
  const h = (agora - Date.parse(iso)) / 3600000
  if (!Number.isFinite(h)) return ''
  if (h < 1) return 'há menos de 1 hora'
  if (h < 24) return `há ${Math.floor(h)} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'há 1 dia' : `há ${d} dias`
}

/** Costa do Pacífico e do Caribe das Américas: do Alasca à Patagônia, incluindo a borda do Caribe (Venezuela). */
export const AMERICAS_PACIFICO: [[number, number], [number, number]] = [[-58, -165], [66, -58]]
export function naCostaDasAmericas(s: Sismo) {
  const { latitude: la, longitude: lo } = s.coordinates
  return la >= -60 && la <= 72 && lo >= -170 && lo <= -58
}

/** Nomes fixos de referência no mapa (geografia, não dados do dia). */
export const ROTULOS: { texto: string; lat: number; lon: number; destaque?: boolean }[] = [
  { texto: 'Falha de San Andreas', lat: 35.6, lon: -120.4, destaque: true },
  { texto: 'Placa de Nazca', lat: -22, lon: -90 },
  { texto: 'Fossa Peru–Chile', lat: -16.5, lon: -76.2, destaque: true },
  { texto: 'Placa de Cocos', lat: 7.5, lon: -96 },
  { texto: 'Placa do Caribe', lat: 15, lon: -74 },
  { texto: 'Placa do Pacífico', lat: 12, lon: -135 },
  { texto: 'Placa Sul-Americana', lat: -30, lon: -40 },
  { texto: 'Placa Norte-Americana', lat: 47, lon: -98 },
]

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const ehMes = (p: Periodo) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p)
/** '2026-09' → 'setembro de 2026' */
export function nomeMes(p: Periodo) { const [a, m] = p.split('-').map(Number); return `${MESES[m - 1]} de ${a}` }
export function nomePeriodo(p: Periodo) {
  return p === 'dia' ? 'nas últimas 24 horas' : p === 'semana' ? 'nos últimos 7 dias' : p === 'mes' ? 'nos últimos 30 dias' : ehMes(p) ? `em ${nomeMes(p)}` : ''
}
/** Os meses já encerrados, do mais recente para trás (o mês atual fica em "30 dias"). */
export function mesesAnteriores(hoje = new Date(), n = 12) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1 - i, 1)
    const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const nome = nomeMes(valor)
    return { valor, nome: nome[0].toUpperCase() + nome.slice(1) }
  })
}
export function caminhoSismos(p: Periodo) { return ehMes(p) ? `earthquakes?mes=${p}` : `earthquakes?periodo=${p}` }

const sismosValidos = (items: unknown) => Array.isArray(items)
  ? (items as Sismo[]).filter(x => Number.isFinite(x?.magnitude) && Number.isFinite(x?.coordinates?.latitude) && Number.isFinite(x?.coordinates?.longitude))
  : []

/** Só os terremotos de outro período (as placas não mudam). Nunca rejeita: em falha devolve erroSismos. */
export async function buscarSismos(periodo: Periodo, o: Options = {}): Promise<Pick<PlacasDados, 'sismos' | 'erroSismos'>> {
  try {
    const c = await pedir(caminhoSismos(periodo), o)
    return { sismos: sismosValidos(c.items), erroSismos: !Array.isArray(c.items) }
  } catch { return { sismos: [], erroSismos: true } }
}

export async function buscarPlacas(o: Options = {}, periodo: Periodo = 'dia'): Promise<PlacasDados> {
  const [p, s] = await Promise.allSettled([pedir('tectonic-plates', o), pedir(caminhoSismos(periodo), o)])
  const bordas = p.status === 'fulfilled' ? bordasDoGeojson(p.value.geojson) : []
  const sismos = s.status === 'fulfilled' ? sismosValidos(s.value.items) : []
  return { bordas, sismos, erroPlacas: p.status !== 'fulfilled' || !bordas.length, erroSismos: s.status !== 'fulfilled', fonteSismos: 'USGS', periodo }
}
