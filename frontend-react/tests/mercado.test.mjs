import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buscarMercado, formatarPreco, formatarVariacao, pontosDaLinha } from '../src/features/corporate/mercado.ts'

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')

test('market quotes come only from our API (Yahoo behind it) and errors show the API message', async () => {
  let pedida = ''
  const ok = await buscarMercado({ baseUrl: 'https://api.test/', fetcher: async url => { pedida = String(url); return { ok: true, json: async () => ({ fonte: 'Yahoo Finance', empresas: [{ ticker: 'VALE', ok: true, preco: 13.56 }] }) } } })
  assert.equal(pedida, 'https://api.test/api/v1/mercado'); assert.equal(ok.empresas[0].ticker, 'VALE')
  await assert.rejects(buscarMercado({ baseUrl: 'x', fetcher: async () => ({ ok: false, json: async () => ({ empresas: [], error: { message: 'Cotações (Yahoo Finance) indisponíveis agora.' } }) }) }), /Yahoo Finance/)
})

test('price, change and sparkline formatting', () => {
  assert.equal(formatarPreco(1234.5, 'USD'), 'US$ 1.234,50')
  assert.equal(formatarPreco(0.38, 'BRL'), 'R$ 0,38')
  assert.equal(formatarVariacao(1.234), '+1,23%'); assert.equal(formatarVariacao(-0.5), '-0,50%'); assert.equal(formatarVariacao(null), '—')
  assert.equal(pontosDaLinha([1]), '')
  const p = pontosDaLinha([10, 20, 15], 96, 28).split(' ')
  assert.equal(p.length, 3); assert.equal(p[0], '0.0,26.0'); assert.equal(p[1], '48.0,2.0')
})

test('Visão Corporativa shows the market panel next to NASA events, without claiming cause, not investment advice', () => {
  assert.match(source('features/corporate/CorporatePage.tsx'), /<AssistenteRisco perfil="empresa" \/>\r?\n\s*<MercadoPainel \/>/)
  const painel = source('features/corporate/MercadoPainel.tsx')
  assert.match(painel, /useAlertasAtivos\(\)/); assert.match(painel, /Não é recomendação de investimento/); assert.match(painel, /sem afirmar que um causou o outro/)
})
