import test from 'node:test'
import assert from 'node:assert/strict'
import { getAssets, getProximityForAssets, GeographyApiError, sameSnapshot } from '../src/features/nasa/proximity.ts'
import { createScreeningGate, assetStatus, completed, visibleAssets } from '../src/features/corporate/screening.ts'
const timestamp = '2026-10-09T12:00:00Z'
const asset = id => ({ id, name: id, coordinates: { latitude: 0, longitude: 0 }, isReferenceData: true })
const ids = Array.from({ length: 11 }, (_, i) => `asset-${i}`)
const event = { id: 'shared-event', title: 'Evento fixture', source: 'NASA EONET', isSimulation: false, categories: [], observedAt: timestamp, coordinates: { latitude: 0, longitude: 0 } }
const match = (id, distanceKm = 10) => ({ asset: asset(id), event, distanceKm, geometryApproximate: false })
const result = { state: 'success', policy: { id: 'legacy-panel-assets-600-nearest', radiusKm: 600, selection: 'nearest_per_target' }, eventsFetchedAt: timestamp, analyzedAt: timestamp, evaluatedPairCount: 11, riskConfirmed: false, targetsAreReferenceData: true, isSimulation: false, requiresHumanConfirmation: true, datasetVersion: 'fixture-v1', matches: [], skipped: [], warnings: [] }
const options = (data, status = 200) => ({ baseUrl: 'http://fixture.test', fetcher: async () => new Response(JSON.stringify(data), { status }) })

test('one batch request posts all 11 unique IDs and the exact NASA context', async () => {
  let calls = 0
  await getProximityForAssets(ids, timestamp, { baseUrl: 'http://fixture.test', fetcher: async (url, request) => {
    calls++
    assert.equal(url, 'http://fixture.test/api/v1/geography/proximity')
    assert.equal(request.method, 'POST')
    assert.deepEqual(JSON.parse(request.body), { targetIds: ids, expectedFetchedAt: timestamp, policyId: result.policy.id })
    return new Response(JSON.stringify(result))
  } })
  assert.equal(calls, 1)
})
test('duplicate, empty and oversized batches fail before fetching', async () => {
  for (const input of [[], ['a', 'a'], [''], [...ids, 'extra']]) await assert.rejects(getProximityForAssets(input, timestamp, { fetcher: () => { throw new Error('Should not fetch') } }), /Identificadores/)
})
test('unexpected IDs and duplicate matches per asset are rejected', async () => {
  for (const matches of [[match('other')], [match(ids[0]), match(ids[0])]]) await assert.rejects(getProximityForAssets(ids, timestamp, options({ ...result, matches })))
})
test('one event can match several assets and response order need not match request', async () => {
  const matches = [match(ids[8]), match(ids[0])]
  assert.deepEqual((await getProximityForAssets(ids, timestamp, options({ ...result, matches }))).matches, matches)
})
test('distance is strictly less than 600 km, with no rounding-based eligibility', async () => {
  for (const distance of [0, 599.999]) assert.equal((await getProximityForAssets(ids, timestamp, options({ ...result, matches: [match(ids[0], distance)] }))).matches[0].distanceKm, distance)
  for (const distance of [-1, 600, 601]) await assert.rejects(getProximityForAssets(ids, timestamp, options({ ...result, matches: [match(ids[0], distance)] })))
})
test('partial results preserve matches, omissions and warnings', async () => {
  const data = { ...result, state: 'partial', matches: [match(ids[0])], skipped: [{ eventId: 'missing', reason: 'missing' }], warnings: ['Observação antiga'] }
  assert.deepEqual(await getProximityForAssets(ids, timestamp, options(data)), data)
  assert.match(assetStatus(data, ids[0]), /Correspondência encontrada.*parcial/)
  assert.match(assetStatus(data, ids[1]), /eventos utilizáveis.*parcial/)
})
test('simulation, operational assets and malformed geographic matches are rejected', async () => {
  const valid = match(ids[0])
  for (const data of [{ ...result, isSimulation: true }, { ...result, matches: [{ ...valid, event: { ...event, isSimulation: true } }] }, { ...result, matches: [{ ...valid, asset: { ...valid.asset, isReferenceData: false } }] }, { ...result, matches: [{ ...valid, geometryApproximate: undefined }] }]) await assert.rejects(getProximityForAssets(ids, timestamp, options(data)))
})
test('409 and 503 envelopes remain blocked and unavailable, while 422 and network fail', async () => {
  for (const [state, code] of [['blocked', 409], ['unavailable', 503]]) {
    const data = await getProximityForAssets(ids, timestamp, options({ ...result, state }, code))
    assert.equal(data.state, state); assert.equal(completed(data), false)
  }
  await assert.rejects(getProximityForAssets(ids, timestamp, options({ detail: 'Unknown asset identifier' }, 422)), error => error instanceof GeographyApiError && error.status === 422)
  await assert.rejects(getProximityForAssets(ids, timestamp, { fetcher: async () => { throw new Error('offline') } }), /offline/)
})
test('a completed response from a different NASA snapshot is rejected', async () => {
  await assert.rejects(getProximityForAssets(ids, timestamp, options({ ...result, eventsFetchedAt: '2026-10-09T13:00:00Z' })), /Contexto/)
})
test('equivalent timezone encodings preserve snapshot identity and microseconds', async () => {
  assert.equal(sameSnapshot('2026-10-09T16:57:25.668482Z', '2026-10-09T13:57:25.668482-03:00'), true)
  assert.equal(sameSnapshot('2026-10-09T16:57:25.668482Z', '2026-10-09T16:57:25.668483+00:00'), false)
  assert.equal((await getProximityForAssets(ids, timestamp, options({ ...result, eventsFetchedAt: '2026-10-09T12:00:00+00:00' }))).state, 'success')
})
test('catalog duplicate IDs are rejected', async () => {
  await assert.rejects(getAssets(options({ assets: [asset('a'), asset('a')], policy: result.policy })), /Catálogo/)
})
test('old async responses cannot commit after invalidation or a newer request', async () => {
  const gate = createScreeningGate()
  let release
  const deferred = new Promise(resolve => { release = resolve })
  const old = gate.begin()
  let committed = false
  const pending = deferred.then(() => { if (gate.accepts(old)) committed = true })
  gate.invalidate(); release(); await pending
  assert.equal(committed, false)
  const first = gate.begin(); const second = gate.begin()
  assert.equal(gate.accepts(first), false); assert.equal(gate.accepts(second), true)
})
test('unconsulted, querying, complete, partial and failed statuses are distinct', () => {
  assert.equal(assetStatus(null, 'a'), 'Não consultado')
  assert.equal(assetStatus(null, 'a', true), 'Consultando')
  assert.equal(assetStatus(null, 'a', false, true), 'Triagem indisponível')
  assert.match(assetStatus({ ...result, state: 'empty' }, 'a'), /consulta completa/)
  assert.equal(completed(null), false)
})
test('search and sorting preserve ID associations without mutating catalog', () => {
  const assets = [asset('Z'), asset('A'), asset('B')]
  const data = { ...result, matches: [match('B', 20), match('Z', 10)] }
  assert.deepEqual(visibleAssets(assets, '', 'distance', data).map(a => a.id), ['Z', 'B', 'A'])
  assert.deepEqual(visibleAssets(assets, 'a', 'name', data).map(a => a.id), ['A'])
  assert.deepEqual(assets.map(a => a.id), ['Z', 'A', 'B'])
})
