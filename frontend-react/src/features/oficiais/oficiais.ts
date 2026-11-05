// Alertas OFICIAIS do mundo (INMET, NWS, MeteoAlarm, tsunami, USGS) + previsão das cidades da família.
// A última resposta boa fica guardada no aparelho: sem internet, mostra o que foi visto por último.
export type Nivel = 'extremo' | 'severo' | 'moderado'
export type Regiao = 'brasil' | 'americas' | 'europa' | 'asia' | 'mundo'
export type AlertaOficial = {
  id: string; fonte: string; fonteUrl: string | null; pais: string | null; regiao: Regiao; evento: string; eventoOriginal: string | null
  severidade: Nivel; quando: 'agora' | 'vem'; inicio: string | null; fim: string | null; area: string | null; titulo: string | null
  descricao: string | null; instrucao: string | null; latitude: number | null; longitude: number | null; poligono: [number, number][] | null; link: string | null
}
export type AlertaResumo = Pick<AlertaOficial, 'id' | 'evento' | 'severidade' | 'quando' | 'fonte' | 'inicio' | 'fim' | 'area' | 'instrucao' | 'link'>
export type DiaPrevisao = { data: string; nivel: Nivel | null; motivos: string[]; codigo: number | null; tmax: number | null; tmin: number | null; chuva: number | null; rajada: number | null }
export type CidadeFamilia = { id: string; nome: string; pais: string; latitude: number; longitude: number; nivel: Nivel | null; nivelOficial?: Nivel | null; alertas: AlertaResumo[]; previsao: DiaPrevisao[] }
export type Fonte = { id: string; nome: string; estado: 'sucesso' | 'antigo' | 'indisponivel'; quantidade: number; atualizadoEm: string | null }
export type RespostaOficiais = { obtidoEm: string; fontes: Fonte[]; alertas: AlertaOficial[]; familia: CidadeFamilia[]; aviso?: string; guardado?: boolean }

export const CHAVE_GUARDADO = 'omni-oficiais-ultimo'
export const COR_NIVEL: Record<Nivel, string> = { extremo: '#b91c1c', severo: '#ea580c', moderado: '#ca8a04' }
export const ROTULO_NIVEL: Record<Nivel, string> = { extremo: 'Perigo extremo', severo: 'Perigo', moderado: 'Atenção' }
const ORDEM: Record<Nivel, number> = { extremo: 0, severo: 1, moderado: 2 }
export const BANDEIRA: Record<string, string> = { Brasil: '🇧🇷', Paraguai: '🇵🇾', Peru: '🇵🇪', EUA: '🇺🇸' }

type Armazem = Pick<Storage, 'getItem' | 'setItem'> | null
const armazemPadrao = (): Armazem => (typeof localStorage === 'undefined' ? null : localStorage)
type Options = { baseUrl?: string; signal?: AbortSignal; fetcher?: typeof fetch; armazem?: Armazem }

export function guardar(r: RespostaOficiais, armazem: Armazem = armazemPadrao()) {
  // Sem os polígonos: cabe com folga no aparelho e basta para ler os avisos sem internet.
  try { armazem?.setItem(CHAVE_GUARDADO, JSON.stringify({ ...r, alertas: r.alertas.map(a => ({ ...a, poligono: null })) })); return true } catch { return false }
}

export function lerGuardado(armazem: Armazem = armazemPadrao()): RespostaOficiais | null {
  try {
    const r = JSON.parse(armazem?.getItem(CHAVE_GUARDADO) ?? 'null')
    return r && Array.isArray(r.alertas) && Array.isArray(r.familia) ? { ...r, guardado: true } : null
  } catch { return null }
}

/** Busca os alertas. Sem internet ou com o servidor fora: devolve a última cópia guardada (marcada guardado: true). */
export async function buscarOficiais(options: Options = {}): Promise<RespostaOficiais> {
  const base = (options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
  const armazem = options.armazem === undefined ? armazemPadrao() : options.armazem
  const sinal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(40_000)]) : AbortSignal.timeout(40_000)
  try {
    const resp = await (options.fetcher ?? fetch)(`${base}/api/v1/alerts/oficiais`, { signal: sinal, cache: 'no-store', headers: { Accept: 'application/json' } })
    const corpo = await resp.json().catch(() => null)
    if (!resp.ok || !corpo || !Array.isArray(corpo.alertas) || !Array.isArray(corpo.familia)) throw new Error(corpo?.error?.message ?? 'Alertas oficiais indisponíveis agora.')
    guardar(corpo, armazem)
    return corpo as RespostaOficiais
  } catch (erro) {
    if (options.signal?.aborted) throw erro
    const salvo = lerGuardado(armazem)
    if (salvo) return salvo
    throw erro instanceof Error ? erro : new Error('Alertas oficiais indisponíveis agora.')
  }
}

export const REGIOES: { id: 'todos' | Regiao; nome: string }[] = [
  { id: 'todos', nome: 'Mundo todo' }, { id: 'brasil', nome: 'Brasil' }, { id: 'americas', nome: 'Américas' },
  { id: 'europa', nome: 'Europa' }, { id: 'asia', nome: 'Ásia e Oceania' },
]

/** Filtra por região e gravidade, e separa em "acontecendo agora" e "vem aí". */
export function separar(alertas: AlertaOficial[], regiao: 'todos' | Regiao = 'todos', comAmarelos = false) {
  const lista = alertas.filter(a => (comAmarelos || a.severidade !== 'moderado')
    && (regiao === 'todos' || a.regiao === regiao || (regiao === 'americas' && a.regiao === 'brasil')))
  const ordenar = (x: AlertaOficial[]) => [...x].sort((a, b) => ORDEM[a.severidade] - ORDEM[b.severidade])
  return { agora: ordenar(lista.filter(a => a.quando === 'agora')), vem: [...lista.filter(a => a.quando === 'vem')].sort((a, b) => (a.inicio ?? '').localeCompare(b.inicio ?? '') || ORDEM[a.severidade] - ORDEM[b.severidade]) }
}

export function emojiEvento(evento: string | null) {
  const t = (evento ?? '').toLowerCase()
  if (/tornado/.test(t)) return '🌪️'
  if (/tsunami/.test(t)) return '🌊'
  if (/terremoto|earthquake|sismo/.test(t)) return '〰️'
  if (/furac|ciclone|hurricane|tufão|typhoon|tropical/.test(t)) return '🌀'
  if (/granizo|hail/.test(t)) return '🧊'
  if (/neve|nevasca|snow|blizzard|frio|cold|congel|ice|geada/.test(t)) return '❄️'
  if (/calor|heat|temperatura/.test(t)) return '🌡️'
  if (/incênd|incend|fire|fogo/.test(t)) return '🔥'
  if (/enchente|enxurrada|flood|inunda|chuva|rain/.test(t)) return '🌧️'
  if (/tempestade|storm|thunder|trovoada/.test(t)) return '⛈️'
  if (/vento|vendaval|wind/.test(t)) return '💨'
  if (/nuclear|radiol/.test(t)) return '☢️'
  return '⚠️'
}

export function emojiTempo(codigo: number | null) {
  if (codigo == null) return '·'
  if (codigo >= 95) return '⛈️'
  if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return '❄️'
  if ((codigo >= 61 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return '🌧️'
  if (codigo >= 51 && codigo <= 57) return '🌦️'
  if (codigo === 45 || codigo === 48) return '🌫️'
  if (codigo <= 1) return '☀️'
  return codigo === 2 ? '⛅' : '☁️'
}

export function diaDaSemana(data: string) {
  const d = new Date(`${data}T12:00:00`)
  return Number.isNaN(d.getTime()) ? data : d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', '')
}

export function quandoTexto(a: Pick<AlertaOficial, 'quando' | 'inicio' | 'fim'>, agora = new Date()) {
  const fmt = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    const mesmoDia = d.toDateString() === agora.toDateString()
    return mesmoDia ? `hoje ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }
  if (a.quando === 'vem' && a.inicio) return `Começa ${fmt(a.inicio) ?? 'em breve'}`
  return a.fim && fmt(a.fim) ? `Até ${fmt(a.fim)}` : 'Em andamento'
}

/** A frase principal do cartão da cidade: o alerta oficial mais grave; se não houver, o pior dia da previsão. */
export function fraseCidade(c: CidadeFamilia) {
  const alerta = c.alertas[0]
  if (alerta) return `${emojiEvento(alerta.evento)} ${alerta.evento}${alerta.quando === 'vem' ? ' (vem aí)' : ' (agora)'}`
  const pior = c.previsao.filter(d => d.nivel).sort((a, b) => ORDEM[a.nivel as Nivel] - ORDEM[b.nivel as Nivel])[0]
  if (pior) return `${emojiTempo(pior.codigo)} ${diaDaSemana(pior.data)}: ${pior.motivos[0] ?? 'tempo perigoso'}`
  return c.previsao.length ? '✅ Sem alerta oficial e sem perigo previsto em 7 dias' : '✅ Sem alerta oficial agora'
}

/** Selo do cartão: deixa claro quando o nível vem só da previsão (e não de um aviso oficial). */
export function seloCidade(c: Pick<CidadeFamilia, 'nivel' | 'nivelOficial'>) {
  if (!c.nivel) return 'Tranquilo'
  return c.nivelOficial === c.nivel ? `${ROTULO_NIVEL[c.nivel]} · oficial` : `${ROTULO_NIVEL[c.nivel]} · previsão`
}
