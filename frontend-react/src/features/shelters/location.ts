import type { SupportPoint } from './reference'
export type Origin = { latitude: number; longitude: number }
export function parseOrigin(latitude: string, longitude: string): Origin | null {
  if (!latitude.trim() || !longitude.trim()) return null
  const lat = Number(latitude.trim().replace(',', '.')), lon = Number(longitude.trim().replace(',', '.'))
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { latitude: lat, longitude: lon } : null
}
export function haversine(a: Origin, b: Origin) {
  const rad = (v: number) => v * Math.PI / 180
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))))
}
export function orderPoints(points: SupportPoint[], origin: Origin | null, byDistance: boolean) {
  return [...points].sort((a, b) => origin && byDistance ? haversine(origin, a) - haversine(origin, b) || a.id.localeCompare(b.id) : a.name.localeCompare(b.name, 'pt-BR'))
}
export function distanceLabel(origin: Origin | null, point: SupportPoint) { return origin ? `Distância em linha reta: ${haversine(origin, point).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km` : 'Distância não calculada' }
export function destinationLinks(p: Origin) {
  const coordinates = `${p.latitude},${p.longitude}`
  return { google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`, waze: `https://waze.com/ul?ll=${encodeURIComponent(coordinates)}&z=17` }
}
