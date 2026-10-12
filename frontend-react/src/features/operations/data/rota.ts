import type { Coordinates } from '@/features/shelters/places'

export type Rota = { pontos: [number, number][]; km: number; minutos: number | null; calculada: boolean }

const OSRM = 'https://router.project-osrm.org/route/v1/driving'

/** Linha reta (quando o serviço de rotas não responde): só desenho, sem tempo. */
export function linhaReta(a: Coordinates, b: Coordinates): Rota {
  const r = Math.PI / 180
  const h = Math.sin((b.latitude - a.latitude) * r / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin((b.longitude - a.longitude) * r / 2) ** 2
  return { pontos: [[a.latitude, a.longitude], [b.latitude, b.longitude]], km: 12742 * Math.asin(Math.sqrt(h)), minutos: null, calculada: false }
}

/** Rota real pelas ruas do OpenStreetMap (OSRM, público e sem chave). Se falhar, devolve a linha reta. */
export async function buscarRota(a: Coordinates, b: Coordinates, { signal }: { signal?: AbortSignal } = {}): Promise<Rota> {
  const url = `${OSRM}/${a.longitude.toFixed(6)},${a.latitude.toFixed(6)};${b.longitude.toFixed(6)},${b.latitude.toFixed(6)}?overview=full&geometries=geojson`
  try {
    const resp = await fetch(url, { signal })
    if (!resp.ok) throw new Error(String(resp.status))
    const data = await resp.json() as { code?: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] }
    const rota = data.code === 'Ok' ? data.routes?.[0] : undefined
    if (!rota || !Array.isArray(rota.geometry?.coordinates) || rota.geometry.coordinates.length < 2) throw new Error('sem rota')
    return { pontos: rota.geometry.coordinates.map(([lon, lat]) => [lat, lon]), km: rota.distance / 1000, minutos: Math.max(1, Math.round(rota.duration / 60)), calculada: true }
  } catch (e) {
    if (signal?.aborted) throw e
    return linhaReta(a, b)
  }
}

/** Barra verde da lista: quanto mais perto, mais cheia (0,08 a 1). */
export function proximidade(km: number, maxKm: number) {
  if (!(maxKm > 0)) return 1
  return Math.min(1, Math.max(0.08, 1 - km / (maxKm * 1.15)))
}
