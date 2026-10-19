// Detalhes de um alerta do GDACS (ONU / Comissão Europeia), buscados pela nossa API para mostrar dentro do Omni.

export type PopulacaoExposta = { chave: string; rotulo: string; valor: number }
export type DetalhesGdacs = {
  estado: 'sucesso' | 'antigo'
  fonte: string
  fonteUrl: string
  obtidoEm: string
  tipo: string
  nome: string | null
  nivel: 'vermelho' | 'laranja' | 'verde' | null
  pontuacao: number | null
  inicio: string | null
  fim: string | null
  severidade: string | null
  paises: string[]
  populacao: PopulacaoExposta[]
  /** GeoJSON FeatureCollection simplificada (properties.classe = camada do GDACS). */
  area: { type: 'FeatureCollection'; features: unknown[] } | null
}
type Options = { baseUrl?: string; signal?: AbortSignal; fetcher?: typeof fetch }

/** O id dos itens do GDACS é "gdacs-<TIPO>-<eventid>-<episodeid>". Devolve null para itens de outras fontes. */
export function idGdacs(itemId: string): { tipo: string; eventid: string; episodeid: string } | null {
  const m = /^gdacs-([A-Z]{2})-(\d+)-(\w+)$/.exec(itemId)
  if (!m) return null
  return { tipo: m[1], eventid: m[2], episodeid: /^\d+$/.test(m[3]) ? m[3] : '' }
}

export async function buscarDetalhesGdacs(itemId: string, options: Options = {}): Promise<DetalhesGdacs> {
  const id = idGdacs(itemId)
  if (!id) throw new Error('Alerta sem detalhes do GDACS.')
  const base = (options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
  const query = new URLSearchParams({ tipo: id.tipo, eventid: id.eventid, ...(id.episodeid ? { episodeid: id.episodeid } : {}) })
  const tempo = AbortSignal.timeout(35_000) // a API consulta até 3 endereços do GDACS
  const signal = options.signal ? AbortSignal.any([options.signal, tempo]) : tempo
  const response = await (options.fetcher ?? fetch)(`${base}/api/v1/alerts/global/details?${query}`, { signal, cache: 'no-store', headers: { Accept: 'application/json' } })
  const corpo = await response.json().catch(() => null)
  if (!response.ok || !corpo || (corpo.estado !== 'sucesso' && corpo.estado !== 'antigo')) throw new Error(corpo?.error?.message ?? 'Detalhes do GDACS indisponíveis agora.')
  return { ...corpo, paises: Array.isArray(corpo.paises) ? corpo.paises : [], populacao: Array.isArray(corpo.populacao) ? corpo.populacao : [] } as DetalhesGdacs
}

/** Cor de cada camada do GDACS no mapa (áreas de alerta vermelha/laranja/verde, trajetória, demais). */
export function corDaClasse(classe: string): string {
  if (/red/i.test(classe)) return '#dc2626'
  if (/orange/i.test(classe)) return '#f97316'
  if (/green/i.test(classe)) return '#16a34a'
  if (/affected/i.test(classe)) return '#dc2626'
  if (/line|track|point/i.test(classe)) return '#0f172a'
  return '#2563eb'
}
