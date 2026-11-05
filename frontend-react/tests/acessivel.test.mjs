import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')

test('Modo acessível: rota fora do painel da central e atalho na Área do cidadão', () => {
  const app = source('app/App.tsx')
  const layout = app.indexOf('<Route element={<NasaSessionProvider><AppLayout /></NasaSessionProvider>}>')
  const rota = app.indexOf('<Route path="/cidadao/acessivel" element={<ModoAcessivelPage />} />')
  assert.ok(rota > 0 && rota < layout)
  assert.match(source('features/citizen/CitizenPage.tsx'), /<CartaoAssistente \/>/)
  assert.match(source('features/acessivel/CartaoAssistente.tsx'), /to="\/cidadao\/acessivel"/)
})

test('responde sem internet com os guias guardados e lê em voz alta', () => {
  const pagina = source('features/acessivel/ModoAcessivel.tsx')
  assert.match(pagina, /navigator\.onLine === false/)
  assert.match(pagina, /responderComGuia\(guia\)/)
  assert.match(pagina, /webkitSpeechRecognition/)
  assert.match(pagina, /tel:199/)
  // palavras da pergunta falada -> guia certo
  const palavras = pagina.slice(pagina.indexOf('const PALAVRAS'), pagina.indexOf('/** Guia mais provável'))
  for (const [frase, guia] of [['a água está subindo na rua', 'enchente'], ['acabou a luz', 'apagao'], ['meu pai desmaiou', 'socorros'], ['estou com muito medo', 'emocional'], ['explodiu uma bomba', 'guerra'], ['vazou radiação da usina', 'nuclear']]) {
    const linha = palavras.split('\n').find(l => l.trim().startsWith(guia + ':'))
    const re = new RegExp(linha.slice(linha.indexOf('/') + 1, linha.lastIndexOf('/')), 'i')
    assert.ok(re.test(frase), `${frase} -> ${guia}`)
  }
})

test('assistente com rosto (Clara/Rafael): só no lado do cidadão e carregado sob demanda', async () => {
  const pagina = source('features/acessivel/ModoAcessivel.tsx')
  assert.match(pagina, /Só voz \(sem o rosto\)/)
  assert.match(pagina, /await import\('\.\/avatar'\)/, 'o 3D só baixa quando a pessoa liga')
  assert.doesNotMatch(pagina, /^import \{ Assistente \}/m)
  const avatar = source('features/acessivel/avatar.ts')
  assert.match(avatar, /\/api\/v1\/voz/)
  assert.match(avatar, /peloAparelho/, 'sem a voz da nuvem, usa a do celular')
  for (const f of ['features/oficiais/OficiaisSecao.tsx', 'features/operations/OperationsPage.tsx', 'components/layout/AppLayout.tsx']) assert.doesNotMatch(source(f), /talkinghead|avatar\.ts|Assistente\b/, `${f}: painel de gestão sem boneco`)
  const { tempos } = await import('../src/features/acessivel/avatar.ts').catch(() => ({}))
  if (tempos) assert.equal(tempos('Oi, tudo bem').words.length, 3)
})
