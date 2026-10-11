import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')
const page = source('features/intelligence/IntelligencePage.tsx')
const app = source('app/App.tsx')

async function loadClient() {
  const js = ts.transpileModule(source('features/intelligence/intelligence.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

test('IA route renders the real page instead of the reserved placeholder', () => {
  assert.match(app, /<Route path="\/inteligencia" element={<IntelligencePage \/>} \/>/)
  assert.match(app, /'\/abrigos', '\/inteligencia'\]\.includes/)
})

test('client posts the question and profile and surfaces API error messages', async () => {
  const { ask, getStatus, IntelligenceError } = await loadClient()
  const calls = []
  const ok = async (url, init) => { calls.push([url, init]); return new Response(JSON.stringify({ modo: 'ia', trechos: [] }), { status: 200 }) }
  await ask('Como evacuar?', 'comunidade', { baseUrl: 'https://x.test/', fetcher: ok })
  assert.equal(calls[0][0], 'https://x.test/api/v1/intelligence/ask')
  assert.equal(calls[0][1].method, 'POST')
  assert.deepEqual(JSON.parse(calls[0][1].body), { pergunta: 'Como evacuar?', perfil: 'comunidade' })
  const busy = async () => new Response(JSON.stringify({ error: { code: 'preparing', message: 'Preparando a base' } }), { status: 503 })
  await assert.rejects(getStatus({ baseUrl: 'https://x.test', fetcher: busy }), e => e instanceof IntelligenceError && e.code === 'preparing' && e.message === 'Preparando a base')
})

test('citation and status texts show PDF, page and progress', async () => {
  const { citacao, estadoTexto } = await loadClient()
  assert.equal(citacao({ fonte: 'brumadinho.pdf', pagina: 179, paginaFim: 180 }), 'brumadinho.pdf, pág. 179-180')
  assert.equal(citacao({ fonte: 'a.pdf', pagina: 3, paginaFim: 3 }), 'a.pdf, pág. 3')
  assert.match(estadoTexto({ estado: 'pronto', trechos: 1239, prontos: 1239, paginas: 693, documentos: [1, 2, 3, 4, 5].map(n => ({ fonte: `${n}`, paginas: 1 })), iaConfigurada: true }), /5 documentos oficiais · 693 páginas · 1\.239 trechos/)
  assert.match(estadoTexto({ estado: 'preparando', trechos: 1239, prontos: 270, paginas: 0, documentos: [], iaConfigurada: true }), /270 de 1\.239/)
})

test('page keeps the human in charge and shows where each answer came from', () => {
  assert.match(page, /o humano decide/)
  assert.match(page, /De onde veio/)
  assert.match(page, /citacao\(t\)/)
  assert.doesNotMatch(page, /rota segura|garantid|previs(ã|a)o certeira/i)
})
