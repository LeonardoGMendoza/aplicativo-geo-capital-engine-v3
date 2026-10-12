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
  const ok = async (url, init) => { chamada = { url, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ ok: true, nivel: 'MONITORAR', previa: '🚨 AVISO…', mensagem: 'Alerta enviado (nível MONITORAR). Confira o WhatsApp.' })) }
  const r = await enviarWhatsApp({ codigo: 'segredo123', destino: '(51) 99999-1234', local: 'Vila', evento: 'Fogo', publico: 'comunidade', km: 372, observadoEm: '2024-09-12T19:00:00Z', categoria: 'Wildfires' }, { baseUrl: 'https://api.test', fetcher: ok })
  assert.equal(chamada.url, 'https://api.test/api/v1/alertas/whatsapp')
  assert.deepEqual(chamada.body, { origem: 'NASA EONET', codigo: 'segredo123', destino: '(51) 99999-1234', local: 'Vila', evento: 'Fogo', publico: 'comunidade', km: 372, observadoEm: '2024-09-12T19:00:00Z', categoria: 'Wildfires', recomendacao: null })
  assert.match(r.mensagem, /Confira o WhatsApp/); assert.equal(r.nivel, 'MONITORAR'); assert.equal(r.previa, '🚨 AVISO…')
  const negado = async () => new Response(JSON.stringify({ error: { message: 'Código do operador incorreto.' } }), { status: 403 })
  await assert.rejects(enviarWhatsApp({ codigo: 'x', destino: '1', local: '', evento: '', publico: 'empresa', km: 1, observadoEm: null }, { baseUrl: 'https://api.test', fetcher: negado }), /Código do operador incorreto/)
})

test('corporate and community screens show the action panel when there is a NASA match', () => {
  const corp = source('features/corporate/components/CorporateAssetDetails.tsx'), com = source('features/community/CommunityPage.tsx')
  assert.match(corp, /\{match && <AlertActions [^\n]*perfil="empresa"[^\n]*observadoEm=\{match.event.observedAt\}/)
  assert.match(com, /\{asset && match && <AlertActions [^\n]*perfil="comunidade"[^\n]*observadoEm=\{match.event.observedAt\}/)
  const painel = source('features/alerts/AlertActions.tsx')
  for (const t of ['Decisão RAG (IA)', 'ENVIAR ORDEM DE BLOQUEIO (simulação)', 'ACIONAR LIDERANÇAS E ONGS (simulação)', 'ENVIAR ESTE ALERTA POR WHATSAPP', 'Código do operador']) assert.ok(painel.includes(t), t)
})
