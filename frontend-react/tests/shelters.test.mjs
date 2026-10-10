import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { supportPoints, searchPoints, selectPoint, referenceNotice, distanceNotice } from '../src/features/shelters/reference.ts'
import { parseOrigin, haversine, orderPoints, distanceLabel, destinationLinks } from '../src/features/shelters/location.ts'
import { checklist, checklistKey, readChecklist, writeChecklist } from '../src/features/shelters/checklist.ts'

test('eight reference records preserve the Streamlit names, cities, types and coordinates', () => {
  const source = readFileSync(new URL('../../frontend/painel_ceo.py', import.meta.url), 'utf8').split('ABRIGOS = [')[1].split('\n]')[0]
  const rows = [...source.matchAll(/\{"nome":\s*"([^"]+)",\s*"cidade":\s*"([^"]+)",\s*"lat":\s*([\d.-]+),\s*"lon":\s*([\d.-]+),\s*"capacidade":\s*\d+,\s*"tipo":\s*"([^"]+)"\}/g)]
  assert.equal(rows.length, 8)
  assert.deepEqual(supportPoints.map(p => [p.name, p.city, p.latitude, p.longitude, p.type]), rows.map(r => [r[1], r[2], Number(r[3]), Number(r[4]), r[5]]))
})
test('IDs are unique and every point declares its reference provenance', () => {
  assert.equal(new Set(supportPoints.map(p => p.id)).size, 8)
  for (const p of supportPoints) { assert.match(p.sourceFile, /frontend\/painel_ceo.py/); assert.equal(p.coordinatesApproximate, true); assert.equal(p.operationallyVerified, false); assert.equal('occupancy' in p, false) }
})
test('search ignores case, accents and exterior whitespace', () => {
  assert.equal(searchPoints(' BOICUCANGA ')[0].id, 'sao-sebastiao-boicucanga')
  assert.equal(searchPoints('sao paulo').length, 2)
  assert.deepEqual(searchPoints('not found'), [])
})
test('type filters compose with search and selection remains stable by ID', () => {
  assert.equal(searchPoints('sao', 'Centro de Apoio').length, 2)
  assert.equal(selectPoint('canoas-presidente-vargas').city, 'Canoas / RS')
  assert.equal(selectPoint('unknown'), undefined)
  assert.equal(orderPoints(supportPoints, null, false).find(p => p.id === 'canoas-presidente-vargas'), selectPoint('canoas-presidente-vargas'))
})
test('coordinates accept zero, boundaries, whitespace and decimal comma', () => {
  assert.deepEqual(parseOrigin('0', '0'), { latitude: 0, longitude: 0 })
  assert.deepEqual(parseOrigin(' -90 ', '180'), { latitude: -90, longitude: 180 })
  assert.deepEqual(parseOrigin('-23,55', '-46,63'), { latitude: -23.55, longitude: -46.63 })
})
test('invalid or incomplete coordinates prevent calculation', () => {
  for (const [lat, lon] of [['', '0'], [' ', ' '], ['91', '0'], ['0', '-181'], ['NaN', '0'], ['Infinity', '0'], ['abc', '2']]) assert.equal(parseOrigin(lat, lon), null)
})
test('Haversine uses the 6371 km sphere and handles identical and antipodal points', () => {
  const zero = { latitude: 0, longitude: 0 }
  assert.equal(haversine(zero, zero), 0)
  assert.ok(Math.abs(haversine(zero, { latitude: 0, longitude: 1 }) - 111.19492664455873) < 1e-9)
  assert.ok(Math.abs(haversine(zero, { latitude: 0, longitude: 180 }) - Math.PI * 6371) < 1e-8)
})
test('distance ordering uses selected origin and does not mutate the catalog', () => {
  const before = supportPoints.map(p => p.id), origin = selectPoint('canoas-presidente-vargas')
  const ordered = orderPoints(supportPoints, origin, true)
  assert.equal(ordered[0].id, origin.id)
  for (let i = 1; i < ordered.length; i++) assert.ok(haversine(origin, ordered[i-1]) <= haversine(origin, ordered[i]))
  assert.deepEqual(supportPoints.map(p => p.id), before)
})
test('without origin distance remains uncalculated, never zero', () => {
  assert.equal(distanceLabel(null, supportPoints[0]), 'Distância não calculada')
  assert.match(distanceLabel(supportPoints[0], supportPoints[0]), /Distância em linha reta: 0 km/)
})
test('external URLs contain only destination coordinates and do not request navigation', () => {
  const p = supportPoints[0], links = destinationLinks(p)
  assert.equal(new URL(links.google).searchParams.get('query'), `${p.latitude},${p.longitude}`)
  assert.equal(new URL(links.google).searchParams.get('api'), '1')
  assert.equal(new URL(links.waze).searchParams.get('ll'), `${p.latitude},${p.longitude}`)
  assert.equal(new URL(links.waze).searchParams.get('z'), '17')
  assert.equal(new URL(links.waze).searchParams.has('navigate'), false)
})
test('fourteen stable checklist items persist only known marks under a versioned key', () => {
  assert.equal(checklist.length, 14)
  assert.equal(new Set(checklist.map(([id]) => id)).size, 14)
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) }
  assert.equal(writeChecklist(storage, ['water', 'phone', 'water', 'unknown']), true)
  assert.deepEqual(readChecklist(storage), ['water', 'phone'])
  assert.deepEqual([...data.keys()], [checklistKey]); assert.match(checklistKey, /v1$/)
  assert.equal(writeChecklist(storage, []), true); assert.deepEqual(readChecklist(storage), [])
})
test('blocked or corrupted local storage degrades without throwing', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.deepEqual(readChecklist(blocked), []); assert.equal(writeChecklist(blocked, ['water']), false)
  for (const raw of ['bad JSON', '{}', 'null', '[1]', '["unknown"]']) assert.deepEqual(readChecklist({ getItem: () => raw }), [])
  assert.deepEqual(readChecklist({ getItem: () => '["water","water"]' }), ['water'])
})
test('visible copy rejects false operational promises and displays explicit limits', () => {
  const page = readFileSync(new URL('../src/features/shelters/SheltersPage.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(page, /Rota segura|família está segura|100% preparado|Resgate acionado|Abrigo disponível|abrigos oficialmente ativos/i)
  assert.match(referenceNotice, /sem verificação operacional/)
  assert.match(distanceNotice, /Não representa percurso/)
  assert.doesNotMatch(page, /useNasaSession|getAssets|proximity|navigator.geolocation/)
  assert.match(page, /de 14 itens revisados/)
})
