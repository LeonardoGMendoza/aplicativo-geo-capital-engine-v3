import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')

test('Modo acessível: rota fora do painel da central e atalho na Área do cidadão', () => {
  const app = source('app/App.tsx')
  const layout = app.indexOf('<Route element={<NasaSessionProvider><AppLayout /></NasaSessionProvider>}>')
  const rota = app.indexOf('<Route path="/cidadao/acessivel" element={<ModoAcessivelPage />} />')
  assert.ok(rota > 0 && rota < layout)
  assert.match(source('features/citizen/CitizenPage.tsx'), /to="\/cidadao\/acessivel"/)
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
