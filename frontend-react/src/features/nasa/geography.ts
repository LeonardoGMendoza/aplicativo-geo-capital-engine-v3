import Supercluster from 'supercluster'
import type { NasaEvent } from './contracts'

export const categories = [
  { id: 'wildfires', label: 'Incêndios', color: '#c2410c', symbol: 'I' },
  { id: 'severeStorms', label: 'Tempestades severas', color: '#0f766e', symbol: 'T' },
  { id: 'earthquakes', label: 'Terremotos', color: '#7e22ce', symbol: 'S' },
  { id: 'floods', label: 'Inundações', color: '#0369a1', symbol: 'A' },
] as const
export function categoryStyle(event: NasaEvent) {
  return categories.find(category => event.categories.some(item => item.id === category.id)) ?? { id: 'other', label: 'Outra categoria', color: '#475569', symbol: '?' }
}
export function validCoordinates(event: NasaEvent) {
  const point = event.coordinates
  return event.coordinateState === 'available' && !!point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
}
export function mapPosition(event: NasaEvent): [number, number] | null {
  // OSM uses Web Mercator: do not invent a projected location for polar events.
  return validCoordinates(event) && Math.abs(event.coordinates!.latitude) <= 85.0511287798
    ? [event.coordinates!.latitude, event.coordinates!.longitude] : null
}
const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
export function filterEvents(events: NasaEvent[], category: string, search: string) {
  const query = fold(search.trim())
  return events.filter(event => (category === 'all' || event.categories.some(item => item.id === category))
    && fold(event.title).includes(query))
}
export const PAGE_SIZE = 25
export function pageForEvent(events: NasaEvent[], id: string) {
  return Math.max(0, Math.floor(events.findIndex(event => event.id === id) / PAGE_SIZE))
}
export function createClusterIndex(events: NasaEvent[]) {
  return new Supercluster<{ event: NasaEvent }>({ radius: 50, maxZoom: 16 }).load(events.flatMap(event => {
    const position = mapPosition(event)
    return position ? [{ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [position[1], position[0]] }, properties: { event } }] : []
  }))
}
export function observationLabel(event: NasaEvent) {
  return event.observationState === 'outdated' ? 'Observação antiga' : event.observationState === 'unknown' ? 'Horário desconhecido' : 'Observação recente'
}
export function formatObservation(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) + ' · Brasília' : 'Não informado'
}
