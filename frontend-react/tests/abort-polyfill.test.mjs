import test from 'node:test'
import assert from 'node:assert/strict'
import { installAbortPolyfill } from '../src/lib/abortPolyfill.ts'

test('polyfill fills AbortSignal.any and timeout only when the browser lacks them', async () => {
  const fake = {}
  installAbortPolyfill(fake)
  const a = new AbortController(), b = new AbortController()
  const combined = fake.any([a.signal, b.signal])
  assert.equal(combined.aborted, false)
  b.abort('motivo')
  assert.equal(combined.aborted, true)
  assert.equal(combined.reason, 'motivo')
  const already = new AbortController(); already.abort('antes')
  assert.equal(fake.any([already.signal]).reason, 'antes')
  const t = fake.timeout(20)
  await new Promise(r => setTimeout(r, 60))
  assert.equal(t.aborted, true)
  assert.equal(t.reason.name, 'TimeoutError')
  const native = { any: () => 'nativo', timeout: () => 'nativo' }
  installAbortPolyfill(native)
  assert.equal(native.any(), 'nativo')
})
