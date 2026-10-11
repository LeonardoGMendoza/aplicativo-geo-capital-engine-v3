import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlaceClusterIndex, CLUSTER_MAX_ZOOM } from '../src/features/shelters/placesCluster.ts'

const place = (id, latitude, longitude) => ({ id, name: id, category: 'pharmacy', categoryLabel: 'Farmácia', coordinates: { latitude, longitude }, distanceKm: 0.1, address: null, osmUrl: `https://www.openstreetmap.org/${id}` })
// 30 farmácias num quarteirão do centro de SP e 1 isolada a ~5 km
const dense = Array.from({ length: 30 }, (_, i) => place(`node/${i}`, -23.5505 + i * 0.0001, -46.6333 + i * 0.0001))
const far = place('node/far', -23.59, -46.68)
const world = [-180, -85, 180, 85]

test('dense places group into one cluster at city zoom and keep isolated places separate', () => {
  const index = createPlaceClusterIndex([...dense, far])
  const features = index.getClusters(world, 13)
  const clusters = features.filter(f => f.properties.cluster)
  assert.equal(clusters.length, 1)
  assert.equal(clusters[0].properties.point_count, 30)
  assert.ok(features.some(f => !f.properties.cluster && f.properties.place.id === 'node/far'))
})

test('every place becomes an individual marker above the cluster max zoom, with lon/lat order', () => {
  const index = createPlaceClusterIndex([...dense, far])
  const features = index.getClusters(world, CLUSTER_MAX_ZOOM + 1)
  assert.equal(features.length, 31)
  assert.ok(features.every(f => !f.properties.cluster))
  const f = features.find(f => f.properties.place.id === 'node/far')
  // a biblioteca projeta e desprojeta (Mercator): sobra erro de ponto flutuante na casa de 1e-12
  const [lon, lat] = f.geometry.coordinates
  assert.ok(Math.abs(lon - -46.68) < 1e-9 && Math.abs(lat - -23.59) < 1e-9, `ordem lon/lat: ${lon}, ${lat}`)
})

test('cluster expansion zoom zooms in and empty input is valid', () => {
  const index = createPlaceClusterIndex(dense)
  const [cluster] = index.getClusters(world, 13)
  assert.ok(index.getClusterExpansionZoom(cluster.properties.cluster_id) > 13)
  assert.deepEqual(createPlaceClusterIndex([]).getClusters(world, 10), [])
})
