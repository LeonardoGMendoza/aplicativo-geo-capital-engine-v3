// Cotações das empresas dos ativos de referência, pela nossa API (que consulta o Yahoo Finance).
type Options = { baseUrl?: string; signal?: AbortSignal; fetcher?: typeof fetch }

export type Empresa = {
  nome: string; ticker: string; setor: string; ativos: string[]; ok: boolean
  preco?: number; moeda?: string; variacaoDia?: number | null; variacaoMes?: number | null; serie?: number[]; horario?: number | null
}
export type RespostaMercado = { fonte: string; fonteUrl: string; obtidoEm: number; antigo: boolean; empresas: Empresa[] }

export async function buscarMercado(options: Options = {}): Promise<RespostaMercado> {
  const base = (options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
  const response = await (options.fetcher ?? fetch)(`${base}/api/v1/mercado`, { signal: options.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
  const corpo = await response.json().catch(() => null)
  if (!response.ok || !corpo || !Array.isArray(corpo.empresas)) throw new Error(corpo?.error?.message ?? 'Cotações indisponíveis agora.')
  return corpo as RespostaMercado
}

export function formatarPreco(valor: number, moeda = 'USD') {
  const simbolo = moeda === 'BRL' ? 'R$' : moeda === 'USD' ? 'US$' : moeda
  return `${simbolo} ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatarVariacao(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

/** Pontos da linha pequena (sparkline) num quadro largura × altura. */
export function pontosDaLinha(serie: number[], largura = 96, altura = 28) {
  if (serie.length < 2) return ''
  const min = Math.min(...serie), max = Math.max(...serie), faixa = max - min || 1
  return serie.map((v, i) => `${((i / (serie.length - 1)) * largura).toFixed(1)},${(altura - 2 - ((v - min) / faixa) * (altura - 4)).toFixed(1)}`).join(' ')
}
