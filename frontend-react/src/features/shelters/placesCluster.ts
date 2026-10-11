import Supercluster from 'supercluster'
import type { Place } from './places'

// Mesmo agrupamento do Mapa NASA (features/nasa/geography.ts): raio 50 px, separa tudo a partir do zoom 17.
export const CLUSTER_MAX_ZOOM = 16
export function createPlaceClusterIndex(places: Place[]) {
  return new Supercluster<{ place: Place }>({ radius: 50, maxZoom: CLUSTER_MAX_ZOOM }).load(places.map(place => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [place.coordinates.longitude, place.coordinates.latitude] },
    properties: { place },
  })))
}
