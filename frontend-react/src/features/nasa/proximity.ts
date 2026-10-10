import type { NasaEvent } from './contracts'
export interface Asset { id: string; name: string; coordinates: { latitude: number; longitude: number }; sourceFile: string; communityDescription: string; isReferenceData: true; verifiedAt: null }
export interface AssetCatalog { assets: Asset[]; datasetVersion: string; policy: { id: string; radiusKm: number; selection: string } }
export interface ProximityResult {
  state: 'success' | 'empty' | 'partial' | 'blocked' | 'unavailable'
  eventsFetchedAt: string | null; analyzedAt: string; source: string
  policy: { id: string; radiusKm: number; selection: string }; evaluatedPairCount: number
  riskConfirmed: false; targetsAreReferenceData: true
  isSimulation?: false; requiresHumanConfirmation?: true; datasetVersion?: string
  matches: { asset: Asset; event: NasaEvent; distanceKm: number; geometryApproximate: boolean }[]
  skipped: { eventId: string; reason: string }[]; warnings: string[]
}
type Options = { signal?: AbortSignal; fetcher?: typeof fetch; baseUrl?: string }
export class GeographyApiError extends Error {
  readonly status: number
  constructor(status: number) {
    super(status === 422 ? 'A API rejeitou os identificadores ou o contexto da consulta. Atualize o cadastro e os eventos NASA.' : 'Falha na API de triagem geográfica.')
    this.status = status
  }
}
export async function geographyRequest(path: string, body: unknown, options: Options = {}) {
  const base = options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000)
  const response = await (options.fetcher ?? fetch)(`${base.replace(/\/$/, '')}/api/v1/${path}`, { method: body ? 'POST' : 'GET', signal, cache: 'no-store', headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const data = await response.json()
  if (!response.ok && !((response.status === 409 && data.state === 'blocked') || (response.status === 503 && data.state === 'unavailable'))) throw new GeographyApiError(response.status)
  return data as unknown
}
export async function getAssets(options?: Options): Promise<AssetCatalog> {
  const data = await geographyRequest('assets', null, options) as AssetCatalog
  if (!data || !Array.isArray(data.assets) || new Set(data.assets.map(a => a?.id)).size !== data.assets.length || data.assets.some(a => !a?.id || !a.name || a.isReferenceData !== true || !Number.isFinite(a.coordinates?.latitude) || Math.abs(a.coordinates.latitude) > 90 || !Number.isFinite(a.coordinates?.longitude) || Math.abs(a.coordinates.longitude) > 180) || data.policy?.id !== 'legacy-panel-assets-600-nearest') throw new Error('Catálogo de ativos inválido.')
  return data
}
export async function getProximity(assetId: string, fetchedAt: string, options?: Options): Promise<ProximityResult> {
  return getProximityForAssets([assetId], fetchedAt, options)
}

function validateProximity(data: ProximityResult, ids: readonly string[]) {
  if (!data || !['success', 'empty', 'partial', 'blocked', 'unavailable'].includes(data.state) || data.riskConfirmed !== false || data.targetsAreReferenceData !== true || data.policy?.id !== 'legacy-panel-assets-600-nearest' || !Number.isFinite(data.evaluatedPairCount) || data.evaluatedPairCount < 0 || !Number.isFinite(Date.parse(data.analyzedAt)) || !Array.isArray(data.matches) || !Array.isArray(data.skipped) || !Array.isArray(data.warnings) || data.warnings.some(w => typeof w !== 'string') || data.skipped.some(s => typeof s?.eventId !== 'string' || typeof s.reason !== 'string') || data.matches.some(m => !m || !Number.isFinite(m.distanceKm) || m.distanceKm < 0 || m.distanceKm >= 600 || !ids.includes(m.asset?.id) || m.event?.source !== 'NASA EONET' || typeof m.event.title !== 'string' || !Array.isArray(m.event.categories) || m.event.categories.some(c => typeof c?.title !== 'string') || (m.event.observedAt !== null && !Number.isFinite(Date.parse(m.event.observedAt))) || !Number.isFinite(m.event.coordinates?.latitude) || !Number.isFinite(m.event.coordinates?.longitude))) throw new Error('Resposta de triagem inválida.')
  if (new Set(data.matches.map(m => m.asset.id)).size !== data.matches.length) throw new Error('Correspondências duplicadas por ativo.')
}

export function sameSnapshot(left: string | null, right: string | null) {
  if (!left || !right || !Number.isFinite(Date.parse(left)) || !Number.isFinite(Date.parse(right))) return false
  // Pydantic serializes UTC as Z in /events and +00:00 in proximity.
  // Keep sub-millisecond precision while comparing equivalent timezone encodings.
  const remainder = (value: string) => (value.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? '').padEnd(9, '0').slice(3)
  return Date.parse(left) === Date.parse(right) && remainder(left) === remainder(right)
}

export async function getProximityForAssets(assetIds: readonly string[], fetchedAt: string, options?: Options): Promise<ProximityResult> {
  if (!assetIds.length || assetIds.length > 11 || assetIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(assetIds).size !== assetIds.length || !Number.isFinite(Date.parse(fetchedAt))) throw new Error('Identificadores ou horário de consulta inválidos.')
  const data = await geographyRequest('geography/proximity', { targetIds: [...assetIds], expectedFetchedAt: fetchedAt, policyId: 'legacy-panel-assets-600-nearest' }, options) as ProximityResult
  validateProximity(data, assetIds)
  if (data.isSimulation !== false || data.requiresHumanConfirmation !== true || typeof data.datasetVersion !== 'string' || !data.datasetVersion) throw new Error('Origem ou versão da triagem inválida.')
  if (data.policy.radiusKm !== 600 || data.policy.selection !== 'nearest_per_target' || ((data.state === 'success' || data.state === 'empty' || data.state === 'partial') && !sameSnapshot(data.eventsFetchedAt, fetchedAt)) || ((data.state === 'empty' || data.state === 'blocked' || data.state === 'unavailable') && data.matches.length) || data.matches.some(m => !m.event.id || m.event.isSimulation !== false || m.asset.isReferenceData !== true || !Number.isFinite(m.asset.coordinates?.latitude) || Math.abs(m.asset.coordinates.latitude) > 90 || !Number.isFinite(m.asset.coordinates?.longitude) || Math.abs(m.asset.coordinates.longitude) > 180 || Math.abs(m.event.coordinates!.latitude) > 90 || Math.abs(m.event.coordinates!.longitude) > 180 || typeof m.geometryApproximate !== 'boolean')) throw new Error('Contexto de triagem incompatível com a consulta.')
  return data
}
