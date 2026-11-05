// Alertas OFICIAIS do mundo (INMET, NWS, MeteoAlarm, tsunami, USGS) + previsão de "Meus lugares".
// Os lugares vão no corpo do pedido (não na URL) e o servidor não guarda: cada pessoa vê só os dela.
// A última resposta boa fica guardada no aparelho: sem internet, mostra o que foi visto por último.
export type Nivel = 'extremo' | 'severo' | 'moderado'
export type Regiao = 'brasil' | 'americas' | 'europa' | 'asia' | 'mundo'
export type AlertaOficial = {
  id: string; fonte: string; fonteUrl: string | null; pais: string | null; regiao: Regiao; evento: string; eventoOriginal: string | null
  severidade: Nivel; quando: 'agora' | 'vem'; inicio: string | null; fim: string | null; area: string | null; titulo: string | null
  descricao: string | null; instrucao: string | null; latitude: number | null; longitude: number | null; poligono: [number, number][] | null; link: string | null
  ufs?: string[]
}
export type AlertaResumo = Pick<AlertaOficial, 'id' | 'evento' | 'severidade' | 'quando' | 'fonte' | 'inicio' | 'fim' | 'area' | 'instrucao' | 'link'>
export type DiaPrevisao = { data: string; nivel: Nivel | null; motivos: string[]; codigo: number | null; tmax: number | null; tmin: number | null; chuva: number | null; rajada: number | null }
export type ResumoLugar = { id: string; nome: string; pais: string; latitude: number; longitude: number; nivel: Nivel | null; nivelOficial?: Nivel | null; alertas: AlertaResumo[]; previsao: DiaPrevisao[] }
export type Fonte = { id: string; nome: string; estado: 'sucesso' | 'antigo' | 'indisponivel'; quantidade: number; atualizadoEm: string | null }
export type RespostaOficiais = { obtidoEm: string; fontes: Fonte[]; alertas: AlertaOficial[]; lugares: ResumoLugar[]; locaisPadrao: ResumoLugar[]; aviso?: string; guardado?: boolean }
export type LugarPedido = { id: string; nome: string; pais: string | null; latitude: number; longitude: number }

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
    return r && Array.isArray(r.alertas) && Array.isArray(r.lugares) ? { ...r, locaisPadrao: Array.isArray(r.locaisPadrao) ? r.locaisPadrao : [], guardado: true } : null
  } catch { return null }
}

/** Busca os alertas (e o resumo dos lugares da pessoa). Sem internet ou com o servidor fora: devolve a última cópia guardada.
 * A cópia guardada só vale para a mesma lista de lugares (senão mostraria cidades que a pessoa já tirou). */
export async function buscarOficiais(lugares: LugarPedido[] = [], options: Options = {}): Promise<RespostaOficiais> {
  const base = (options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
  const armazem = options.armazem === undefined ? armazemPadrao() : options.armazem
  const sinal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(40_000)]) : AbortSignal.timeout(40_000)
  const pedido = lugares.slice(0, 12).map(l => ({ id: l.id, nome: l.nome, pais: l.pais, latitude: l.latitude, longitude: l.longitude }))
  try {
    const resp = await (options.fetcher ?? fetch)(`${base}/api/v1/alerts/oficiais/lugares`, {
      method: 'POST', signal: sinal, cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ lugares: pedido }) })
    const corpo = await resp.json().catch(() => null)
    if (!resp.ok || !corpo || !Array.isArray(corpo.alertas) || !Array.isArray(corpo.lugares)) throw new Error(corpo?.error?.message ?? 'Alertas oficiais indisponíveis agora.')
    const r = { ...corpo, locaisPadrao: Array.isArray(corpo.locaisPadrao) ? corpo.locaisPadrao : [] } as RespostaOficiais
    guardar(r, armazem)
    return r
  } catch (erro) {
    if (options.signal?.aborted) throw erro
    const salvo = lerGuardado(armazem)
    if (salvo) {
      const ids = new Set(pedido.map(l => l.id))
      return { ...salvo, lugares: salvo.lugares.filter(l => ids.has(l.id)) }
    }
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

/** Para a fileira de 7 dias: "Qui" em cima e "05" embaixo. */
export function diaCurto(data: string) {
  const d = new Date(`${data}T12:00:00`)
  if (Number.isNaN(d.getTime())) return { semana: data, dia: '' }
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return { semana: semana.charAt(0).toUpperCase() + semana.slice(1, 3), dia: String(d.getDate()).padStart(2, '0') }
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
    const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return mesmoDia ? `hoje às ${h}` : `${d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')} ${String(d.getDate()).padStart(2, '0')} às ${h}`
  }
  if (a.quando === 'vem' && a.inicio) return `Começa ${fmt(a.inicio) ?? 'em breve'}`
  return a.fim && fmt(a.fim) ? `Até ${fmt(a.fim)}` : 'Em andamento'
}

/** A frase principal do cartão da cidade: o alerta oficial mais grave; se não houver, o pior dia da previsão. */
export function fraseCidade(c: ResumoLugar) {
  const alerta = c.alertas[0]
  if (alerta) return `${emojiEvento(alerta.evento)} ${alerta.evento}${alerta.quando === 'vem' ? ' (vem aí)' : ' (agora)'}`
  const pior = c.previsao.filter(d => d.nivel).sort((a, b) => ORDEM[a.nivel as Nivel] - ORDEM[b.nivel as Nivel])[0]
  if (pior) return `${emojiTempo(pior.codigo)} ${diaDaSemana(pior.data)}: ${pior.motivos[0] ?? 'tempo perigoso'}`
  return c.previsao.length ? '✅ Sem alerta oficial e sem perigo previsto em 7 dias' : '✅ Sem alerta oficial agora'
}

/** Selo do cartão: deixa claro quando o nível vem só da previsão (e não de um aviso oficial). */
export function seloCidade(c: Pick<ResumoLugar, 'nivel' | 'nivelOficial'>) {
  if (!c.nivel) return 'Tranquilo'
  return c.nivelOficial === c.nivel ? `${ROTULO_NIVEL[c.nivel]} · oficial` : `${ROTULO_NIVEL[c.nivel]} · previsão`
}

// ---------- Tabela por estado (estilo MeteoAlarm) ----------
export type Tipo = 'tempestade' | 'chuva' | 'vento' | 'calor' | 'frio' | 'outro'
export const TIPOS: { id: Exclude<Tipo, 'outro'>; nome: string }[] = [
  { id: 'tempestade', nome: 'Tempestade' }, { id: 'chuva', nome: 'Chuva' }, { id: 'vento', nome: 'Vento' },
  { id: 'calor', nome: 'Calor e seca' }, { id: 'frio', nome: 'Frio' },
]
export function tipoDoAlerta(evento: string | null): Tipo {
  const t = (evento ?? '').toLowerCase()
  if (/tempestade(?! de neve)|tornado|granizo|trovoada|thunder/.test(t)) return 'tempestade'
  if (/chuva|enchente|enxurrada|inunda|alagamento|flood|rain/.test(t)) return 'chuva'
  if (/vento|vendaval|ventania|ciclone|wind/.test(t)) return 'vento'
  if (/calor|umidade|seca|estiagem|incêndio|heat|fire/.test(t)) return 'calor'
  if (/frio|geada|temperatura|neve|nevasca|cold|snow|frost/.test(t)) return 'frio'
  return 'outro'
}

export const ESTADOS: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
  GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
}
export type LinhaUF = { uf: string; nome: string; tipos: Partial<Record<Tipo, Nivel>>; max: Nivel | null; alertas: string[] }

/** Uma linha por estado, com o nível mais alto de cada tipo de aviso. Estados com aviso primeiro (mais grave no topo). */
export function tabelaPorEstado(alertas: AlertaOficial[]): LinhaUF[] {
  const linhas = new Map(Object.entries(ESTADOS).map(([uf, nome]) => [uf, { uf, nome, tipos: {}, max: null, alertas: [] } as LinhaUF]))
  for (const a of alertas) {
    for (const uf of a.ufs ?? []) {
      const l = linhas.get(uf)
      if (!l) continue
      const tipo = tipoDoAlerta(a.evento)
      const atual = l.tipos[tipo]
      if (!atual || ORDEM[a.severidade] < ORDEM[atual]) l.tipos[tipo] = a.severidade
      if (!l.max || ORDEM[a.severidade] < ORDEM[l.max]) l.max = a.severidade
      l.alertas.push(a.id)
    }
  }
  return [...linhas.values()].sort((a, b) => (a.max ? ORDEM[a.max] : 9) - (b.max ? ORDEM[b.max] : 9) || a.nome.localeCompare(b.nome, 'pt-BR'))
}

// ---------- Tabela por país (fora do Brasil), mesmo estilo ----------
const CODIGO_PAIS: Record<string, string> = {
  Brasil: 'BR', EUA: 'US', Paraguai: 'PY', Peru: 'PE', Argentina: 'AR', Chile: 'CL', Bolívia: 'BO', Uruguai: 'UY', México: 'MX', Canadá: 'CA',
  Áustria: 'AT', Bélgica: 'BE', Bósnia: 'BA', Bulgária: 'BG', Croácia: 'HR', Chipre: 'CY', Tchéquia: 'CZ', Dinamarca: 'DK', Estônia: 'EE',
  Finlândia: 'FI', França: 'FR', Alemanha: 'DE', Grécia: 'GR', Hungria: 'HU', Islândia: 'IS', Irlanda: 'IE', Israel: 'IL', Itália: 'IT',
  Letônia: 'LV', Lituânia: 'LT', Luxemburgo: 'LU', Malta: 'MT', Moldávia: 'MD', Montenegro: 'ME', Holanda: 'NL', 'Macedônia do Norte': 'MK',
  Noruega: 'NO', Polônia: 'PL', Portugal: 'PT', Romênia: 'RO', Sérvia: 'RS', Eslováquia: 'SK', Eslovênia: 'SI', Espanha: 'ES', Suécia: 'SE',
  Suíça: 'CH', 'Reino Unido': 'GB', Ucrânia: 'UA', Japão: 'JP',
}

/** Uma linha por país com aviso (os avisos sem país, como terremotos no mar, ficam só na lista). */
export function tabelaPorPais(alertas: AlertaOficial[]): LinhaUF[] {
  const linhas = new Map<string, LinhaUF>()
  for (const a of alertas) {
    if (!a.pais) continue
    const l = linhas.get(a.pais) ?? { uf: CODIGO_PAIS[a.pais] ?? a.pais.slice(0, 2).toUpperCase(), nome: a.pais, tipos: {}, max: null, alertas: [] }
    const tipo = tipoDoAlerta(a.evento)
    const atual = l.tipos[tipo]
    if (!atual || ORDEM[a.severidade] < ORDEM[atual]) l.tipos[tipo] = a.severidade
    if (!l.max || ORDEM[a.severidade] < ORDEM[l.max]) l.max = a.severidade
    l.alertas.push(a.id)
    linhas.set(a.pais, l)
  }
  return [...linhas.values()].sort((a, b) => ORDEM[a.max!] - ORDEM[b.max!] || b.alertas.length - a.alertas.length || a.nome.localeCompare(b.nome, 'pt-BR'))
}
