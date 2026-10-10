import test from 'node:test'
import assert from 'node:assert/strict'
import { categoryStyle, createClusterIndex, filterEvents, mapPosition, observationLabel, validCoordinates, pageForEvent, PAGE_SIZE } from '../src/features/nasa/geography.ts'

const makeEvent = (id, category = 'floods', latitude = -29.9, longitude = -51.3) => ({ id, title: `Inundação ${id}`, categories: [{ id: category, title: category }], coordinates: { latitude, longitude, method: 'point' }, geometryType: 'Point', coordinateState: 'available', observedAt: '2026-10-09T00:00:00Z', observationState: 'recent', source: 'NASA EONET', isSimulation: false })
test('category filter includes all categories of multi-category events', () => {
  const flood = makeEvent('1'); flood.categories.push({ id: 'severeStorms', title: 'Storm' })
  const fire = makeEvent('2', 'wildfires')
  assert.deepEqual(filterEvents([flood, fire], 'severeStorms', '').map(e => e.id), ['1'])
  assert.equal(filterEvents([flood, fire], 'all', '').length, 2)
})
test('name search ignores case, whitespace and accents and combines with category', () => {
  const events = [makeEvent('1'), makeEvent('2', 'wildfires')]
  assert.equal(filterEvents(events, 'floods', ' INUNDACAO ').length, 1)
  assert.equal(filterEvents(events, 'all', 'missing').length, 0)
})
test('selection position keeps latitude longitude order and does not create coordinates', () => {
  assert.deepEqual(mapPosition(makeEvent('1')), [-29.9, -51.3])
  for (const coordinates of [null, { latitude: NaN, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: 181 }, { latitude: '1', longitude: 0 }]) {
    assert.equal(mapPosition({ ...makeEvent('2'), coordinates }), null)
  }
  assert.equal(mapPosition({ ...makeEvent('3'), coordinateState: 'invalid' }), null)
})
test('polar locations stay valid geographically but are not moved to invented Mercator positions', () => {
  const pole = makeEvent('polar', 'earthquakes', 89, 0)
  assert.equal(validCoordinates(pole), true)
  assert.equal(mapPosition(pole), null)
})
test('categories have distinct colors and symbols; unknown category has neutral fallback', () => {
  const styles = ['wildfires', 'severeStorms', 'earthquakes', 'floods'].map(c => categoryStyle(makeEvent(c, c)))
  assert.equal(new Set(styles.map(s => s.color)).size, 4)
  assert.equal(new Set(styles.map(s => s.symbol)).size, 4)
  assert.equal(categoryStyle(makeEvent('x', 'other')).id, 'other')
})
test('old and unknown observations remain separate from recent', () => {
  assert.equal(observationLabel(makeEvent('1')), 'Observação recente')
  assert.equal(observationLabel({ ...makeEvent('1'), observationState: 'outdated' }), 'Observação antiga')
  assert.equal(observationLabel({ ...makeEvent('1'), observationState: 'unknown' }), 'Horário desconhecido')
})
test('dense locations cluster and expand; missing coordinates never enter clusters', () => {
  const events = Array.from({ length: 100 }, (_, i) => makeEvent(`${i}`, 'wildfires', -29.9 + i / 10000, -51.3))
  events.push({ ...makeEvent('missing'), coordinates: null, coordinateState: 'missing' })
  const index = createClusterIndex(events)
  const clusters = index.getClusters([-180, -85, 180, 85], 2)
  assert.equal(clusters.length, 1)
  assert.equal(clusters[0].properties.point_count, 100)
  assert.ok(index.getClusterExpansionZoom(clusters[0].properties.cluster_id) > 2)
  assert.equal(index.getLeaves(clusters[0].properties.cluster_id, Infinity).length, 100)
  assert.equal(index.getClusters([-180, -85, 180, 85], 18).length, 100)
})
test('no valid locations produces a valid empty cluster index', () => {
  assert.deepEqual(createClusterIndex([{ ...makeEvent('1'), coordinates: null }]).getClusters([-180, -85, 180, 85], 2), [])
})
test('marker selection locates its list page even in a large catalog', () => {
  const events = Array.from({ length: 7144 }, (_, i) => makeEvent(String(i)))
  assert.equal(pageForEvent(events, '0'), 0)
  assert.equal(pageForEvent(events, String(PAGE_SIZE)), 1)
  assert.equal(pageForEvent(events, '7143'), 285)
  assert.equal(pageForEvent(events, 'unknown'), 0)
})
