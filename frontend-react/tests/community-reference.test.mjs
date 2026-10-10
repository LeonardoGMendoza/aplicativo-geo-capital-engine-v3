import test from 'node:test'
import assert from 'node:assert/strict'
import { communityDescription, searchReferences, selectReference } from '../src/features/community/reference.ts'
import { createScreeningGate, assetStatus } from '../src/features/corporate/screening.ts'
import { getProximityForAssets } from '../src/features/nasa/proximity.ts'
const assets = [{ id: 'a', name: 'Ativo Norte', communityDescription: 'Pescadores do litoral' }, { id: 'b', name: 'Ativo Sul', communityDescription: 'Pescadores do litoral' }, { id: 'c', name: 'Fábrica', communityDescription: null }]

test('community descriptions follow asset IDs across reordering', () => {
  assert.equal(selectReference([...assets].reverse(), 'b'), assets[1])
  assert.equal(selectReference(assets, 'unknown'), undefined)
  assert.equal(selectReference(assets, null), undefined)
})
test('community and asset search ignores accents, whitespace and case', () => {
  assert.deepEqual(searchReferences(assets, ' PESCADORES ').map(a => a.id), ['a', 'b'])
  assert.deepEqual(searchReferences(assets, 'sul').map(a => a.id), ['b'])
  assert.deepEqual(searchReferences(assets, 'fabrica').map(a => a.id), ['c'])
  assert.deepEqual(searchReferences(assets, 'absent'), [])
})
test('repeated descriptions remain separate asset references', () => {
  assert.equal(searchReferences(assets, 'litoral').length, 2)
  assert.equal(selectReference(assets, 'a').name, 'Ativo Norte')
  assert.equal(selectReference(assets, 'b').name, 'Ativo Sul')
})
test('missing descriptions are handled without creating community data', () => {
  for (const value of [null, undefined, '', '   ', 123]) assert.equal(communityDescription({ communityDescription: value }), 'Descrição comunitária não informada')
  assert.equal(assets[2].communityDescription, null)
})
test('switching the selected asset prevents an earlier async response from committing', async () => {
  const gate = createScreeningGate()
  const commits = []
  let finishOld
  const old = gate.begin()
  const pending = new Promise(resolve => { finishOld = resolve }).then(() => { if (gate.accepts(old)) commits.push('a') })
  gate.invalidate()
  const latest = gate.begin()
  if (gate.accepts(latest)) commits.push('b')
  finishOld(); await pending
  assert.deepEqual(commits, ['b'])
})
test('NASA refresh invalidates outstanding generation until another consultation', () => {
  const gate = createScreeningGate()
  const ticket = gate.begin(); gate.invalidate()
  assert.equal(gate.accepts(ticket), false)
  assert.equal(assetStatus(null, 'a'), 'Não consultado')
})
test('partial, blocked and unavailable remain distinct for the associated asset', () => {
  assert.match(assetStatus({ state: 'partial', matches: [] }, 'a'), /eventos utilizáveis.*parcial/)
  assert.equal(assetStatus({ state: 'blocked' }, 'a'), 'Consulta bloqueada')
  assert.equal(assetStatus({ state: 'unavailable' }, 'a'), 'Fonte indisponível')
})
test('community screening sends only the selected asset ID and NASA snapshot', async () => {
  const time = '2026-10-09T12:00:00Z'
  const response = { state: 'empty', policy: { id: 'legacy-panel-assets-600-nearest', radiusKm: 600, selection: 'nearest_per_target' }, eventsFetchedAt: time, analyzedAt: time, evaluatedPairCount: 1, riskConfirmed: false, targetsAreReferenceData: true, isSimulation: false, requiresHumanConfirmation: true, datasetVersion: 'fixture', matches: [], warnings: [], skipped: [] }
  await getProximityForAssets(['b'], time, { baseUrl: 'http://fixture.test', fetcher: async (url, request) => {
    assert.deepEqual(JSON.parse(request.body), { targetIds: ['b'], expectedFetchedAt: time, policyId: response.policy.id })
    return new Response(JSON.stringify(response))
  } })
})
