// Mapa mundial: radar de chuva (RainViewer, público, sem chave) + alertas de desastre (GDACS via nossa API).
export type AlertaGlobal = { id: string; tipo: string; tipoNome: string; nivel: 'vermelho' | 'laranja'; nome: string; pais: string | null; inicio: string | null; fim: string | null; latitude: number; longitude: number; link: string | null }
export type RespostaAlertas = { estado: 'sucesso' | 'antigo'; fonte: string; fonteUrl: string; obtidoEm: string; alertas: AlertaGlobal[] }
export type Radar = { tileUrl: (cor: number) => string; horario: Date }
type Options = { baseUrl?: string; signal?: AbortSignal; fetcher?: typeof fetch }

export const RAINVIEWER_URL = 'https://api.rainviewer.com/public/weather-maps.json'
export const RADAR_COR_TV = 4      // paleta parecida com a da TV (verde → amarelo → vermelho)
export const RADAR_COR_RESERVA = 2 // paleta padrão, usada se a outra não carregar
export const emojiTipo: Record<string, string> = { FL: '🌊', TC: '🌀', DR: '🏜️', WF: '🔥', EQ: '〰️', VO: '🌋', TS: '🌊' }

function comTempo(signal?: AbortSignal) { return signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) }

/** Último quadro de radar disponível (o RainViewer guarda as últimas ~2 horas). */
export async function buscarRadar(options: Options = {}): Promise<Radar> {
  const response = await (options.fetcher ?? fetch)(RAINVIEWER_URL, { signal: comTempo(options.signal), cache: 'no-store' })
  if (!response.ok) throw new Error('Radar de chuva indisponível agora.')
  const corpo = await response.json()
  const quadros = corpo?.radar?.past
  const ultimo = Array.isArray(quadros) ? quadros[quadros.length - 1] : null
  if (typeof corpo?.host !== 'string' || !corpo.host.startsWith('https://') || !ultimo?.path) throw new Error('Radar de chuva respondeu num formato inesperado.')
  return { tileUrl: cor => `${corpo.host}${ultimo.path}/256/{z}/{x}/{y}/${cor}/1_1.png`, horario: new Date(Number(ultimo.time) * 1000) }
}

export async function buscarAlertasGlobais(options: Options = {}): Promise<RespostaAlertas> {
  const base = (options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
  const response = await (options.fetcher ?? fetch)(`${base}/api/v1/alerts/global`, { signal: comTempo(options.signal), cache: 'no-store', headers: { Accept: 'application/json' } })
  const corpo = await response.json().catch(() => null)
  if (!response.ok || !corpo || !Array.isArray(corpo.alertas)) throw new Error(corpo?.error?.message ?? 'Alertas mundiais indisponíveis agora.')
  return corpo as RespostaAlertas
}

export function dataCurta(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}
