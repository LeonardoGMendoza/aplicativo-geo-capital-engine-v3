// Locais reais próximos (OpenStreetMap) via API do MVP: /api/v1/places/nearby e /api/v1/places/geocode.
// Porta para o React o mapa de abrigos do painel Streamlit (frontend/mapa_interativo.py).
export type PlaceCategory = 'shelter' | 'hospital' | 'clinic' | 'police' | 'ngo' | 'food' | 'pharmacy' | 'lodging' | 'shop'
export type Coordinates = { latitude: number; longitude: number }
export interface Place {
  id: string; name: string; category: PlaceCategory; categoryLabel: string
  coordinates: Coordinates; distanceKm: number; address: string | null; osmUrl: string
  shelterKind?: 'mapped' | 'possible'; note?: string
}
export interface NearbyResponse {
  state: 'success' | 'empty' | 'stale'; source: string; sourceUrl: string; queriedAt: string; fetchedAt: string
  isSimulation: false; riskCalculated: false; origin: Coordinates; radiusKm: number
  categories: { id: PlaceCategory; label: string; count: number }[]; items: Place[]; notice: string; attribution: string
}
export interface GeocodeResult { name: string; displayName: string | null; coordinates: Coordinates }

export const categoryMeta: Record<PlaceCategory, { label: string; short: string; emoji: string; color: string; nearest: string }> = {
  shelter: { label: 'Abrigo / ponto de encontro', short: 'Abrigos', emoji: '🏠', color: '#16a34a', nearest: 'Abrigo mais próximo' },
  hospital: { label: 'Hospital', short: 'Hospital', emoji: '🏥', color: '#dc2626', nearest: 'Hospital mais próximo' },
  clinic: { label: 'UBS / UPA / clínica', short: 'UBS/UPA', emoji: '🩺', color: '#ea580c', nearest: 'UBS/UPA mais próxima' },
  police: { label: 'Delegacia / polícia', short: 'Delegacia', emoji: '👮', color: '#7c3aed', nearest: 'Delegacia mais próxima' },
  ngo: { label: 'ONG / apoio social', short: 'ONG', emoji: '🤝', color: '#0891b2', nearest: 'ONG mais próxima' },
  food: { label: 'Alimento', short: 'Alimento', emoji: '🍲', color: '#ca8a04', nearest: 'Alimento mais próximo' },
  pharmacy: { label: 'Farmácia', short: 'Medicamento', emoji: '💊', color: '#db2777', nearest: 'Farmácia mais próxima' },
  lodging: { label: 'Hospedagem', short: 'Dormir', emoji: '🛏️', color: '#0284c7', nearest: 'Hospedagem mais próxima' },
  shop: { label: 'Mercado', short: 'Compras', emoji: '🛒', color: '#a16207', nearest: 'Mercado mais próximo' },
}
export const categoryOrder = Object.keys(categoryMeta) as PlaceCategory[]

// Cidades do estudo de caso (mesmas do painel Streamlit), para consulta rápida sem digitar.
export const quickCities: { name: string; coordinates: Coordinates }[] = [
  { name: 'São Paulo/SP', coordinates: { latitude: -23.5505, longitude: -46.6333 } },
  { name: 'São Sebastião/SP', coordinates: { latitude: -23.8077, longitude: -45.4075 } },
  { name: 'Porto Alegre/RS', coordinates: { latitude: -30.0346, longitude: -51.2177 } },
  { name: 'Lajeado/RS', coordinates: { latitude: -29.4661, longitude: -51.9615 } },
  { name: 'Macaé/RJ', coordinates: { latitude: -22.3762, longitude: -41.7869 } },
]

type Options = { baseUrl?: string; signal?: AbortSignal; fetcher?: typeof fetch }
export class PlacesApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
const validCoordinates = (c: unknown): c is Coordinates => {
  const p = c as Coordinates
  return !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180
}
const isoDate = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v))

async function placesRequest(path: string, options: Options) {
  const base = options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
  // Overpass pode levar até ~25 s por raio; a API tenta dois raios.
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(70_000)]) : AbortSignal.timeout(70_000)
  const response = await (options.fetcher ?? fetch)(`${base.replace(/\/$/, '')}/api/v1/places/${path}`, { signal, cache: 'no-store', headers: { Accept: 'application/json' } })
  let data: unknown = null
  try { data = await response.json() } catch { data = null }
  if (!response.ok) {
    const message = response.status === 503 ? 'OpenStreetMap indisponível no momento. Tente de novo em instantes.'
      : response.status === 422 ? 'Busca inválida. Confira o texto ou as coordenadas.'
      : 'Não foi possível consultar os locais. Verifique se a API está rodando.'
    throw new PlacesApiError(response.status, message)
  }
  return data
}

export function validNearby(value: unknown): value is NearbyResponse {
  const d = value as NearbyResponse
  return !!d && ['success', 'empty', 'stale'].includes(d.state) && d.isSimulation === false && d.riskCalculated === false
    && isoDate(d.queriedAt) && isoDate(d.fetchedAt) && validCoordinates(d.origin) && Number.isFinite(d.radiusKm) && d.radiusKm > 0
    && typeof d.notice === 'string' && Array.isArray(d.categories) && Array.isArray(d.items)
    && d.items.every(p => !!p && typeof p.id === 'string' && typeof p.name === 'string' && p.category in categoryMeta
      && validCoordinates(p.coordinates) && Number.isFinite(p.distanceKm) && p.distanceKm >= 0
      && typeof p.osmUrl === 'string' && p.osmUrl.startsWith('https://www.openstreetmap.org/'))
    && (d.state !== 'empty' || d.items.length === 0)
}

export async function getNearbyPlaces(origin: Coordinates, options: Options = {}): Promise<NearbyResponse> {
  if (!validCoordinates(origin)) throw new PlacesApiError(422, 'Coordenadas inválidas.')
  const params = new URLSearchParams({ lat: String(origin.latitude), lon: String(origin.longitude) })
  const data = await placesRequest(`nearby?${params}`, options)
  if (!validNearby(data)) throw new PlacesApiError(502, 'A API respondeu num formato inesperado.')
  return data
}

export async function geocode(query: string, options: Options = {}): Promise<GeocodeResult[]> {
  const q = query.trim().replace(/\s+/g, ' ')
  if (q.length < 2 || q.length > 120) throw new PlacesApiError(422, 'Digite ao menos 2 letras (cidade, bairro ou endereço).')
  const data = await placesRequest(`geocode?${new URLSearchParams({ q })}`, options) as { state?: string; items?: unknown }
  if (!data || !['success', 'empty', 'stale'].includes(data.state ?? '') || !Array.isArray(data.items)) throw new PlacesApiError(502, 'A API respondeu num formato inesperado.')
  return (data.items as GeocodeResult[]).filter(r => r && typeof r.name === 'string' && validCoordinates(r.coordinates))
}

/** Rota a partir da localização atual do aparelho: a origem do usuário não vai na URL. */
export function routeLinks(destination: Coordinates) {
  const c = `${destination.latitude},${destination.longitude}`
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c)}`,
    waze: `https://waze.com/ul?ll=${encodeURIComponent(c)}&navigate=yes`,
  }
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}

export function nearestOf(items: Place[], category: PlaceCategory) {
  return items.filter(p => p.category === category).reduce<Place | undefined>((best, p) => !best || p.distanceKm < best.distanceKm ? p : best, undefined)
}

export function filterPlaces(items: Place[], active: ReadonlySet<PlaceCategory>) {
  return items.filter(p => active.has(p.category)).sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, 'pt-BR'))
}
