import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('CSS build targets old Safari so mobile media queries work on older iPhones', () => {
  const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
  assert.match(config, /cssTarget: \[[^\]]*'safari14'/)
})
