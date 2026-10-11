import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')
const page = source('features/citizen/CitizenPage.tsx')
const hook = source('features/citizen/useNearbySearch.ts')
const css = source('features/citizen/citizen.css')
const app = source('app/App.tsx')

test('/cidadao is a standalone route outside the operations layout and menu', () => {
  const layoutStart = app.indexOf('<Route element={<AppLayout />}>')
  const citizenRoute = app.indexOf('<Route path="/cidadao" element={<CitizenPage />} />')
  assert.ok(citizenRoute > 0 && citizenRoute < layoutStart, 'rota do cidadão deve vir antes e fora do AppLayout')
  assert.doesNotMatch(source('app/navigation.ts'), /cidadao/)
})

test('emergency numbers are callable links for Defesa Civil, Bombeiros and SAMU', () => {
  for (const [n, label] of [['199', 'Defesa Civil'], ['193', 'Bombeiros'], ['192', 'SAMU']]) {
    assert.match(page, new RegExp(`number: '${n}', label: '${label}'`))
  }
  assert.match(page, /href=\{`tel:\$\{e\.number\}`\}/)
})

test('location is only requested on click and very imprecise positions are not searched', () => {
  assert.match(hook, /MAX_ACCURACY_M = 5000/)
  assert.match(hook, /meters > MAX_ACCURACY_M/)
  assert.doesNotMatch(page + hook, /useEffect\([^)]*geolocation/s)
  assert.match(page, /onClick=\{locate\}/)
})

test('copy keeps honest limits: no promised safe route, availability or rescue', () => {
  assert.doesNotMatch(page, /Rota segura|rotas seguras|Abrigo disponível|vaga garantida|Resgate acionado/i)
  assert.match(page, /não sabe se a rua está alagada/)
  assert.match(page, /OpenStreetMap/)
})

test('touch targets and text are large enough for use under stress', () => {
  const min = selector => Number(css.match(new RegExp(`\\.${selector} \\{[^}]*min-height: (\\d+)px`))?.[1])
  for (const [selector, px] of [['citizen-primary', 56], ['citizen-call', 56], ['citizen-need', 56], ['citizen-route', 56]]) assert.ok(min(selector) >= px, `${selector} >= ${px}px`)
  assert.match(css, /\.citizen-app \{[^}]*font-size: 17px/)
  assert.match(css, /\.citizen-form input \{[^}]*font-size: 18px/)
})
