import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bordasDoGeojson, buscarPlacas, buscarSismos, caminhoSismos, ehMes, haQuanto, lugarPt, mesesAnteriores, naCostaDasAmericas, nomeBorda, nomePeriodo, raioDoSismo } from '../src/features/nasa/placas.ts'

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')

test('plate boundary names in Portuguese (PB2002 codes, both separators)', () => {
  assert.equal(nomeBorda('NZ\\SA'), 'Placa Nazca × Placa Sul-Americana')
  assert.equal(nomeBorda('PA-NA'), 'Placa Pacífico × Placa Norte-Americana')
  assert.equal(nomeBorda(undefined), 'Borda entre placas tectônicas')
})

test('boundaries become [lat, lon] lines and are split at the 180° meridian', () => {
  const bordas = bordasDoGeojson({ features: [
    { properties: { Name: 'PA-NA' }, geometry: { type: 'LineString', coordinates: [[-121, 36.5], [-122.5, 37.8]] } },
    { properties: { Name: 'PA-PA' }, geometry: { type: 'LineString', coordinates: [[178, -20], [179, -20.5], [-178, -21], [-175, -22]] } },
    { properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
  ] })
  assert.equal(bordas.length, 2)
  assert.deepEqual(bordas[0].positions, [[[36.5, -121], [37.8, -122.5]]])
  assert.equal(bordas[1].positions.length, 2) // não atravessa o mapa inteiro
  assert.deepEqual(bordasDoGeojson(null), [])
})

test('USGS place text translated, magnitude size and "how long ago"', () => {
  assert.equal(lugarPt('45 km SW of Trujillo, Peru'), 'a 45 km a SO de Trujillo, Peru')
  assert.equal(lugarPt('12 km NNE of Parkfield, CA'), 'a 12 km a NNL de Parkfield, Califórnia (EUA)')
  assert.equal(lugarPt('off the coast of Central Peru'), 'na costa do centro do Peru')
  assert.equal(lugarPt('35 km S of Panama City, Panama'), 'a 35 km a S de Cidade do Panamá, Panamá')
  assert.equal(lugarPt(null), 'Local não informado')
  assert.ok(raioDoSismo(7) > raioDoSismo(5)); assert.equal(raioDoSismo(3), 4)
  const agora = Date.parse('2026-10-13T12:00:00Z')
  assert.equal(haQuanto('2026-10-13T07:00:00Z', agora), 'há 5 h'); assert.equal(haQuanto('2026-10-11T12:00:00Z', agora), 'há 2 dias')
})

test('Pacific coast of the Americas includes Peru, Chile, Panama, Venezuela and California, not Japan', () => {
  const s = (la, lo) => ({ coordinates: { latitude: la, longitude: lo } })
  for (const [la, lo] of [[-8.1, -79], [-20, -70.5], [8.9, -79.5], [10.5, -66.9], [35.9, -120.4], [61, -150]]) assert.ok(naCostaDasAmericas(s(la, lo)), `${la},${lo}`)
  assert.ok(!naCostaDasAmericas(s(36, 140)))
})

test('plates and earthquakes come only from our API, real data only; one failing source does not hide the other', async () => {
  const pedidos = []
  const fetcher = async url => { pedidos.push(String(url))
    if (String(url).endsWith('/tectonic-plates')) return { ok: false, json: async () => ({ error: { message: 'x' } }) }
    return { ok: true, json: async () => ({ isSimulation: false, items: [{ id: 'q', magnitude: 5.1, place: 'Peru', observedAt: '2026-10-13T00:00:00Z', coordinates: { latitude: -8, longitude: -79 } }, { id: 'ruim', magnitude: 'x' }] }) } }
  const d = await buscarPlacas({ baseUrl: 'https://api.test/', fetcher })
  assert.deepEqual(pedidos.sort(), ['https://api.test/api/v1/earthquakes?periodo=dia', 'https://api.test/api/v1/tectonic-plates'])
  assert.equal(d.erroPlacas, true); assert.equal(d.erroSismos, false); assert.equal(d.sismos.length, 1); assert.equal(d.periodo, 'dia')
  const sim = await buscarPlacas({ baseUrl: 'x', fetcher: async () => ({ ok: true, json: async () => ({ isSimulation: true, items: [], geojson: { features: [] } }) }) })
  assert.equal(sim.erroSismos, true) // nada simulado entra
})

test('Risk Map shows the layer with a toggle, a Pacific button and the weekly list; no prediction claims', () => {
  const ex = source('features/nasa/NasaMapExplorer.tsx')
  assert.match(ex, /Placas tectônicas e terremotos</); assert.match(ex, /Ver costa do Pacífico das Américas/); assert.match(ex, /<PlacasResumo dados=\{placas\} periodo=\{periodo\}/)
  assert.match(ex, /useState<Periodo>\('dia'\)/) // abre no "agora"
  const camada = source('features/nasa/PlacasCamada.tsx')
  assert.match(camada, /Isso não confirma tsunami/)
  assert.match(source('features/nasa/PlacasResumo.tsx'), /não é previsão de novos terremotos/)
  assert.match(source('features/nasa/placas.ts'), /Falha de San Andreas/)
})

test('periods: now (24 h), 7 days, 30 days and closed months as history', async () => {
  assert.equal(caminhoSismos('dia'), 'earthquakes?periodo=dia'); assert.equal(caminhoSismos('mes'), 'earthquakes?periodo=mes')
  assert.equal(caminhoSismos('2026-09'), 'earthquakes?mes=2026-09')
  assert.ok(ehMes('2026-09')); assert.ok(!ehMes('2026-13')); assert.ok(!ehMes('mes'))
  assert.equal(nomePeriodo('dia'), 'nas últimas 24 horas'); assert.equal(nomePeriodo('2026-09'), 'em setembro de 2026')
  const meses = mesesAnteriores(new Date(2026, 9, 14), 3) // 14/out/2026: outubro ainda não acabou
  assert.deepEqual(meses.map(m => m.valor), ['2026-09', '2026-08', '2026-07']); assert.equal(meses[0].nome, 'Setembro de 2026')
  assert.equal(mesesAnteriores(new Date(2026, 0, 5), 1)[0].valor, '2025-12')
  const pedidos = []
  const r = await buscarSismos('2026-09', { baseUrl: 'https://api.test', fetcher: async url => { pedidos.push(String(url)); return { ok: true, json: async () => ({ isSimulation: false, items: [{ id: 'q', magnitude: 7.7, place: 'Panama', observedAt: '2026-10-09T17:56:00Z', coordinates: { latitude: 7.6, longitude: -80.6 } }] }) } } })
  assert.deepEqual(pedidos, ['https://api.test/api/v1/earthquakes?mes=2026-09']); assert.equal(r.sismos.length, 1); assert.equal(r.erroSismos, false)
  const falha = await buscarSismos('dia', { baseUrl: 'x', fetcher: async () => { throw new Error('rede') } })
  assert.deepEqual(falha, { sismos: [], erroSismos: true }) // nunca quebra a tela
})

test('summary has the period buttons, the months accordion and a way out when the last 24 h are empty; big touch targets on phones', () => {
  const r = source('features/nasa/PlacasResumo.tsx')
  assert.match(r, /Agora · 24 h/); assert.match(r, /<details className="placa-historico"/); assert.match(r, /Meses anteriores/)
  assert.match(r, /Ver os últimos 30 dias/); assert.match(r, /aria-pressed=\{periodo === p\}/)
  const css = source('styles/globals.css')
  assert.match(css, /@media \(max-width: 640px\) \{\r?\n  \.placa-periodos button, \.placa-meses button, \.placa-vazio button, \.placa-historico summary \{ min-height: 44px/)
})
