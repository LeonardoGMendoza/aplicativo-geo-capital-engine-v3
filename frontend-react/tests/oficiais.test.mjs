import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buscarOficiais, CHAVE_GUARDADO, seloCidade, emojiEvento, emojiTempo, fraseCidade, lerGuardado, quandoTexto, separar } from '../src/features/oficiais/oficiais.ts'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const alerta = (id, severidade, quando, regiao, extra = {}) => ({ id, fonte: 'INMET', fonteUrl: null, pais: 'Brasil', regiao, evento: 'Tempestade', eventoOriginal: null, severidade, quando, inicio: null, fim: null, area: null, titulo: null, descricao: null, instrucao: null, latitude: -27, longitude: -52, poligono: [[-26, -53], [-26, -52], [-27, -52]], link: null, ...extra })
const memoria = () => { const m = new Map(); return { m, setItem: (k, v) => m.set(k, v), getItem: k => m.get(k) ?? null } }

test('separa em "acontecendo agora" e "vem aí", com filtro de região e amarelos', () => {
  const lista = [alerta('a', 'severo', 'agora', 'brasil'), alerta('b', 'extremo', 'agora', 'americas'), alerta('c', 'moderado', 'agora', 'brasil'),
    alerta('d', 'severo', 'vem', 'europa', { inicio: '2026-11-07T00:00:00Z' }), alerta('e', 'extremo', 'vem', 'brasil', { inicio: '2026-11-06T00:00:00Z' })]
  const todos = separar(lista)
  assert.deepEqual(todos.agora.map(a => a.id), ['b', 'a'], 'mais grave primeiro e sem amarelo')
  assert.deepEqual(todos.vem.map(a => a.id), ['e', 'd'], 'o que começa antes primeiro')
  assert.deepEqual(separar(lista, 'americas').agora.map(a => a.id), ['b', 'a'], 'Américas inclui o Brasil')
  assert.deepEqual(separar(lista, 'brasil', true).agora.map(a => a.id), ['a', 'c'])
  assert.deepEqual(separar(lista, 'europa').agora, [])
})

test('ícones e frases simples', () => {
  assert.equal(emojiEvento('Tornado (alerta: está acontecendo)'), '🌪️')
  assert.equal(emojiEvento('Tempestade de neve'), '❄️')
  assert.equal(emojiEvento('Terremoto M6.8'), '〰️')
  assert.equal(emojiTempo(96), '⛈️')
  assert.equal(emojiTempo(0), '☀️')
  assert.match(quandoTexto({ quando: 'vem', inicio: '2026-11-07T15:00:00Z', fim: null }), /^Começa /)
  assert.equal(quandoTexto({ quando: 'agora', inicio: null, fim: null }), 'Em andamento')
  const cidade = { id: 'foz', nome: 'Foz', pais: 'Brasil', latitude: 0, longitude: 0, nivel: null, alertas: [], previsao: [] }
  assert.match(fraseCidade(cidade), /Sem alerta oficial/)
  assert.match(fraseCidade({ ...cidade, alertas: [{ id: 'x', evento: 'Vendaval', severidade: 'severo', quando: 'vem' }] }), /Vendaval \(vem aí\)/)
  assert.match(fraseCidade({ ...cidade, previsao: [{ data: '2026-11-06', nivel: 'extremo', motivos: ['Rajadas de até 95 km/h'], codigo: 99 }] }), /Rajadas de até 95 km\/h/)
})

test('selo diz se o perigo é aviso oficial ou só previsão', () => {
  assert.equal(seloCidade({ nivel: 'severo', nivelOficial: 'severo' }), 'Perigo · oficial')
  assert.equal(seloCidade({ nivel: 'severo', nivelOficial: 'moderado' }), 'Perigo · previsão')
  assert.equal(seloCidade({ nivel: null, nivelOficial: null }), 'Tranquilo')
})

test('guarda a última resposta e mostra sem internet', async () => {
  const armazem = memoria()
  const lugarResumo = id => ({ id, nome: id, pais: 'Brasil', latitude: 0, longitude: 0, nivel: null, alertas: [], previsao: [] })
  const resposta = { obtidoEm: '2026-11-05T12:00:00Z', fontes: [], alertas: [alerta('a', 'severo', 'agora', 'brasil')], lugares: [lugarResumo('foz'), lugarResumo('lima')] }
  const pedidos = []
  const ok = async (url, init) => { pedidos.push({ url, init }); return { ok: true, json: async () => resposta } }
  const meus = [{ id: 'foz', nome: 'Foz do Iguaçu', pais: 'Brasil', latitude: -25.5, longitude: -54.6 }, { id: 'lima', nome: 'Lima', pais: 'Peru', latitude: -12, longitude: -77 }]
  const r = await buscarOficiais(meus, { baseUrl: 'https://x', fetcher: ok, armazem })
  assert.equal(pedidos[0].url, 'https://x/api/v1/alerts/oficiais/lugares', 'os lugares não vão na URL')
  assert.equal(pedidos[0].init.method, 'POST')
  assert.equal(JSON.parse(pedidos[0].init.body).lugares.length, 2)
  assert.deepEqual(r.locaisPadrao, [])
  assert.equal(r.alertas.length, 1)
  assert.equal(JSON.parse(armazem.m.get(CHAVE_GUARDADO)).alertas[0].poligono, null, 'guarda sem polígono (mais leve)')
  const semRede = async () => { throw new TypeError('Failed to fetch') }
  const offline = await buscarOficiais(meus.slice(0, 1), { baseUrl: 'https://x', fetcher: semRede, armazem })
  assert.equal(offline.guardado, true)
  assert.deepEqual(offline.lugares.map(l => l.id), ['foz'], 'sem internet mostra só os lugares que ainda estão na lista')
  assert.equal(lerGuardado(memoria()), null)
  await assert.rejects(buscarOficiais([], { baseUrl: 'https://x', fetcher: semRede, armazem: memoria() }))
})

test('página própria "Alertas oficiais" no menu; o Mapa de Riscos volta a ser o original', () => {
  const risco = source('src/features/nasa/RiskMapPage.tsx')
  assert.doesNotMatch(risco, /OficiaisSecao/)
  assert.match(risco, /Explorador geográfico · eventos catalogados não confirmam risco local\./)
  assert.match(source('src/app/App.tsx'), /path="\/alertas-oficiais" element={<AlertasOficiaisPage \/>}/)
  assert.match(source('src/app/navigation.ts'), /'\/alertas-oficiais', label: 'Alertas oficiais'/)
  const secao = source('src/features/oficiais/OficiaisSecao.tsx')
  for (const t of [/Meus lugares/, /Locais monitorados/, /Em vigor/, /Próximos dias/, /Avisos em vigor por estado/, /Ouvir alerta/, /199/]) assert.match(secao, t)
  assert.doesNotMatch(secao + source('src/features/oficiais/OficiaisMapa.tsx'), /[🏠🌪️⛈️🌧️❄️🔥]/u, 'visual profissional: sem emojis')
  assert.doesNotMatch(source('src/features/oficiais/oficiais.ts'), /Tarapoto|Iquitos|Utah/)
})

test('tabela por estado: nível mais alto de cada tipo, estados com aviso primeiro', async () => {
  const { tabelaPorEstado, tipoDoAlerta } = await import('../src/features/oficiais/oficiais.ts')
  assert.equal(tipoDoAlerta('Tempestade'), 'tempestade')
  assert.equal(tipoDoAlerta('Tempestade de neve'), 'frio')
  assert.equal(tipoDoAlerta('Acumulado de Chuva'), 'chuva')
  assert.equal(tipoDoAlerta('Vendaval'), 'vento')
  assert.equal(tipoDoAlerta('Baixa Umidade'), 'calor')
  assert.equal(tipoDoAlerta('Declínio de Temperatura'), 'frio')
  const linhas = tabelaPorEstado([
    alerta('a', 'moderado', 'agora', 'brasil', { evento: 'Tempestade', ufs: ['PR', 'SC'] }),
    alerta('b', 'extremo', 'agora', 'brasil', { evento: 'Tempestade', ufs: ['SC'] }),
    alerta('c', 'severo', 'agora', 'brasil', { evento: 'Vendaval', ufs: ['SC'] }),
  ])
  assert.equal(linhas.length, 27)
  assert.deepEqual(linhas.slice(0, 2).map(l => l.uf), ['SC', 'PR'])
  assert.deepEqual(linhas[0].tipos, { tempestade: 'extremo', vento: 'severo' })
  assert.equal(linhas[1].max, 'moderado')
  assert.equal(linhas[2].max, null)
})

test('"Ouvir alerta": frase curta em português, espanhol e inglês', async () => {
  const { fraseDoAlerta, fraseDoLugar, eventoNoIdioma } = await import('../src/features/oficiais/voz.ts')
  const a = { evento: 'Tempestade', severidade: 'severo', quando: 'agora', inicio: null, fim: null, area: 'PR: Foz do Iguaçu - PR (4108304)', instrucao: 'Não se abrigue debaixo de árvores. Evite usar aparelhos ligados na tomada. Outra.', pais: 'Brasil' }
  const pt = fraseDoAlerta(a, 'pt', 'Foz do Iguaçu')
  assert.match(pt, /^Aviso de tempestade, nível perigo, em Foz do Iguaçu\./)
  assert.match(pt, /Não se abrigue debaixo de árvores\. Evite usar aparelhos ligados na tomada\./)
  assert.doesNotMatch(pt, /Outra/)
  assert.match(fraseDoAlerta(a, 'es', 'Foz'), /^Alerta de tormenta, nivel peligro, en Foz\./)
  assert.match(fraseDoAlerta(a, 'en', 'Foz'), /^Thunderstorm alert, danger level, in Foz\./)
  assert.equal(eventoNoIdioma('Tempestade de neve', 'en'), 'winter storm')
  const lugar = { id: 'l', nome: 'Lima', pais: 'Peru', latitude: 0, longitude: 0, nivel: null, alertas: [], previsao: [] }
  assert.match(fraseDoLugar(lugar, 'pt'), /Lima: sem alertas oficiais/)
  assert.match(fraseDoLugar(lugar, 'es'), /Lima: sin alertas oficiales/)
})
