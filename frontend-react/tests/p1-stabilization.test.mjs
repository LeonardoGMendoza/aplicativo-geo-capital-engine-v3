import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { navigation, menuNavigation } from '../src/app/navigation.ts'
import { MapErrorBoundary } from '../src/components/shared/MapErrorBoundary.ts'
import { getProximity, getProximityForAssets } from '../src/features/nasa/proximity.ts'
import { completed } from '../src/features/corporate/screening.ts'
const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')
// Render the actual page while isolating hooks/network/map from this copy regression.
// Historical timestamps below come from Prompt 21; the blocked envelope is a test fixture.
export function renderExpiredCorporateContext() {
  const require = createRequire(import.meta.url)
  const module = { exports: {} }
  const blocked = { state: 'blocked', eventsFetchedAt: '2026-10-10T14:56:49.989684Z', analyzedAt: '2026-10-10T14:56:50Z', evaluatedPairCount: 0, riskConfirmed: false, matches: [], skipped: [], warnings: [] }
  const dependencies = {
    '@/components/shared/MapErrorBoundary': { MapErrorBoundary: ({ children }) => children },
    '@/components/ui/button': { Button: ({ variant, ...props }) => createElement('button', props) },
    '../nasa/NasaSession': { useNasaSession: () => ({ mode: 'nasa', loading: false, error: null, result: { source: 'NASA EONET', state: 'success', dataQuality: 'partial', fetchedAt: '2026-10-10T14:35:54.016225Z' } }) },
    '../nasa/proximity': { getAssets: () => { throw new Error('SSR must not fetch') } },
    '../nasa/geography': { formatObservation: value => value ?? 'Não disponível' },
    './components/CorporateAssetList': { CorporateAssetList: () => null },
    './components/CorporateAssetDetails': { CorporateAssetDetails: () => null },
    './screening': { completed, visibleAssets: assets => assets },
    './useCorporateScreening': { useCorporateScreening: () => ({ result: blocked, loading: false, error: null }) },
  }
  const compiled = ts.transpileModule(source('features/corporate/CorporatePage.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => name in dependencies ? dependencies[name] : require(name) })
  return renderToStaticMarkup(createElement(module.exports.CorporatePage))
}

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
test('expired corporate snapshot remains blocked and its historical header cannot imply current availability', async () => {
  // The server can refresh its cache while rejecting the timestamp held by React.
  const blocked = { ...result, state: 'blocked', eventsFetchedAt: '2026-10-09T12:30:00Z', matches: [], skipped: [], evaluatedPairCount: 0, warnings: ['Cache desatualizado ou consulta diferente. Atualize o catálogo NASA antes de analisar.'] }
  const response = await getProximityForAssets([asset.id], stamp, opts(blocked, 409))
  assert.deepEqual(response, blocked)
  assert.equal(response.riskConfirmed, false)
  const html = renderExpiredCorporateContext()
  assert.match(html, /Estado registrado na consulta: success/)
  assert.match(html, /O estado registrado não garante disponibilidade atual/)
  assert.match(html, /role="alert"[^>]*>Triagem bloqueada\./)
  assert.match(html, /Atualize os eventos NASA e execute uma nova triagem com uma consulta válida/)
  assert.match(html, /Ativos avaliados<\/p><p[^>]*>Bloqueado/)
  assert.match(html, /pares avaliados: 0/)
  assert.doesNotMatch(html, /Triagem concluída/)
  const page = source('features/corporate/CorporatePage.tsx')
  assert.match(page, /Estado registrado na consulta: \$\{nasa\.result\.state\}/)
  assert.match(page, /O estado registrado não garante disponibilidade atual\. A triagem revalida o snapshot e pode exigir atualização dos eventos NASA\./)
  assert.match(page, /result\?\.state === 'blocked' && <p role="alert"[^>]*>Triagem bloqueada\. O registro acima pertence à consulta anterior e não representa disponibilidade atual\. Atualize os eventos NASA e execute uma nova triagem com uma consulta válida\./)
})
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
