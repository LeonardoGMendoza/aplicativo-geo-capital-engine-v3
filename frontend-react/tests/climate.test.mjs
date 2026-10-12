import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')
async function load() {
  const js = ts.transpileModule(source('features/climate/climate.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}
const dia = (max, chuva) => ({ daily: { time: ['2026-10-12', '2026-10-13', '2026-10-14'], temperature_2m_max: max, precipitation_sum: chuva } })

test('asks Open-Meteo once for all cities, 3 days, Brasília time, no key', async () => {
  const { buscarPrevisoes, cidadesChuva } = await load()
  let url = ''
  const fetcher = async u => { url = u; return new Response(JSON.stringify(cidadesChuva.map(() => dia([20, 21, 22], [5, 60, 10])))) }
  const r = await buscarPrevisoes(cidadesChuva, { fetcher })
  assert.match(url, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=-30\.035,-29\.467,-27\.595,-25\.428&longitude=/)
  assert.match(url, /daily=temperature_2m_max,precipitation_sum&timezone=America%2FSao_Paulo&forecast_days=3/)
  assert.doesNotMatch(url, /apikey|key=/i)
  assert.equal(r.length, 4)
  assert.equal(r[0].cidade.nome, 'Porto Alegre')
})

test('a single city answer (object) also works, and wrong shapes fail clearly', async () => {
  const { buscarPrevisoes, cidadesCalor } = await load()
  const um = await buscarPrevisoes([cidadesCalor[0]], { fetcher: async () => new Response(JSON.stringify(dia([36, 37, 35], [0, 0, 0]))) })
  assert.equal(um[0].maximas[1], 37)
  await assert.rejects(buscarPrevisoes(cidadesCalor, { fetcher: async () => new Response('[]') }), /inesperada/)
  await assert.rejects(buscarPrevisoes(cidadesCalor, { fetcher: async () => new Response('x', { status: 500 }) }), /indisponível/)
})

test('levels follow the prototype criteria: 35 °C heat and 50 mm rain', async () => {
  const { nivelCalor, nivelChuva, picoMaxima, picoChuva, totalChuva, formatarGraus, formatarMm } = await load()
  assert.equal(nivelCalor(35), 'alto'); assert.equal(nivelCalor(33), 'atencao'); assert.equal(nivelCalor(30), 'normal'); assert.equal(nivelCalor(null), 'normal')
  assert.equal(nivelChuva(50), 'alto'); assert.equal(nivelChuva(25), 'atencao'); assert.equal(nivelChuva(3), 'normal')
  const p = { cidade: {}, dias: [], maximas: [31, NaN, 36.4], chuvas: [5, 60.2, null] }
  assert.equal(picoMaxima(p), 36.4); assert.equal(picoChuva(p), 60.2); assert.equal(Math.round(totalChuva(p)), 65)
  assert.equal(formatarGraus(36.4), '36 °C'); assert.equal(formatarMm(null), '—')
})

test('panel cites sources and says it is not an official alert; IA page shows it', () => {
  const panel = source('features/climate/ClimatePanel.tsx')
  assert.match(panel, /CPTEC\/INPE/)
  assert.match(panel, /Open-Meteo/)
  assert.match(panel, /não são alertas oficiais/)
  assert.match(source('features/climate/ClimatePage.tsx'), /<ClimatePanel \/>/)
  assert.doesNotMatch(source('features/intelligence/IntelligencePage.tsx'), /ClimatePanel/)
})

async function loadWorld() {
  const js = ts.transpileModule(source('features/climate/globalWeather.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

test('rain radar uses the latest RainViewer frame and only https tiles', async () => {
  const { buscarRadar, RADAR_COR_TV } = await loadWorld()
  const corpo = { host: 'https://tilecache.rainviewer.com', radar: { past: [{ time: 1000, path: '/v2/radar/1000' }, { time: 1600, path: '/v2/radar/1600' }] } }
  const r = await buscarRadar({ fetcher: async () => new Response(JSON.stringify(corpo)) })
  assert.equal(r.tileUrl(RADAR_COR_TV), 'https://tilecache.rainviewer.com/v2/radar/1600/256/{z}/{x}/{y}/4/1_1.png')
  assert.equal(r.horario.getTime(), 1600 * 1000)
  await assert.rejects(buscarRadar({ fetcher: async () => new Response(JSON.stringify({ ...corpo, host: 'http://evil' })) }), /inesperado/)
})

test('global alerts come from our API and errors show its message', async () => {
  const { buscarAlertasGlobais, dataCurta } = await loadWorld()
  let url = ''
  const r = await buscarAlertasGlobais({ baseUrl: 'https://x.test/', fetcher: async u => { url = u; return new Response(JSON.stringify({ estado: 'sucesso', alertas: [{ id: 'a' }] })) } })
  assert.equal(url, 'https://x.test/api/v1/alerts/global')
  assert.equal(r.alertas.length, 1)
  await assert.rejects(buscarAlertasGlobais({ fetcher: async () => new Response(JSON.stringify({ alertas: [], error: { message: 'GDACS fora' } }), { status: 503 }) }), /GDACS fora/)
  assert.equal(dataCurta('2026-10-09T00:00:00'), '09/10')
  assert.equal(dataCurta(null), '—')
})

test('world map is on the IA page and cites RainViewer and GDACS', () => {
  const w = source('features/climate/WorldWeather.tsx')
  assert.match(w, /RainViewer/); assert.match(w, /GDACS/); assert.match(w, /não substituem os avisos da Defesa Civil/)
  assert.match(source('features/climate/ClimatePage.tsx'), /<WorldWeather \/>/)
  assert.match(source('app/App.tsx'), /<Route path="\/clima" element={<ClimatePage \/>} \/>/)
  assert.match(source('features/climate/ClimatePage.tsx'), /Nenhum dado desta tela é simulado/)
})

test('screens open with real NASA data; simulation only via "Modo demonstração"', () => {
  assert.match(source('features/nasa/NasaSession.tsx'), /useState<'simulation' \| 'nasa'>\('nasa'\)/)
  const panel = source('features/nasa/NasaEventsPanel.tsx')
  assert.match(panel, />Modo demonstração<\/Button>/)
  assert.match(panel, />Dados reais \(NASA\)<\/Button>/)
})
