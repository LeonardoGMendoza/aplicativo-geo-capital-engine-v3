import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { capitalMaisPerto, categoriaPt, COR_EVENTO, corDoEvento, ondeFica, tituloPt, vistoHa } from '../src/features/nasa/leitura.ts'

const ev = (extra = {}) => ({ id: 'e', title: 'Tropical Storm Gonzalo', categories: [{ id: 'severeStorms', title: 'Severe Storms' }], coordinates: { latitude: 19.3, longitude: -23.3, method: 'point' }, geometryType: 'Point', coordinateState: 'available', observedAt: '2026-09-26T21:00:00Z', observationState: 'outdated', source: 'NASA EONET', isSimulation: false, ...extra })
const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')

test('NASA names and categories are shown in Portuguese, unknown names stay as they are', () => {
  assert.equal(tituloPt('Tropical Storm Gonzalo'), 'Tempestade tropical Gonzalo')
  assert.equal(tituloPt('Hurricane Simon'), 'Furacão Simon')
  assert.equal(tituloPt('Typhoon Koguma'), 'Tufão Koguma')
  assert.equal(tituloPt('Wildfire in Tocantins, Brazil'), 'Incêndio florestal em Tocantins, Brasil')
  assert.equal(tituloPt('Bear Creek Fire'), 'Incêndio Bear Creek')
  assert.equal(tituloPt('Sakurajima Volcano, Japan'), 'Vulcão Sakurajima, Japão')
  assert.equal(tituloPt('Iceberg A23A'), 'Iceberg A23A')
  assert.equal(tituloPt('Something else'), 'Something else')
  assert.equal(categoriaPt(ev()), 'Tempestade')
  assert.equal(categoriaPt(ev({ categories: [{ id: 'volcanoes', title: 'Volcanoes' }] })), 'Vulcão')
})

test('color like Felipe: red recent, orange old; where it is = nearest Brazilian capital; seen N days ago', () => {
  assert.equal(corDoEvento(ev({ observationState: 'recent' })), COR_EVENTO.recente)
  assert.equal(corDoEvento(ev()), COR_EVENTO.antigo)
  assert.equal(capitalMaisPerto(ev()).nome, 'Fortaleza/CE')
  assert.match(ondeFica(ev()), /^A [\d.]+ km de Fortaleza\/CE \(capital mais perto\)$/)
  assert.equal(ondeFica(ev({ coordinates: { latitude: -30.05, longitude: -51.2, method: 'point' } })), 'Perto de Porto Alegre/RS')
  assert.equal(ondeFica(ev({ coordinates: null })), 'Localização não informada')
  assert.equal(vistoHa(ev(), Date.parse('2026-10-12T12:00:00Z')), 'Visto há 15 dias')
  assert.equal(vistoHa(ev({ observedAt: null })), 'Data não informada')
})

test('real Risk Map looks like the simulation: Brazil first, Felipe markers, technical text hidden', () => {
  const mapa = source('features/nasa/NasaGeographicMap.tsx')
  assert.match(mapa, /center=\{\[-15, -55\]\} zoom=\{3\}/); assert.match(mapa, /marcadorHtml\('alerta', cor\)/); assert.match(mapa, /<CircleMarker /); assert.match(mapa, /tituloPt\(event.title\)/)
  assert.doesNotMatch(mapa.slice(0, mapa.indexOf('function GeographicLayers')), /Lat\/Lon/)
  const explorer = source('features/nasa/NasaMapExplorer.tsx')
  assert.doesNotMatch(explorer, /Contorno sólido/); assert.match(explorer, /Visto nos últimos dias/); assert.match(explorer, /evento=\{tituloPt\(selected.title\)\}/)
  const painel = source('features/nasa/NasaEventsPanel.tsx')
  assert.match(painel, /<details[^\n]*Sobre estes dados/); assert.doesNotMatch(painel, /<p className="text-amber-900">Dados parciais/)
})
