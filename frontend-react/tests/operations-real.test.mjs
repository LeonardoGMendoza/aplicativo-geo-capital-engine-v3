import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { itensDaPrevisao, itensGdacs, itensNasa, orientacoes, priorizar, naAmericaDoSul } from '../src/features/operations/data/real.ts'

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')

test('forecast becomes real alerts only above the prototype criteria', () => {
  const itens = itensDaPrevisao([
    { nome: 'Teresina', uf: 'PI', maxima: 40.2, diaMaxima: '2026-10-13', chuva: 0, diaChuva: '2026-10-12' },
    { nome: 'Manaus', uf: 'AM', maxima: 36, diaMaxima: '2026-10-12', chuva: 5, diaChuva: '2026-10-12' },
    { nome: 'Curitiba', uf: 'PR', maxima: 24, diaMaxima: '2026-10-12', chuva: 62, diaChuva: '2026-10-14' },
    { nome: 'Lajeado', uf: 'RS', maxima: null, diaMaxima: null, chuva: 10, diaChuva: '2026-10-12' },
  ])
  assert.deepEqual(itens.map(i => [i.local, i.tipo, i.nivel]), [['Teresina/PI', 'calor', 'critical'], ['Manaus/AM', 'calor', 'high'], ['Curitiba/PR', 'chuva', 'high']])
  assert.equal(itens[0].quando, '13/10')
  assert.match(itens[2].detalhe, /62 mm em 14\/10/)
  assert.ok(itens.every(i => i.fonte.startsWith('Open-Meteo') && i.escopo === 'brasil'))
})

test('NASA events near the city: last 3 days = high, older = attention', () => {
  const [novo, velho] = itensNasa([{ id: 'a', titulo: 'Wildfire X', categoria: 'wildfires', km: 42.4, dias: 1 }, { id: 'b', titulo: 'Storm Y', categoria: 'severeStorms', km: 200, dias: 12 }], 'Porto Alegre/RS')
  assert.equal(novo.nivel, 'high'); assert.equal(novo.tipo, 'incendio'); assert.equal(novo.local, 'a 42 km de Porto Alegre/RS')
  assert.equal(velho.nivel, 'attention'); assert.equal(velho.tipo, 'tempestade')
})

test('GDACS: red = critical, orange = high; South America counts as near and comes first', () => {
  const itens = itensGdacs([
    { id: 'TC-1', tipo: 'TC', tipoNome: 'Ciclone tropical', nivel: 'vermelho', nome: 'SIMON-26', pais: 'Philippines', inicio: '2026-10-07T00:00:00', latitude: 14, longitude: 125, link: 'https://www.gdacs.org/report.aspx?x=1' },
    { id: 'FL-2', tipo: 'FL', tipoNome: 'Enchente', nivel: 'laranja', nome: 'Flood RS', pais: 'Brazil', inicio: '2026-10-09T00:00:00', latitude: -29.5, longitude: -51.9, link: 'javascript:alert(1)' },
  ])
  assert.equal(itens[0].nivel, 'critical'); assert.equal(itens[0].escopo, 'mundo')
  assert.equal(itens[1].nivel, 'high'); assert.equal(itens[1].escopo, 'brasil')
  assert.equal(itens[1].fonteUrl, 'https://www.gdacs.org/', 'link que não é https não passa')
  assert.deepEqual(priorizar(itens).map(i => i.id), ['gdacs-FL-2', 'gdacs-TC-1'], 'o que é perto vem antes')
  assert.ok(naAmericaDoSul(-23.5, -46.6)); assert.ok(!naAmericaDoSul(48.8, 2.3))
})

test('every type has a general orientation, without promising safe routes', () => {
  for (const tipo of ['calor', 'chuva', 'incendio', 'tempestade', 'enchente', 'ciclone', 'seca', 'terremoto', 'vulcao', 'outro']) {
    assert.ok(orientacoes[tipo]?.length > 20, tipo)
    assert.doesNotMatch(orientacoes[tipo], /rota segura/i)
  }
})

test('Centro de Operações opens with real data and keeps the demo behind a button', () => {
  const page = source('features/operations/OperationsPage.tsx')
  assert.match(page, /if \(mode === 'nasa'\) return/)
  assert.match(page, /Modo demonstração/)
  assert.match(page, /<RealOperations /)
  assert.match(source('features/nasa/NasaSession.tsx'), /useState<'simulation' \| 'nasa'>\('nasa'\)/)
  const real = source('features/operations/RealOperations.tsx')
  assert.match(real, /id="central-alertas" tabIndex=\{-1\}/)
  assert.doesNotMatch(real, /visualDemo|demoSnapshot|fictíci[oa] ·/, 'a versão real não usa dados do cenário fictício')
  assert.match(real, /buscarPrevisoes/); assert.match(real, /buscarAlertasGlobais/); assert.match(real, /getNearbyPlaces/); assert.match(real, /eventosPerto/)
})
