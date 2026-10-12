// Cadastro mínimo do cidadão para alertas no WhatsApp (entrada pelo QR code).
// Os dados vão só para a nossa API, no nosso servidor. O site nunca mostra a lista de telefones.
export type Cadastro = { celular: string; cep: string; nome?: string; aceite: boolean; origem: 'qr' | 'site' }
export type Confirmacao = { ok: true; atualizado: boolean; celular: string; cep: string }
export type Resumo = { total: number; peloQr: number }
type Options = { baseUrl?: string; signal?: AbortSignal; fetcher?: typeof fetch }

const so = (t: string) => t.replace(/\D/g, '')

/** Mesmas regras da API: celular com DDD (11 números, começando com 9), aceita +55. */
export function celularValido(texto: string) {
  let d = so(texto)
  if (d.length === 13 && d.startsWith('55')) d = d.slice(2)
  return d.length === 11 && Number(d.slice(0, 2)) >= 11 && d[1] !== '0' && d[2] === '9' && new Set(d.slice(2)).size > 1
}
export const cepValido = (texto: string) => { const d = so(texto); return d.length === 8 && new Set(d).size > 1 }

/** Formata enquanto a pessoa digita: (51) 99999-1234 e 90010-150. */
export function formatarCelular(texto: string) {
  const d = so(texto).replace(/^55(?=\d{11})/, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
export function formatarCep(texto: string) { const d = so(texto).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d }

/** De onde a pessoa veio: ?origem=qr no link do QR code. */
export const origemDaUrl = (busca: string): 'qr' | 'site' => (new URLSearchParams(busca).get('origem') === 'qr' ? 'qr' : 'site')

async function chamar(caminho: string, init: RequestInit, options: Options) {
  const base = (options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000)
  const response = await (options.fetcher ?? fetch)(`${base}/api/v1/cadastros${caminho}`, { ...init, signal, cache: 'no-store', headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) } })
  const corpo = await response.json().catch(() => null)
  if (!response.ok) throw new Error(corpo?.error?.message ?? 'Não foi possível concluir agora. Tente de novo em instantes.')
  return corpo
}

export function cadastrar(dados: Cadastro, options: Options = {}): Promise<Confirmacao> {
  return chamar('', { method: 'POST', body: JSON.stringify({ ...dados, nome: dados.nome?.trim() || null }) }, options)
}
export function sair(dados: { celular: string; cep: string }, options: Options = {}): Promise<{ ok: true }> {
  return chamar('/sair', { method: 'POST', body: JSON.stringify(dados) }, options)
}
export function buscarResumo(options: Options = {}): Promise<Resumo> {
  return chamar('/resumo', { method: 'GET' }, options)
}
