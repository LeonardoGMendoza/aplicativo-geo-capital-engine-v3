import type { Coordinates } from '@/features/shelters/places'

/**
 * evitadas = áreas de risco que a rota mais rápida cruzava e esta desvia;
 * noCaminho = áreas que nenhuma rota encontrada conseguiu evitar (o app avisa a pessoa).
 */
export type Rota = { pontos: [number, number][]; km: number; minutos: number | null; calculada: boolean; evitadas?: string[]; noCaminho?: string[] }
/** Área de risco cadastrada pela Defesa Civil (círculo: centro + raio em metros). */
export type AreaRisco = { id: number | string; nome: string; latitude: number; longitude: number; raioM: number }

const OSRM = 'https://router.project-osrm.org/route/v1/driving'

/** Linha reta (quando o serviço de rotas não responde): só desenho, sem tempo. */
export function linhaReta(a: Coordinates, b: Coordinates): Rota {
  const r = Math.PI / 180
  const h = Math.sin((b.latitude - a.latitude) * r / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin((b.longitude - a.longitude) * r / 2) ** 2
  return { pontos: [[a.latitude, a.longitude], [b.latitude, b.longitude]], km: 12742 * Math.asin(Math.sqrt(h)), minutos: null, calculada: false }
}

/** Metros entre dois pontos [lat, lon]. */
function metros(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180
  const h = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2
  return 12742000 * Math.asin(Math.sqrt(h))
}

/** Metros do ponto p até o segmento a-b (plano local; serve para distâncias de cidade). */
function metrosAteSegmento(p: [number, number], a: [number, number], b: [number, number]) {
  const kx = 111320 * Math.cos(p[0] * Math.PI / 180), ky = 110540
  const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky, bx = (b[1] - p[1]) * kx, by = (b[0] - p[0]) * ky
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
  const t = l2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0
  return Math.hypot(ax + t * dx, ay + t * dy)
}

/** Áreas de risco que o caminho atravessa (ou encosta). Uma linha com 2 pontos = linha reta. */
export function areasNoCaminho(pontos: [number, number][], areas: AreaRisco[]): AreaRisco[] {
  return areas.filter(ar => {
    const c: [number, number] = [ar.latitude, ar.longitude]
    if (pontos.length === 1) return metros(c, pontos[0]) <= ar.raioM
    for (let i = 1; i < pontos.length; i++) if (metrosAteSegmento(c, pontos[i - 1], pontos[i]) <= ar.raioM) return true
    return false
  })
}

/** Áreas onde o ponto já está dentro (não dá para desviar de onde a pessoa está ou do próprio destino). */
export function areasEmVolta(c: Coordinates, areas: AreaRisco[]) {
  return areas.filter(ar => metros([c.latitude, c.longitude], [ar.latitude, ar.longitude]) <= ar.raioM)
}

async function osrm(paradas: Coordinates[], alternativas: boolean, signal?: AbortSignal): Promise<Rota[]> {
  const coords = paradas.map(p => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`).join(';')
  const resp = await fetch(`${OSRM}/${coords}?overview=full&geometries=geojson${alternativas ? '&alternatives=3' : ''}`, { signal })
  if (!resp.ok) throw new Error(String(resp.status))
  const data = await resp.json() as { code?: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] }
  const rotas = (data.code === 'Ok' ? data.routes ?? [] : []).filter(r => Array.isArray(r.geometry?.coordinates) && r.geometry.coordinates.length >= 2)
  if (!rotas.length) throw new Error('sem rota')
  return rotas.map(r => ({ pontos: r.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]), km: r.distance / 1000, minutos: Math.max(1, Math.round(r.duration / 60)), calculada: true }))
}

/** Ponto de passagem ao lado da área de risco, para a rota contornar por fora (lado = 1 ou -1). */
function pontoAoLado(ar: AreaRisco, a: Coordinates, b: Coordinates, lado: number): Coordinates {
  const kx = 111320 * Math.cos(ar.latitude * Math.PI / 180), ky = 110540
  const dx = (b.longitude - a.longitude) * kx, dy = (b.latitude - a.latitude) * ky
  const n = Math.hypot(dx, dy) || 1
  const dist = ar.raioM * 1.6 + 400
  return { latitude: ar.latitude + (dx / n) * lado * dist / ky, longitude: ar.longitude + (-dy / n) * lado * dist / kx }
}

/**
 * Pontos de passagem para o Google Maps contornar as áreas de risco que a linha reta a-b atravessa
 * (o link do Google aceita "waypoints"; o do Waze não). Vazio = nada a desviar.
 */
export function desvioPorPontos(a: Coordinates, b: Coordinates, areas: AreaRisco[]): Coordinates[] {
  const fixas = new Set([...areasEmVolta(a, areas), ...areasEmVolta(b, areas)].map(ar => ar.id))
  const evitar = areas.filter(ar => !fixas.has(ar.id))
  const cruzadas = areasNoCaminho([[a.latitude, a.longitude], [b.latitude, b.longitude]], evitar)
  if (!cruzadas.length) return []
  // da origem para o destino, na ordem em que o caminho encontra cada área
  const dist = (ar: AreaRisco) => metros([a.latitude, a.longitude], [ar.latitude, ar.longitude])
  // Para cada área, DOIS pontos do mesmo lado: um antes e um depois dela. Com um ponto só, o Google
  // chegava até ele passando por dentro da área. O link do celular aceita no máximo 3 paradas.
  const pontos: Coordinates[] = []
  for (const ar of cruzadas.sort((x, y) => dist(x) - dist(y))) {
    if (pontos.length + 2 > 3) break
    const opcoes = [1, -1].map(lado => contorno(ar, a, b, lado))
    pontos.push(...(opcoes.find(par => par.every(p => !areasEmVolta(p, evitar).length)) ?? opcoes[0]))
  }
  return pontos
}

/** Dois pontos ao lado da área (lado = 1 ou -1): um antes e um depois dela, no sentido a → b. */
function contorno(ar: AreaRisco, a: Coordinates, b: Coordinates, lado: number): Coordinates[] {
  const kx = 111320 * Math.cos(ar.latitude * Math.PI / 180), ky = 110540
  const dx = (b.longitude - a.longitude) * kx, dy = (b.latitude - a.latitude) * ky
  const n = Math.hypot(dx, dy) || 1
  const ux = dx / n, uy = dy / n
  const lateral = ar.raioM * 1.4 + 500, frente = ar.raioM + 800
  return [-1, 1].map(s => {
    const x = s * frente * ux + lado * uy * lateral, y = s * frente * uy - lado * ux * lateral
    return { latitude: ar.latitude + y / ky, longitude: ar.longitude + x / kx }
  })
}

/** Link do Google Maps com origem, destino e (se houver) os pontos de passagem do desvio. */
export function googleComDesvio(a: Coordinates, b: Coordinates, pontos: Coordinates[]) {
  const c = (p: Coordinates) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`
  const q = new URLSearchParams({ api: '1', origin: c(a), destination: c(b), travelmode: 'driving' })
  if (pontos.length) q.set('waypoints', pontos.map(c).join('|'))
  return `https://www.google.com/maps/dir/?${q}`
}

/**
 * Rota real pelas ruas do OpenStreetMap (OSRM, público e sem chave). Se falhar, devolve a linha reta.
 * Com áreas de risco (cadastro da Defesa Civil): como o guia de evacuação de Hiroshima, procura um caminho
 * que não atravesse nenhuma delas: primeiro entre as rotas alternativas, depois contornando a área por um
 * ponto de passagem. Se nada servir, devolve a mais rápida com o aviso em noCaminho.
 */
export async function buscarRota(a: Coordinates, b: Coordinates, { signal, areas = [] }: { signal?: AbortSignal; areas?: AreaRisco[] } = {}): Promise<Rota> {
  // Não dá para desviar da área onde a pessoa já está, nem da área do próprio destino.
  const fixas = new Set([...areasEmVolta(a, areas), ...areasEmVolta(b, areas)].map(ar => ar.id))
  const evitar = areas.filter(ar => !fixas.has(ar.id))
  const nomes = (l: AreaRisco[]) => l.map(ar => ar.nome)
  try {
    const rotas = await osrm([a, b], evitar.length > 0, signal)
    const cruzadas = areasNoCaminho(rotas[0].pontos, evitar)
    if (!cruzadas.length) return rotas[0]
    const alternativa = rotas.slice(1).find(r => !areasNoCaminho(r.pontos, evitar).length)
    if (alternativa) return { ...alternativa, evitadas: nomes(cruzadas) }
    for (const ar of cruzadas.slice(0, 2)) {
      for (const lado of [1, -1]) {
        try {
          const [desvio] = await osrm([a, pontoAoLado(ar, a, b, lado), b], false, signal)
          if (desvio && !areasNoCaminho(desvio.pontos, evitar).length) return { ...desvio, evitadas: nomes(cruzadas) }
        } catch (e) { if (signal?.aborted) throw e }
      }
    }
    return { ...rotas[0], noCaminho: nomes(cruzadas) }
  } catch (e) {
    if (signal?.aborted) throw e
    const reta = linhaReta(a, b)
    const cruzadas = areasNoCaminho(reta.pontos, evitar)
    return cruzadas.length ? { ...reta, noCaminho: nomes(cruzadas) } : reta
  }
}

/** Barra verde da lista: quanto mais perto, mais cheia (0,08 a 1). */
export function proximidade(km: number, maxKm: number) {
  if (!(maxKm > 0)) return 1
  return Math.min(1, Math.max(0.08, 1 - km / (maxKm * 1.15)))
}
