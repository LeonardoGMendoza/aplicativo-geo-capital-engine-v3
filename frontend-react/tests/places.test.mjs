import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { categoryMeta, categoryOrder, filterPlaces, formatDistance, geocode, getNearbyPlaces, nearestOf, quickCities, routeLinks, validNearby } from '../src/features/shelters/places.ts'

const baseUrl = 'http://fixture-api.test'
const place = (id, category, distanceKm, extra = {}) => ({ id, name: `Local ${id}`, category, categoryLabel: categoryMeta[category].label, coordinates: { latitude: -23.55, longitude: -46.63 }, distanceKm, address: null, osmUrl: `https://www.openstreetmap.org/${id}`, ...extra })
const items = [place('node/1', 'hospital', 2.4), place('node/2', 'hospital', 0.8), place('node/3', 'pharmacy', 0.3), place('way/4', 'shelter', 1.2, { shelterKind: 'possible', note: 'confirmar' })]
const nearby = { state: 'success', source: 'OpenStreetMap (Overpass API)', sourceUrl: 'https://overpass-api.de/api/interpreter', queriedAt: '2026-10-10T21:00:00Z', fetchedAt: '2026-10-10T21:00:00Z', isSimulation: false, riskCalculated: false, origin: { latitude: -23.551, longitude: -46.633 }, radiusKm: 3, categories: categoryOrder.map(id => ({ id, label: categoryMeta[id].label, count: items.filter(p => p.category === id).length })), items, notice: 'Não confirma funcionamento', attribution: '© OSM' }
const fixture = (data, status = 200, seen = []) => async (url, options) => { seen.push({ url, options }); return new Response(JSON.stringify(data), { status }) }

test('nearby calls the project API with origin coordinates only', async () => {
  const seen = []
  const result = await getNearbyPlaces({ latitude: -23.5505, longitude: -46.6333 }, { baseUrl: baseUrl + '/', fetcher: fixture(nearby, 200, seen) })
  assert.equal(result.items.length, 4)
  const url = new URL(seen[0].url)
  assert.equal(url.origin + url.pathname, baseUrl + '/api/v1/places/nearby')
  assert.deepEqual([...url.searchParams.keys()], ['lat', 'lon'])
  assert.equal(seen[0].options.method, undefined)
})

test('nearby rejects simulated, risk-calculated, malformed or inconsistent payloads', async () => {
  for (const bad of [{ ...nearby, isSimulation: true }, { ...nearby, riskCalculated: true }, { ...nearby, state: 'empty' },
    { ...nearby, items: [{ ...items[0], category: 'airport' }] }, { ...nearby, items: [{ ...items[0], coordinates: { latitude: 99, longitude: 0 } }] },
    { ...nearby, items: [{ ...items[0], osmUrl: 'javascript:alert(1)' }] }, { ...nearby, fetchedAt: 'ontem' }]) {
    assert.equal(validNearby(bad), false)
    await assert.rejects(getNearbyPlaces({ latitude: 0, longitude: 0 }, { baseUrl, fetcher: fixture(bad) }))
  }
  assert.equal(validNearby({ ...nearby, state: 'empty', items: [] }), true)
  assert.equal(validNearby({ ...nearby, state: 'stale' }), true)
})

test('API failures become readable messages and invalid origin never calls the API', async () => {
  await assert.rejects(getNearbyPlaces({ latitude: 0, longitude: 0 }, { baseUrl, fetcher: fixture({ state: 'unavailable' }, 503) }), /OpenStreetMap indisponível/)
  await assert.rejects(getNearbyPlaces({ latitude: 0, longitude: 0 }, { baseUrl, fetcher: fixture({}, 500) }), /Verifique se a API está rodando/)
  let calls = 0
  await assert.rejects(getNearbyPlaces({ latitude: 91, longitude: 0 }, { baseUrl, fetcher: async () => { calls++; throw new Error('x') } }))
  await assert.rejects(geocode(' a ', { baseUrl, fetcher: async () => { calls++; throw new Error('x') } }), /ao menos 2 letras/)
  assert.equal(calls, 0)
})

test('geocode normalizes the text and drops invalid coordinates', async () => {
  const seen = []
  const data = { state: 'success', items: [{ name: 'Canoas', displayName: 'Canoas, RS, Brasil', coordinates: { latitude: -29.9, longitude: -51.18 } }, { name: 'X', coordinates: { latitude: 200, longitude: 0 } }] }
  const result = await geocode('  canoas    rs ', { baseUrl, fetcher: fixture(data, 200, seen) })
  assert.equal(new URL(seen[0].url).searchParams.get('q'), 'canoas rs')
  assert.deepEqual(result.map(r => r.name), ['Canoas'])
  assert.deepEqual(await geocode('lugar nenhum', { baseUrl, fetcher: fixture({ state: 'empty', items: [] }) }), [])
})

test('route links open navigation from the device location without sending the user origin', () => {
  const links = routeLinks({ latitude: -30.03, longitude: -51.22 })
  const google = new URL(links.google), waze = new URL(links.waze)
  assert.equal(google.searchParams.get('destination'), '-30.03,-51.22')
  assert.equal(google.searchParams.has('origin'), false)
  assert.equal(waze.searchParams.get('ll'), '-30.03,-51.22')
  assert.equal(waze.searchParams.get('navigate'), 'yes')
  assert.equal(waze.searchParams.has('from'), false)
})

test('nearest, filters and distance labels', () => {
  assert.equal(nearestOf(items, 'hospital').id, 'node/2')
  assert.equal(nearestOf(items, 'police'), undefined)
  assert.deepEqual(filterPlaces(items, new Set(['hospital', 'pharmacy'])).map(p => p.id), ['node/3', 'node/2', 'node/1'])
  assert.equal(formatDistance(0.3456), '346 m')
  assert.equal(formatDistance(12.34), '12,3 km')
})

test('nine categories match the Streamlit map and quick cities keep the case study', () => {
  assert.deepEqual(categoryOrder, ['shelter', 'hospital', 'clinic', 'police', 'ngo', 'food', 'pharmacy', 'lodging', 'shop'])
  assert.deepEqual(quickCities.map(c => c.name), ['São Paulo/SP', 'São Sebastião/SP', 'Porto Alegre/RS', 'Lajeado/RS', 'Macaé/RJ'])
})

test('nearby section copy keeps explicit limits and opt-in location', () => {
  const section = readFileSync(new URL('../src/features/shelters/NearbyPlaces.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(section, /Rota segura|Abrigo disponível|100% preparado|Resgate acionado/i)
  assert.match(section, /só é usada quando você clica/)
  assert.match(section, /não confirma que o local está aberto/)
  assert.match(section, /Isso não significa ausência de apoio na região/)
  // geolocalização só dentro do clique no botão, nunca ao carregar a página
  assert.doesNotMatch(section, /useEffect\([^)]*geolocation/s)
})
