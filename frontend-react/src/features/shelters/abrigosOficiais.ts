// Abrigos oficiais da Defesa Civil: a gestão cadastra (com o código do operador) e o cidadão vê primeiro.
import type { Coordinates } from './places'

export type TipoOficial = 'abrigo' | 'ponto_encontro' | 'area_risco'
export type StatusOficial = 'aberto' | 'lotado' | 'fechado'
export type LocalOficial = {
  id: number; tipo: TipoOficial; tipoNome: string; nome: string; endereco: string | null
  latitude: number; longitude: number; status: StatusOficial; capacidade: number | null
  raioM: number | null; observacao: string | null; atualizadoEm: string; distanciaKm?: number
}
export type NovoLocal = {
  tipo: TipoOficial; nome: string; endereco?: string; latitude: number; longitude: number
  status: StatusOficial; capacidade?: number | null; raioM?: number | null; observacao?: string
}
type Options = { baseUrl?: string; signal?: AbortSignal; fetcher?: typeof fetch }

export const TIPOS_OFICIAIS: { id: TipoOficial; nome: string; emoji: string }[] = [
  { id: 'abrigo', nome: 'Abrigo', emoji: '🏠' },
  { id: 'ponto_encontro', nome: 'Ponto de encontro / rota de fuga', emoji: '🚩' },
  { id: 'area_risco', nome: 'Área de risco', emoji: '⚠️' },
]
export const STATUS_OFICIAL: Record<StatusOficial, { nome: string; cor: string; fundo: string }> = {
  aberto: { nome: 'Aberto', cor: '#087f65', fundo: '#e6f7f1' },
  lotado: { nome: 'Lotado', cor: '#ba5a09', fundo: '#fff3e5' },
  fechado: { nome: 'Fechado', cor: '#b42318', fundo: '#fdecec' },
}

async function chamar(caminho: string, init: RequestInit, options: Options) {
  const base = (options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
  const tempo = AbortSignal.timeout(15_000)
  const signal = options.signal ? AbortSignal.any([options.signal, tempo]) : tempo
  const response = await (options.fetcher ?? fetch)(`${base}/api/v1/abrigos-oficiais${caminho}`, {
    ...init, signal, cache: 'no-store', headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  })
  const corpo = await response.json().catch(() => null)
  if (!response.ok || !corpo) throw new Error(corpo?.error?.message ?? 'Cadastro de abrigos indisponível agora. Tente de novo em instantes.')
  return corpo
}

export async function listarOficiais(perto?: Coordinates, raioKm?: number, options: Options = {}): Promise<LocalOficial[]> {
  const q = perto ? `?${new URLSearchParams({ lat: String(perto.latitude), lon: String(perto.longitude), ...(raioKm ? { raioKm: String(raioKm) } : {}) })}` : ''
  const corpo = await chamar(q, { method: 'GET' }, options)
  return Array.isArray(corpo.itens) ? corpo.itens as LocalOficial[] : []
}
export function criarOficial(dados: NovoLocal, codigo: string, options: Options = {}): Promise<LocalOficial> {
  return chamar('', { method: 'POST', body: JSON.stringify({ ...dados, codigo }) }, options)
}
export function mudarStatusOficial(id: number, status: StatusOficial, codigo: string, options: Options = {}): Promise<LocalOficial> {
  return chamar(`/${id}/status`, { method: 'POST', body: JSON.stringify({ status, codigo }) }, options)
}
export function removerOficial(id: number, codigo: string, options: Options = {}): Promise<{ ok: true }> {
  return chamar(`/${id}/remover`, { method: 'POST', body: JSON.stringify({ codigo }) }, options)
}
