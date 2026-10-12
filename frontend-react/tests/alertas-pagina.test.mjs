import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')

test('menu "Alertas" opens its own page with only real alerts (forecast, NASA near capitals, UN/GDACS)', () => {
  assert.match(source('app/App.tsx'), /path="\/alertas" element={<AlertasPage \/>}/)
  const page = source('features/alerts/AlertasPage.tsx')
  assert.match(page, /buscarPrevisoes\(/); assert.match(page, /buscarAlertasGlobais\(/); assert.match(page, /capitalMaisPerto\(e\)/)
  assert.match(page, /if \(nasa.mode !== 'nasa'\) nasa.setMode\('nasa'\)/, 'página sempre real')
  assert.doesNotMatch(page, /demoSnapshot|visualDemo|fictíci/)
  assert.match(page, /<AlertActions key=\{atual.id\} perfil="comunidade"/)
  assert.match(page, /Não substitui o alerta oficial/)
})
