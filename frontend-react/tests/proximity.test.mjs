import test from 'node:test'
import assert from 'node:assert/strict'
import { getAssets, getProximity } from '../src/features/nasa/proximity.ts'
const baseUrl = 'http://fixture-api.test'
const asset = { id: 'mvp-test', name: 'Ativo de teste', coordinates: { latitude: 0, longitude: 0 }, isReferenceData: true }
const policy = { id: 'legacy-panel-assets-600-nearest', radiusKm: 600, selection: 'nearest_per_target' }
const timestamp = '2026-10-09T12:00:00Z'
const result = { eventsFetchedAt: timestamp, source: 'NASA EONET', isSimulation: false, requiresHumanConfirmation: true, datasetVersion: 'fixture-v1', state: 'empty', policy, riskConfirmed: false, targetsAreReferenceData: true, evaluatedPairCount: 1, analyzedAt: '2026-10-09T12:00:00Z', matches: [], skipped: [], warnings: [] }
const fixture = (data, status = 200) => async () => new Response(JSON.stringify(data), { status })
test('asset catalog rejects invented operational status or invalid coordinates', async () => {
  assert.equal((await getAssets({ baseUrl, fetcher: fixture({ assets: [asset], policy }) })).assets[0].id, asset.id)
  for (const a of [{ ...asset, isReferenceData: false }, { ...asset, coordinates: { latitude: 999, longitude: 0 } }]) await assert.rejects(getAssets({ baseUrl, fetcher: fixture({ assets: [a], policy }) }))
})
test('proximity posts only selected catalog ID and query timestamp to backend', async () => {
  await getProximity(asset.id, '2026-10-09T12:00:00Z', { baseUrl, fetcher: async (url, options) => {
    assert.equal(url, baseUrl + '/api/v1/geography/proximity')
    assert.equal(options.method, 'POST')
    const body = JSON.parse(options.body)
    assert.deepEqual(body.targetIds, [asset.id])
    assert.equal(body.expectedFetchedAt, '2026-10-09T12:00:00Z')
    assert.equal(body.policyId, policy.id)
    assert.equal(body.radiusKm, undefined)
    return fixture(result)()
  } })
})
test('valid empty, incomplete, blocked and unavailable remain distinct', async () => {
  for (const [state, status] of [['empty',200],['partial',200],['blocked',409],['unavailable',503]]) assert.equal((await getProximity(asset.id,timestamp,{baseUrl,fetcher:fixture({...result,state},status)})).state,state)
  await assert.rejects(getProximity(asset.id,timestamp,{baseUrl,fetcher:fixture({},503)}))
  await assert.rejects(getProximity(asset.id,timestamp,{baseUrl,fetcher:async()=>{throw new Error('offline')}}))
})
test('malformed screening or confirmed risk is rejected', async () => {
  for (const bad of [{ ...result, riskConfirmed: true }, { ...result, matches: [{ distanceKm: -1 }] }, { ...result, policy: { id: 'new-risk-policy' } }]) await assert.rejects(getProximity(asset.id,timestamp,{baseUrl,fetcher:fixture(bad)}))
})
