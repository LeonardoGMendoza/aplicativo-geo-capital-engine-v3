// Condições agora (El Niño): previsão real e gratuita da Open-Meteo, sem chave, direto do navegador.
// Critérios do protótipo (não são alertas oficiais): calor intenso >= 35 °C de máxima; chuva forte >= 50 mm em um dia.
export type Cidade = { nome: string; uf: string; latitude: number; longitude: number }
export type Previsao = { cidade: Cidade; dias: string[]; maximas: number[]; chuvas: number[] }
export type Nivel = 'normal' | 'atencao' | 'alto'

export const cidadesCalor: Cidade[] = [
  { nome: 'Manaus', uf: 'AM', latitude: -3.119, longitude: -60.022 },
  { nome: 'Belém', uf: 'PA', latitude: -1.456, longitude: -48.502 },
  { nome: 'Teresina', uf: 'PI', latitude: -5.089, longitude: -42.802 },
  { nome: 'Cuiabá', uf: 'MT', latitude: -15.601, longitude: -56.097 },
]
export const cidadesChuva: Cidade[] = [
  { nome: 'Porto Alegre', uf: 'RS', latitude: -30.035, longitude: -51.218 },
  { nome: 'Lajeado', uf: 'RS', latitude: -29.467, longitude: -51.961 },
  { nome: 'Florianópolis', uf: 'SC', latitude: -27.595, longitude: -48.548 },
  { nome: 'Curitiba', uf: 'PR', latitude: -25.428, longitude: -49.273 },
]
export const CALOR_INTENSO_C = 35
export const CALOR_ATENCAO_C = 32
export const CHUVA_FORTE_MM = 50
export const CHUVA_ATENCAO_MM = 20
export const FONTE_URL = 'https://open-meteo.com/'
export const NOTA_EL_NINO_URL = 'https://granizo1.cptec.inpe.br/clima/nota_tecnica/2026/Nota_Tecnica_ASO2026.pdf'

type Options = { signal?: AbortSignal; fetcher?: typeof fetch }

export async function buscarPrevisoes(cidades: Cidade[], options: Options = {}): Promise<Previsao[]> {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${cidades.map(c => c.latitude).join(',')}&longitude=${cidades.map(c => c.longitude).join(',')}`
    + '&daily=temperature_2m_max,precipitation_sum&timezone=America%2FSao_Paulo&forecast_days=3'
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000)
  const response = await (options.fetcher ?? fetch)(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Previsão indisponível agora. Tente de novo em instantes.')
  const corpo = await response.json()
  const lista = Array.isArray(corpo) ? corpo : [corpo] // uma cidade = objeto; várias = lista
  if (lista.length !== cidades.length) throw new Error('Resposta inesperada da fonte de previsão.')
  return lista.map((item, i) => {
    const d = item?.daily
    if (!d || !Array.isArray(d.time)) throw new Error('Resposta inesperada da fonte de previsão.')
    return { cidade: cidades[i], dias: d.time, maximas: (d.temperature_2m_max ?? []).map(Number), chuvas: (d.precipitation_sum ?? []).map(Number) }
  })
}

const validos = (xs: number[]) => xs.filter(x => Number.isFinite(x))
export function picoMaxima(p: Previsao) { const v = validos(p.maximas); return v.length ? Math.max(...v) : null }
export function picoChuva(p: Previsao) { const v = validos(p.chuvas); return v.length ? Math.max(...v) : null }
export function totalChuva(p: Previsao) { const v = validos(p.chuvas); return v.length ? v.reduce((a, b) => a + b, 0) : null }

export function nivelCalor(maxima: number | null): Nivel {
  if (maxima === null) return 'normal'
  return maxima >= CALOR_INTENSO_C ? 'alto' : maxima >= CALOR_ATENCAO_C ? 'atencao' : 'normal'
}
export function nivelChuva(pico: number | null): Nivel {
  if (pico === null) return 'normal'
  return pico >= CHUVA_FORTE_MM ? 'alto' : pico >= CHUVA_ATENCAO_MM ? 'atencao' : 'normal'
}
export const rotuloCalor: Record<Nivel, string> = { alto: 'Calor intenso', atencao: 'Muito quente', normal: 'Dentro do comum' }
export const rotuloChuva: Record<Nivel, string> = { alto: 'Chuva forte', atencao: 'Chuva moderada', normal: 'Pouca chuva' }

export function formatarGraus(v: number | null) { return v === null ? '—' : `${Math.round(v)} °C` }
export function formatarMm(v: number | null) { return v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mm` }
