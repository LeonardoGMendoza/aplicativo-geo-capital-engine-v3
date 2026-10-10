export type QueryState = 'success' | 'empty' | 'stale' | 'unavailable' | 'error'
export interface NasaEvent {
  id: string
  title: string
  categories: { id: string; title: string }[]
  coordinates: { latitude: number; longitude: number; method: 'point' | 'first_polygon_vertex' } | null
  geometryType: string | null
  coordinateState: 'available' | 'missing' | 'invalid' | 'unsupported'
  observedAt: string | null
  observationState: 'recent' | 'outdated' | 'unknown'
  source: 'NASA EONET'
  isSimulation: false
}
export interface EventsResponse {
  state: QueryState
  source: 'NASA EONET'
  sourceUrl: string
  query: { status: string; category: string }
  queriedAt: string
  fetchedAt: string | null
  ageSeconds: number | null
  cache: 'miss' | 'fresh' | 'stale' | 'none'
  dataQuality: 'complete' | 'partial' | 'unavailable'
  events: NasaEvent[]
  error: { code: string; message: string } | null
  isSimulation: false
  riskCalculated: false
}
export interface ApiStatus {
  status: 'ok'
  nasa: { enabled: boolean; state: QueryState; source: 'NASA EONET'; fetchedAt: string | null; ageSeconds: number | null; error: EventsResponse['error'] }
  riskCalculated: false
}
