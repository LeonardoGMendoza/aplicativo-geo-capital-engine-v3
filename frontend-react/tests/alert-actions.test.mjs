import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { perguntaDoAlerta, enviarWhatsApp } from '../src/features/alerts/enviarAlerta.ts'

const source = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8')

test('the AI question fits the API limit and changes with the profile', () => {
  const a = { evento: 'Wildfire Jackson - Hwy 90', categoria: 'Wildfires', km: 163.9, ativo: 'Plataforma Chevron (Golfo do Mexico)', comunidade: 'Pescadores' }
  const empresa = perguntaDoAlerta(a, 'empresa'), comunidade = perguntaDoAlerta(a, 'comunidade')
  assert.match(empresa, /a 164 km de Plataforma Chevron/); assert.match(empresa, /operação/); assert.match(comunidade, /evacuação e abrigo/)
  assert.ok(perguntaDoAlerta({ ...a, evento: 'x'.repeat(400) }, 'empresa').length <= 300)
})

test('WhatsApp send goes only to our API, with the operator code, and shows the API error', async () => {
  let chamada
  const ok = async (url, init) => { chamada = { url, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ ok: true, mensagem: 'Alerta enviado ao n8n. Confira o WhatsApp.' })) }
  const msg = await enviarWhatsApp({ codigo: 'segredo123', destino: '(51) 99999-1234', local: 'Vila', evento: 'Fogo' }, { baseUrl: 'https://api.test', fetcher: ok })
  assert.equal(chamada.url, 'https://api.test/api/v1/alertas/whatsapp')
  assert.deepEqual(chamada.body, { origem: 'NASA EONET', codigo: 'segredo123', destino: '(51) 99999-1234', local: 'Vila', evento: 'Fogo', recomendacao: null })
  assert.match(msg, /Confira o WhatsApp/)
  const negado = async () => new Response(JSON.stringify({ error: { message: 'Código do operador incorreto.' } }), { status: 403 })
  await assert.rejects(enviarWhatsApp({ codigo: 'x', destino: '1', local: '', evento: '' }, { baseUrl: 'https://api.test', fetcher: negado }), /Código do operador incorreto/)
})

test('corporate and community screens show the action panel when there is a NASA match', () => {
  const corp = source('features/corporate/components/CorporateAssetDetails.tsx'), com = source('features/community/CommunityPage.tsx')
  assert.match(corp, /\{match && <AlertActions [^>]*perfil="empresa"/)
  assert.match(com, /\{asset && match && <AlertActions [^>]*perfil="comunidade"/)
  const painel = source('features/alerts/AlertActions.tsx')
  for (const t of ['Decisão RAG (IA)', 'ENVIAR ORDEM DE BLOQUEIO (simulação)', 'ACIONAR LIDERANÇAS E ONGS (simulação)', 'ENVIAR ESTE ALERTA POR WHATSAPP', 'Código do operador']) assert.ok(painel.includes(t), t)
})
