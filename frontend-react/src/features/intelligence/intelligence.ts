// Inteligência (IA): perguntas aos documentos oficiais via API do MVP (/api/v1/intelligence/*).
export type Perfil = 'defesa_civil' | 'comunidade' | 'empresa'
export type Trecho = { fonte: string; pagina: number; paginaFim: number; texto: string; similaridade: number }
export type Resposta = {
  pergunta: string; perfil: Perfil; modo: 'ia' | 'documentos'; resposta: string | null; modelo: string | null
  trechos: Trecho[]; aviso: string; isSimulation: false
}
export type Status = {
  estado: 'sem_chave' | 'parado' | 'preparando' | 'pronto' | 'erro'; trechos: number; prontos: number
  iaConfigurada: boolean; paginas: number; documentos: { fonte: string; paginas: number }[]
}
type Options = { baseUrl?: string; signal?: AbortSignal; fetcher?: typeof fetch }

export const perfis: { id: Perfil; label: string }[] = [
  { id: 'defesa_civil', label: 'Defesa Civil / coordenação' },
  { id: 'comunidade', label: 'Cidadão / comunidade' },
  { id: 'empresa', label: 'Empresa' },
]
export const perguntasProntas = [
  'Como organizar a evacuação numa enchente?',
  'O que fazer se as sirenes falharem num rompimento de barragem?',
  'Como preparar um abrigo temporário para famílias desalojadas?',
  'Quais sinais indicam risco de deslizamento em encosta?',
]
export const nomesDocumentos: Record<string, string> = {
  'brumadinho.pdf': 'Relatório sobre o rompimento em Brumadinho',
  'porto_alegre.pdf': 'Plano de contingência de Porto Alegre',
  'sao_sebastiao.pdf': 'Plano de contingência de São Sebastião',
  'rima_petrobras.pdf': 'RIMA Petrobras',
  'rima_bacia_campos.pdf': 'RIMA Bacia de Campos',
}

export class IntelligenceError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) { super(message) }
}

function base(options: Options) {
  return (options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
}

async function read<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new IntelligenceError(body?.error?.message ?? 'Não foi possível consultar a IA agora.', body?.error?.code ?? 'internal', response.status)
  return body as T
}

export async function getStatus(options: Options = {}): Promise<Status> {
  const response = await (options.fetcher ?? fetch)(`${base(options)}/api/v1/intelligence/status`, { signal: options.signal, cache: 'no-store', headers: { Accept: 'application/json' } })
  return read<Status>(response)
}

export async function ask(pergunta: string, perfil: Perfil, options: Options = {}): Promise<Resposta> {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(70_000)]) : AbortSignal.timeout(70_000)
  const response = await (options.fetcher ?? fetch)(`${base(options)}/api/v1/intelligence/ask`, {
    method: 'POST', signal, cache: 'no-store',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ pergunta, perfil }),
  })
  return read<Resposta>(response)
}

export function citacao(t: Pick<Trecho, 'fonte' | 'pagina' | 'paginaFim'>) {
  return `${t.fonte}, pág. ${t.pagina}${t.paginaFim !== t.pagina ? `-${t.paginaFim}` : ''}`
}

export function estadoTexto(s: Status | null) {
  if (!s) return 'Consultando a base de documentos…'
  if (s.estado === 'pronto') return `Base pronta: ${s.documentos.length} documentos oficiais · ${s.paginas.toLocaleString('pt-BR')} páginas · ${s.trechos.toLocaleString('pt-BR')} trechos.`
  if (s.estado === 'preparando' || s.estado === 'parado') return `Preparando a base de documentos: ${s.prontos.toLocaleString('pt-BR')} de ${s.trechos.toLocaleString('pt-BR')} trechos (só na primeira vez, cerca de 1 minuto).`
  if (s.estado === 'sem_chave') return 'A IA não está configurada neste servidor.'
  return 'A base de documentos falhou ao preparar. Tente de novo em instantes.'
}
