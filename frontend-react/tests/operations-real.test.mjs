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

test('real Centro de Operações also has the bottom row like the demo (B2B, ESG, human review) with real numbers', () => {
  const real = source('features/operations/RealOperations.tsx')
  for (const t of ['Visão Corporativa (B2B)', 'Impacto Social (ESG)', 'Orientação e revisão humana', 'Prévia de aviso', 'Ver resumo']) assert.ok(real.includes(t), t)
  assert.match(real, /useAlertasAtivos\(\)/); assert.match(real, /buscarResumo/); assert.match(real, /verRota\(p.lugar.id\)/)
  assert.match(real, /não mostramos estimativa inventada/)
})

test('real "Informações complementares": satellite of the day, weather now, 24 h forecast and rain radar (no fictitious camera)', async () => {
  const { urlSatelite, ladrilho, descreverTempo, diaAtras, buscarAgora } = await import('../src/features/operations/data/complementares.ts')
  const url = urlSatelite({ latitude: -30.0346, longitude: -51.2177 }, '2026-10-11')
  assert.match(url, /^https:\/\/gibs\.earthdata\.nasa\.gov\/wms\/epsg4326\/best\/wms\.cgi\?/)
  assert.match(url, /BBOX=-31\.0346,-52\.5177,-29\.0346,-49\.9177/); assert.match(url, /TIME=2026-10-11/); assert.doesNotMatch(url, /key=/i)
  const t = ladrilho({ latitude: 0, longitude: 0 }, 1)
  assert.deepEqual([t.x, t.y, t.px, t.py], [1, 1, 0, 0])
  assert.equal(descreverTempo(63), 'Chuva'); assert.equal(descreverTempo(null), 'Sem dado')
  assert.equal(diaAtras(1, new Date('2026-10-12T06:00:00Z')), '2026-10-11')
  let pedido = ''
  const a = await buscarAgora({ latitude: -30, longitude: -51 }, { fetcher: async u => { pedido = u; return new Response(JSON.stringify({ current: { temperature_2m: 21.4, relative_humidity_2m: 80, precipitation: 1.2, wind_speed_10m: 14, weather_code: 61 }, hourly: { time: ['2026-10-12T08:00', '2026-10-12T09:00'], temperature_2m: [20, 22], precipitation: [0, 2.5] } })) } })
  assert.match(pedido, /current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code/); assert.match(pedido, /forecast_hours=24/)
  assert.equal(a.temperatura, 21.4); assert.deepEqual(a.horas[1], { hora: '09:00', temperatura: 22, chuva: 2.5 })
  const comp = source('features/operations/components/RealMonitoring.tsx')
  for (const t of ['SATÉLITE · NASA', 'Condições agora', 'Cidades monitoradas', 'Próximas 24 h', 'Radar de chuva agora']) assert.ok(comp.includes(t), t)
  assert.doesNotMatch(comp, /fictíci|ReferenceScene|demoWater/)
  assert.match(source('features/operations/RealOperations.tsx'), /<RealMonitoring cidade=\{cidade\}/)
})

test('satellite stays inside the site and moves (8 real days + live radar), no external link', async () => {
  const { urlSateliteLadrilhos, diasDoFilme } = await import('../src/features/operations/data/complementares.ts')
  assert.equal(urlSateliteLadrilhos('2026-10-11'), 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-10-11/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg')
  assert.deepEqual(diasDoFilme(3, new Date('2026-10-12T06:00:00Z')), ['2026-10-09', '2026-10-10', '2026-10-11'])
  const comp = source('features/operations/components/RealMonitoring.tsx'), sat = source('features/operations/components/SateliteAnimado.tsx')
  assert.doesNotMatch(comp, /worldview|target="_blank"/i, 'nada abre em outro site')
  assert.match(sat, /opacity=\{d === atual \? 1 : 0\}/); assert.match(sat, /prefers-reduced-motion/); assert.match(sat, /radarUrl && <TileLayer/)
})

test('satellite stays inside the site and moves (8 real days + live radar); 24 h chart has hover like the demo', async () => {
  const { urlSateliteLadrilhos, diasDoFilme } = await import('../src/features/operations/data/complementares.ts')
  assert.equal(urlSateliteLadrilhos('2026-10-11'), 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-10-11/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg')
  assert.deepEqual(diasDoFilme(3, new Date('2026-10-12T06:00:00Z')), ['2026-10-09', '2026-10-10', '2026-10-11'])
  const comp = source('features/operations/components/RealMonitoring.tsx'), sat = source('features/operations/components/SateliteAnimado.tsx')
  assert.doesNotMatch(comp, /worldview|target="_blank"/i, 'nada abre em outro site')
  assert.match(sat, /opacity=\{d === atual \? 1 : 0\}/); assert.match(sat, /prefers-reduced-motion/); assert.match(sat, /radarUrl && <TileLayer/)
  const graf = source('features/operations/components/RealTimeline.tsx')
  assert.match(graf, /from 'recharts'/); assert.match(graf, /<Tooltip /); assert.match(graf, /Previsão · /)
  assert.match(comp, /<RealTimeline horas=\{agora.horas\} \/>/)
})

test('maps never cover the detail windows (Leaflet layers stay inside their own stacking context)', () => {
  assert.match(source('features/climate/climate.css'), /\.cidade-mapa \{ position: relative; z-index: 0; isolation: isolate;/)
  assert.match(source('features/operations/real.css'), /\.ops-real-mapa \{[^}]*isolation: isolate;/)
  assert.match(source('features/operations/components/RealMonitoring.tsx'), /relative isolate z-0/)
})

test('evacuation route is real and drawn inside the site (no Google/Waze), list has proximity bars', async () => {
  const { linhaReta, proximidade, buscarRota } = await import('../src/features/operations/data/rota.ts')
  const r = linhaReta({ latitude: -30.03, longitude: -51.23 }, { latitude: -30.04, longitude: -51.21 })
  assert.equal(r.calculada, false); assert.equal(r.minutos, null); assert.ok(r.km > 1.5 && r.km < 2.5)
  assert.equal(proximidade(0, 3), 1); assert.ok(proximidade(3, 3) >= 0.08 && proximidade(3, 3) < 0.3)
  const original = globalThis.fetch
  try {
    globalThis.fetch = async url => { assert.match(String(url), /router\.project-osrm\.org\/route\/v1\/driving\/-51\.230000,-30\.030000;-51\.210000,-30\.040000/); return { ok: true, json: async () => ({ code: 'Ok', routes: [{ distance: 2350, duration: 410, geometry: { coordinates: [[-51.23, -30.03], [-51.21, -30.04]] } }] }) } }
    const ok = await buscarRota({ latitude: -30.03, longitude: -51.23 }, { latitude: -30.04, longitude: -51.21 })
    assert.deepEqual(ok, { pontos: [[-30.03, -51.23], [-30.04, -51.21]], km: 2.35, minutos: 7, calculada: true })
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) })
    assert.equal((await buscarRota({ latitude: -30.03, longitude: -51.23 }, { latitude: -30.04, longitude: -51.21 })).calculada, false)
  } finally { globalThis.fetch = original }
  const ops = source('features/operations/RealOperations.tsx')
  assert.doesNotMatch(ops, /routeLinks|google\.com\/maps|waze/i)
  assert.match(ops, /<RealEvacuacao /); assert.match(ops, /aria-label=\{`Proximidade/)
  assert.match(source('features/operations/real.css'), /\.rota-caixa \{[^}]*isolation: isolate;/)
})
