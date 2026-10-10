import test from 'node:test'
import assert from 'node:assert/strict'
import { getEvents, getApiStatus } from '../src/features/nasa/client.ts'

const baseUrl = 'http://api.test'
const event = { id: 'fixture', title: 'Evento de teste', categories: [{ id: 'floods', title: 'Floods' }], coordinates: null, geometryType: null, coordinateState: 'missing', observedAt: null, observationState: 'unknown', source: 'NASA EONET', isSimulation: false }
const envelope = { state: 'success', source: 'NASA EONET', sourceUrl: 'https://eonet.gsfc.nasa.gov/api/v3/events', query: { status: 'open', category: 'floods' }, queriedAt: '2026-10-09T12:00:00Z', fetchedAt: '2026-10-09T12:00:00Z', ageSeconds: 0, cache: 'miss', dataQuality: 'partial', events: [event], error: null, isSimulation: false, riskCalculated: false }
function fixture(data, status = 200) { return async () => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }) }

test('typed client keeps partial events and requests only backend', async () => {
  const data = await getEvents({ baseUrl: baseUrl + '/', fetcher: async (url, options) => {
    assert.equal(url, baseUrl + '/api/v1/events')
    assert.equal(options.cache, 'no-store')
    assert.ok(options.signal)
    return fixture(envelope)()
  } })
  assert.equal(data.events[0].coordinates, null)
  assert.equal(data.dataQuality, 'partial')
})
test('empty success remains distinct from integration failure', async () => {
  const data = await getEvents({ baseUrl, fetcher: fixture({ ...envelope, state: 'empty', events: [] }) })
  assert.equal(data.state, 'empty')
  for (const [status, state] of [[502, 'error'], [503, 'unavailable']]) {
    const errorData = await getEvents({ baseUrl, fetcher: fixture({ ...envelope, state, events: [], error: { code: 'fixture', message: 'Falha de teste' } }, status) })
    assert.equal(errorData.state, state)
  }
})
test('stale response and empty stale data keep their status', async () => {
  for (const events of [[event], []]) {
    const data = await getEvents({ baseUrl, fetcher: fixture({ ...envelope, state: 'stale', cache: 'stale', events }) })
    assert.equal(data.state, 'stale')
  }
})
test('malformed API bodies are not treated as absence of risk', async () => {
  for (const data of [{}, { ...envelope, state: 'empty' }, { ...envelope, query: null }]) {
    await assert.rejects(getEvents({ baseUrl, fetcher: fixture(data) }), /inválida/)
  }
  await assert.rejects(getEvents({ baseUrl, fetcher: async () => new Response('invalid json') }))
})
test('invalid coordinates preserve the event as partial without contaminating the map', async () => {
  const data = await getEvents({ baseUrl, fetcher: fixture({ ...envelope, events: [{ ...event, coordinateState: 'available', coordinates: { latitude: 100, longitude: 1, method: 'point' } }] }) })
  assert.equal(data.events.length, 1)
  assert.equal(data.events[0].coordinates, null)
  assert.equal(data.events[0].coordinateState, 'invalid')
  assert.equal(data.dataQuality, 'partial')
})
test('network and timeout reject instead of creating an empty result', async () => {
  for (const error of [new TypeError('offline'), new DOMException('timeout', 'TimeoutError')]) {
    await assert.rejects(getEvents({ baseUrl, fetcher: async () => { throw error } }))
  }
})
test('unexpected HTTP error is rejected', async () => {
  await assert.rejects(getEvents({ baseUrl, fetcher: fixture(envelope, 500) }), /Falha HTTP/)
})
test('status endpoint is typed and independent of event request', async () => {
  const data = { status: 'ok', nasa: { enabled: true, state: 'unavailable', source: 'NASA EONET', fetchedAt: null, ageSeconds: null, error: null }, riskCalculated: false }
  assert.equal((await getApiStatus({ baseUrl, fetcher: fixture(data) })).nasa.state, 'unavailable')
})
