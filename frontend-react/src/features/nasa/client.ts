import type { ApiStatus, EventsResponse } from './contracts'

type RequestOptions = { baseUrl: string; signal?: AbortSignal; fetcher?: typeof fetch }
const states = ['success', 'empty', 'stale', 'unavailable', 'error']
function sanitizeCoordinates(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const data = value as EventsResponse
  if (!Array.isArray(data.events)) return value
  let partial = false
  const events = data.events.map(event => {
    if (!event || typeof event !== 'object' || event.coordinates === null || event.coordinates === undefined) return event
    const point = event.coordinates
    if (Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180 && ['point', 'first_polygon_vertex'].includes(point.method) && event.coordinateState === 'available') return event
    partial = true
    return { ...event, coordinates: null, coordinateState: 'invalid' }
  })
  return partial ? { ...data, events, dataQuality: 'partial' } : value
}
function validEvents(value: unknown): value is EventsResponse {
  if (!value || typeof value !== 'object') return false
  const data = value as EventsResponse
  return states.includes(data.state) && data.source === 'NASA EONET' && data.isSimulation === false && data.riskCalculated === false
    && typeof data.sourceUrl === 'string' && typeof data.query?.status === 'string' && typeof data.query?.category === 'string'
    && (data.ageSeconds === null || (Number.isFinite(data.ageSeconds) && data.ageSeconds >= 0))
    && typeof data.queriedAt === 'string' && Number.isFinite(Date.parse(data.queriedAt))
    && (data.fetchedAt === null || (typeof data.fetchedAt === 'string' && Number.isFinite(Date.parse(data.fetchedAt))))
    && ['miss', 'fresh', 'stale', 'none'].includes(data.cache) && ['complete', 'partial', 'unavailable'].includes(data.dataQuality)
    && (data.error === null || (typeof data.error?.code === 'string' && typeof data.error?.message === 'string'))
    && Array.isArray(data.events) && data.events.every(event => event && typeof event.id === 'string' && typeof event.title === 'string'
      && event.source === 'NASA EONET' && event.isSimulation === false
      && ['available', 'missing', 'invalid', 'unsupported'].includes(event.coordinateState)
      && ['recent', 'outdated', 'unknown'].includes(event.observationState)
      && (event.observedAt === null || (typeof event.observedAt === 'string' && Number.isFinite(Date.parse(event.observedAt))))
      && Array.isArray(event.categories) && event.categories.every(c => typeof c.id === 'string' && typeof c.title === 'string')
      && (event.coordinates === null || (Number.isFinite(event.coordinates?.latitude) && Number.isFinite(event.coordinates?.longitude)
        && Math.abs(event.coordinates.latitude) <= 90 && Math.abs(event.coordinates.longitude) <= 180
        && ['point', 'first_polygon_vertex'].includes(event.coordinates.method))))
    && (data.state !== 'empty' || data.events.length === 0)
    && (data.state !== 'success' || data.events.length > 0)
}
async function request(path: string, options: RequestOptions) {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000)
  return (options.fetcher ?? fetch)(`${options.baseUrl.replace(/\/$/, '')}/api/v1/${path}`, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' })
}
export async function getEvents(options: RequestOptions): Promise<EventsResponse> {
  const response = await request('events', options)
  const data: unknown = sanitizeCoordinates(await response.json())
  if (!validEvents(data)) throw new Error('Resposta inválida da API. A situação de risco não pode ser determinada.')
  if (!response.ok && !((response.status === 502 && data.state === 'error') || (response.status === 503 && data.state === 'unavailable'))) {
    throw new Error('Falha HTTP na API. A situação de risco não pode ser determinada.')
  }
  return data
}
export async function getApiStatus(options: RequestOptions): Promise<ApiStatus> {
  const response = await request('status', options)
  const data = await response.json() as ApiStatus
  if (!response.ok || data.status !== 'ok' || data.riskCalculated !== false || !data.nasa || !states.includes(data.nasa.state)) throw new Error('Não foi possível verificar o estado da API.')
  return data
}
