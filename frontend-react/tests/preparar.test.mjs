import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { itensDoKit, progresso } from '../src/features/preparar/kit.ts'
import { direcao, distanciaKm, escolherParaGuardar, guardarLocais, lerLocais, locaisAPartirDe, rumo } from '../src/features/preparar/locaisSalvos.ts'
import { guias, numerosPorPais } from '../src/features/preparar/conteudo.ts'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('kit: 4 litros de água por pessoa por dia e itens da família', () => {
  const kit = itensDoKit(3, 10, { bebe: true })
  assert.match(kit.find(i => i.id === 'agua').texto, /^120 litros/)
  assert.match(kit.find(i => i.id === 'comida').texto, /^90 refeições/)
  assert.ok(kit.some(i => i.id === 'dinheiro'), 'dinheiro em espécie')
  assert.ok(kit.some(i => i.id === 'bebe'))
  assert.ok(!kit.some(i => i.id === 'pet'))
  assert.deepEqual(progresso(kit, new Set(['agua', 'comida'])), { feitos: 2, total: kit.length, pct: Math.round(200 / kit.length) })
})

test('direção e distância pelo GPS, sem internet', () => {
  const casa = { latitude: -23.5, longitude: -46.45 }
  const norte = { latitude: -23.49, longitude: -46.45 }
  assert.ok(Math.abs(distanciaKm(casa, norte) - 1.11) < 0.02)
  assert.equal(direcao(rumo(casa, norte)).texto, 'norte')
  assert.equal(direcao(rumo(casa, { latitude: -23.5, longitude: -46.44 })).texto, 'leste')
  assert.equal(direcao(225).texto, 'sudoeste')
})

test('guarda os mais próximos de cada tipo e reordena a partir de onde a pessoa está', () => {
  const lugar = (id, category, lat, distanceKm) => ({ id, name: id, category, categoryLabel: category, coordinates: { latitude: lat, longitude: -46.45 }, distanceKm, address: null, osmUrl: 'https://www.openstreetmap.org/node/' + id })
  const itens = [lugar('h1', 'hospital', -23.49, 1.1), lugar('i1', 'worship', -23.51, 1.1), lugar('b1', 'lodging', -23.5, 0.1)]
  const dados = escolherParaGuardar(itens, { latitude: -23.5, longitude: -46.45 }, 'Casa', new Date('2026-11-03T12:00:00Z'))
  assert.deepEqual(dados.itens.map(p => p.id), ['h1', 'i1'], 'hospedagem não entra no modo offline')
  const memoria = new Map()
  const fake = { setItem: (k, v) => memoria.set(k, v), getItem: k => memoria.get(k) ?? null }
  assert.equal(guardarLocais(dados, fake), true)
  const lidos = lerLocais(fake)
  const ordem = locaisAPartirDe(lidos, { latitude: -23.515, longitude: -46.45 })
  assert.equal(ordem[0].id, 'i1')
  assert.equal(ordem[0].direcao.texto, 'norte')
})

test('guias de guerra, nuclear, apagão e emoções, sempre com fonte', () => {
  for (const id of ['nuclear', 'guerra', 'apagao', 'enchente', 'socorros', 'emocional', 'bateria']) {
    const g = guias.find(x => x.id === id)
    assert.ok(g, id)
    assert.ok(g.passos.length >= 5, id)
    assert.match(g.fonte.url, /^https:\/\//)
  }
  assert.match(guias.find(g => g.id === 'nuclear').passos.join(' '), /24 horas/)
  assert.ok(numerosPorPais.some(p => p.pais === 'Peru') && numerosPorPais.some(p => p.pais === 'Paraguai'))
})

test('service worker e manifest: app abre sem internet, sem guardar dados pessoais', () => {
  const sw = source('public/sw.js')
  assert.match(sw, /\/preparar/)
  assert.match(sw, /\/api\/v1\/places\//)
  assert.doesNotMatch(sw, /\/api\/v1\/(cadastros|alert)/)
  assert.match(source('src/main.tsx'), /import\.meta\.env\.PROD && 'serviceWorker' in navigator/)
  const manifest = JSON.parse(source('public/manifest.webmanifest'))
  assert.equal(manifest.start_url, '/preparar')
  assert.match(source('index.html'), /rel="manifest"/)
  assert.match(source('src/app/App.tsx'), /path="\/preparar"/)
})

test('rotas que funcionam sem internet: Apple Mapas, Organic Maps e mapa padrão do Android', async () => {
  const { rotasOffline } = await import('../src/features/preparar/locaisSalvos.ts')
  const r = rotasOffline({ latitude: -23.5, longitude: -46.45 }, 'Capela Vila Jacuí')
  assert.match(r.apple, /^maps:\/\/\?daddr=-23\.5%2C-46\.45&dirflg=w$/)
  assert.match(r.organic, /^om:\/\/map\?v=1&ll=-23\.5%2C-46\.45&n=Capela%20Vila%20Jacu%C3%AD$/)
  assert.match(r.geo, /^geo:-23\.5,-46\.45\?q=/)
  assert.match(source('src/features/citizen/useNearbySearch.ts'), /navigator\.onLine === false/)
})
