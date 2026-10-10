import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { navigation, menuNavigation } from '../src/app/navigation.ts'
import { MapErrorBoundary } from '../src/components/shared/MapErrorBoundary.ts'
import { getProximity, getProximityForAssets } from '../src/features/nasa/proximity.ts'
const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')

test('menu hides reserved history/settings while preserving their routes and future IA', () => {
  assert.deepEqual(menuNavigation.map(item => item.path), ['/', '/mapa', '/alertas', '/corporativo', '/comunidade', '/abrigos', '/inteligencia'])
  assert.ok(navigation.some(item => item.path === '/historico'))
  assert.ok(navigation.some(item => item.path === '/configuracoes'))
  const ai = menuNavigation.find(item => item.path === '/inteligencia')
  assert.match(ai.label, /futura/)
  assert.match(ai.description, /Oracle RAG ainda não integrados ao React/)
})

test('legacy Alerts route targets the single existing central with keyboard focus support', () => {
  assert.match(source('app/App.tsx'), /path="\/alertas" element={<Navigate to="\/#central-alertas" replace/)
  assert.match(source('components/layout/AppLayout.tsx'), /central\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(source('features/operations/components/AlertCenter.tsx'), /id="central-alertas" tabIndex=\{-1\}/)
})

test('branding communicates human decision support without active AI or prediction promises', () => {
  const brand = source('components/shared/Brand.tsx') + source('components/layout/AppLayout.tsx')
  assert.match(brand, /Dados e alertas para apoiar decisões/)
  assert.match(brand, /O humano decide/)
  assert.doesNotMatch(brand, /Da previsão à ação|A IA recomenda|VIDAS MAIS SEGURAS/)
})

test('map boundary renders children normally and an accessible textual failure independently', () => {
  const child = createElement('div', null, 'Mapa de teste')
  const boundary = new MapErrorBoundary({ children: child, message: 'Mapa indisponível. Consulte a lista.' })
  assert.equal(boundary.render(), child)
  boundary.state = MapErrorBoundary.getDerivedStateFromError(new Error('chunk or render failure'))
  assert.match(renderToStaticMarkup(boundary.render()), /role="alert".*Mapa indisponível/)
  assert.doesNotMatch(renderToStaticMarkup(boundary.render()), /Mapa de teste/)
  for (const path of ['features/nasa/NasaMapExplorer.tsx', 'features/corporate/CorporatePage.tsx']) {
    const component = source(path)
    assert.match(component, /<MapErrorBoundary[^>]+><Suspense/)
    assert.match(component, /<\/Suspense><\/MapErrorBoundary>/)
  }
})

const stamp = '2026-10-09T12:00:00.123456Z'
const event = { id: 'fixture-event', title: 'Evento de teste', source: 'NASA EONET', isSimulation: false, categories: [], observedAt: stamp, coordinates: { latitude: 0, longitude: 0 } }
const asset = { id: 'fixture-asset', isReferenceData: true, coordinates: { latitude: 0, longitude: 0 } }
const match = { asset, event, distanceKm: 599.999, geometryApproximate: false }
const result = { state: 'partial', source: 'NASA EONET', eventsFetchedAt: stamp, analyzedAt: stamp, policy: { id: 'legacy-panel-assets-600-nearest', radiusKm: 600, selection: 'nearest_per_target' }, evaluatedPairCount: 1, riskConfirmed: false, targetsAreReferenceData: true, isSimulation: false, requiresHumanConfirmation: true, datasetVersion: 'test-v1', matches: [match], skipped: [{ eventId: 'test-missing', reason: 'missing_coordinates' }], warnings: ['Resultado parcial de teste'] }
const opts = (data, status = 200) => ({ baseUrl: 'http://fixture.test', fetcher: async () => new Response(JSON.stringify(data), { status }) })
for (const [name, query] of [['individual', (stamp, options) => getProximity(asset.id, stamp, options)], ['batch', (stamp, options) => getProximityForAssets([asset.id], stamp, options)]]) {
  test(name + ' preserves partial results, omissions, warnings and false risk', async () => {
    assert.deepEqual(await query(stamp, opts(result)), result)
    for (const [state, status] of [['blocked', 409], ['unavailable', 503]]) {
      const envelope = { ...result, state, eventsFetchedAt: null, matches: [] }
      assert.deepEqual(await query(stamp, opts(envelope, status)), envelope)
    }
  })
  test(name + ' rejects incompatible snapshot, provenance, policy and geographic context', async () => {
    for (const data of [
      { ...result, eventsFetchedAt: '2026-10-09T12:00:00.123457Z' },
      { ...result, isSimulation: true }, { ...result, requiresHumanConfirmation: false },
      { ...result, datasetVersion: '' }, { ...result, riskConfirmed: true },
      { ...result, policy: { ...result.policy, radiusKm: 601 } },
      { ...result, policy: { ...result.policy, selection: 'all' } },
      { ...result, matches: [{ ...match, distanceKm: 600 }] },
      { ...result, matches: [{ ...match, asset: { ...asset, isReferenceData: false } }] },
      { ...result, matches: [{ ...match, event: { ...event, source: 'Unverified' } }] },
      { ...result, matches: [{ ...match, geometryApproximate: undefined }] },
      { ...result, state: 'blocked' }, { ...result, state: 'empty' },
    ]) await assert.rejects(query(stamp, opts(data)))
    assert.equal((await query(stamp, opts({ ...result, eventsFetchedAt: '2026-10-09T09:00:00.123456-03:00' }))).riskConfirmed, false)
  })
}
test('individual invalid inputs are rejected before calling the API', async () => {
  let calls = 0
  const options = { fetcher: async () => { calls++; throw new Error('unexpected request') } }
  await assert.rejects(getProximity('', stamp, options), /Identificadores/)
  await assert.rejects(getProximity(asset.id, 'timestamp', options), /Identificadores/)
  assert.equal(calls, 0)
})
