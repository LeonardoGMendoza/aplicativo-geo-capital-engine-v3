import test from 'node:test'
import assert from 'node:assert/strict'
import { nasaSummary } from '../src/features/nasa/summary.ts'
test('unqueried and loading states do not invent event counts', () => {
  assert.equal(nasaSummary(null, false, null).count, null)
  assert.equal(nasaSummary(null, true, null).count, null)
})
test('unavailable, integration error and network failure do not become zero events', () => {
  for (const state of ['unavailable', 'error']) {
    const result = nasaSummary({ state, events: [] }, false, null)
    assert.equal(result.count, null)
    assert.equal(result.problem, true)
  }
  assert.equal(nasaSummary(null, false, 'offline').problem, true)
})
test('valid empty results and stale empty results remain distinct', () => {
  assert.equal(nasaSummary({ state: 'empty', events: [] }, false, null).count, 0)
  assert.match(nasaSummary({ state: 'empty', events: [] }, false, null).label, /válida/)
  assert.match(nasaSummary({ state: 'stale', events: [] }, false, null).label, /desatualizada/)
})
test('summary counts the unfiltered catalog and never the dashboard fixtures', () => {
  assert.equal(nasaSummary({ state: 'success', events: [{ id: 'a' }, { id: 'b' }] }, false, null).count, 2)
})
