import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gerarQr, caminhoSvg } from '../src/features/citizen/qr.ts'
import { celularValido, cepValido, formatarCelular, formatarCep, origemDaUrl, cadastrar, buscarResumo } from '../src/features/citizen/cadastroAlertas.ts'

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')

test('QR code: size grows with the text and has the three finder squares', () => {
  const m = gerarQr('https://omni.sandlj.com.br/cidadao?origem=qr', 'Q')
  assert.equal(m.length, 4 * 4 + 17, 'versão 4 para este link no nível Q (44 caracteres)')
  const n = m.length
  for (const [x0, y0] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    for (let i = 0; i < 7; i++) {
      assert.ok(m[y0][x0 + i] && m[y0 + 6][x0 + i] && m[y0 + i][x0] && m[y0 + i][x0 + 6], 'borda do quadrado')
      assert.ok(m[y0 + 3][x0 + 3], 'centro do quadrado')
    }
  }
  assert.equal(m[n - 8][8], true, 'módulo escuro fixo')
  assert.throws(() => gerarQr('x'.repeat(400)), /grande demais/)
  const { d, tamanho } = caminhoSvg(m)
  assert.equal(tamanho, n + 8); assert.match(d, /^M\d+ \d+h1v1h-1z/)
})

test('signup validation matches the API rules', () => {
  for (const c of ['(51) 99999-1234', '+55 51 99999-1234', '51999991234']) assert.ok(celularValido(c), c)
  for (const c of ['(51) 3333-1234', '(00) 99999-1234', '(51) 99999-999', '(51) 99999-9999']) assert.ok(!celularValido(c), c)
  assert.ok(cepValido('90010-150')); assert.ok(!cepValido('00000-000')); assert.ok(!cepValido('9001'))
  assert.equal(formatarCelular('51999991234'), '(51) 99999-1234')
  assert.equal(formatarCelular('+5551999991234'), '(51) 99999-1234')
  assert.equal(formatarCep('90010150'), '90010-150')
  assert.equal(origemDaUrl('?origem=qr'), 'qr'); assert.equal(origemDaUrl('?origem=x'), 'site')
})

test('signup posts only to our API and shows the API message on error', async () => {
  let chamada
  const fetcher = async (url, init) => { chamada = { url, init }; return new Response(JSON.stringify({ ok: true, atualizado: false, celular: '(51) 9****-1234', cep: '90010-150' })) }
  const r = await cadastrar({ celular: '(51) 99999-1234', cep: '90010-150', nome: '  ', aceite: true, origem: 'qr' }, { baseUrl: 'https://api.test', fetcher })
  assert.equal(chamada.url, 'https://api.test/api/v1/cadastros'); assert.equal(chamada.init.method, 'POST')
  assert.deepEqual(JSON.parse(chamada.init.body), { celular: '(51) 99999-1234', cep: '90010-150', nome: null, aceite: true, origem: 'qr' })
  assert.equal(r.celular, '(51) 9****-1234')
  const erro = async () => new Response(JSON.stringify({ error: { message: 'Muitas tentativas. Tente de novo mais tarde.' } }), { status: 429 })
  await assert.rejects(buscarResumo({ baseUrl: 'https://api.test', fetcher: erro }), /Muitas tentativas/)
})

test('citizen page has the WhatsApp signup with consent, and the central has the QR page in the menu', () => {
  const card = source('features/citizen/AlertsSignup.tsx')
  assert.match(card, /type="checkbox"/); assert.match(card, /só para enviar alertas/); assert.match(card, /Parar de receber/)
  assert.doesNotMatch(card, /Defesa Civil/, 'sem usar o nome da Defesa Civil no cadastro sem autorização')
  assert.match(source('features/citizen/CitizenPage.tsx'), /<AlertsSignup \/>/)
  assert.match(source('app/App.tsx'), /<Route path="\/qrcode" element={<QrPage \/>} \/>/)
  assert.match(source('features/citizen/QrPage.tsx'), /\/cidadao\?origem=qr/)
})
