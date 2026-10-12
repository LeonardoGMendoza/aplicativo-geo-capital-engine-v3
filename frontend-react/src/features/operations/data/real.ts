// Centro de Operações com DADOS REAIS: transforma previsão (Open-Meteo), eventos NASA (EONET) e alertas GDACS (ONU)
// numa lista única de alertas, no mesmo formato visual do cenário do Felipe. Sem nada inventado.
// Critérios do protótipo (não são alertas oficiais): calor ≥ 35 °C (crítico ≥ 40 °C); chuva ≥ 50 mm/dia (crítico ≥ 100 mm).
import type { RiskLevel } from '../../../types/operations'

export type TipoReal = 'calor' | 'chuva' | 'incendio' | 'tempestade' | 'enchente' | 'ciclone' | 'seca' | 'terremoto' | 'vulcao' | 'outro'
export type ItemReal = {
  id: string; tipo: TipoReal; nivel: RiskLevel; titulo: string; local: string; quando: string
  detalhe: string; fonte: string; fonteUrl: string; perto: boolean; escopo: 'brasil' | 'mundo'
}

export const CRITERIOS = { calor: 35, calorCritico: 40, calorAtencao: 32, chuva: 50, chuvaCritica: 100, chuvaAtencao: 20 }
const OPEN_METEO = 'https://open-meteo.com/'
const EONET = 'https://eonet.gsfc.nasa.gov/'
const GDACS = 'https://www.gdacs.org/'

const diaMes = (data: string | null) => (data && /^\d{4}-\d{2}-\d{2}/.test(data) ? `${data.slice(8, 10)}/${data.slice(5, 7)}` : '—')
const graus = (v: number) => `${Math.round(v)} °C`
const mm = (v: number) => `${Math.round(v)} mm`

export type CidadePrevista = { nome: string; uf: string; maxima: number | null; diaMaxima: string | null; chuva: number | null; diaChuva: string | null }
/** Calor e chuva previstos nos próximos 3 dias nas cidades monitoradas. Só entra o que passa dos critérios de atenção. */
export function itensDaPrevisao(cidades: CidadePrevista[]): ItemReal[] {
  const itens: ItemReal[] = []
  for (const c of cidades) {
    const local = `${c.nome}/${c.uf}`
    if (c.maxima !== null && Number.isFinite(c.maxima) && c.maxima >= CRITERIOS.calorAtencao) {
      const nivel: RiskLevel = c.maxima >= CRITERIOS.calorCritico ? 'critical' : c.maxima >= CRITERIOS.calor ? 'high' : 'attention'
      itens.push({ id: `calor-${local}`, tipo: 'calor', nivel, titulo: nivel === 'attention' ? 'Muito quente' : 'Calor intenso', local, quando: diaMes(c.diaMaxima),
        detalhe: `Máxima prevista de ${graus(c.maxima)} em ${diaMes(c.diaMaxima)} (próximos 3 dias). Critério do protótipo: calor intenso a partir de ${CRITERIOS.calor} °C.`,
        fonte: 'Open-Meteo (previsão)', fonteUrl: OPEN_METEO, perto: true, escopo: 'brasil' })
    }
    if (c.chuva !== null && Number.isFinite(c.chuva) && c.chuva >= CRITERIOS.chuvaAtencao) {
      const nivel: RiskLevel = c.chuva >= CRITERIOS.chuvaCritica ? 'critical' : c.chuva >= CRITERIOS.chuva ? 'high' : 'attention'
      itens.push({ id: `chuva-${local}`, tipo: 'chuva', nivel, titulo: nivel === 'attention' ? 'Chuva moderada' : 'Chuva forte', local, quando: diaMes(c.diaChuva),
        detalhe: `Chuva prevista de ${mm(c.chuva)} em ${diaMes(c.diaChuva)} (maior volume em um dia, próximos 3 dias). Critério do protótipo: chuva forte a partir de ${CRITERIOS.chuva} mm.`,
        fonte: 'Open-Meteo (previsão)', fonteUrl: OPEN_METEO, perto: true, escopo: 'brasil' })
    }
  }
  return itens
}

const tipoNasa = (categoria: string): TipoReal => (/wildfire|fire/i.test(categoria) ? 'incendio' : /storm/i.test(categoria) ? 'tempestade'
  : /flood/i.test(categoria) ? 'enchente' : /volcan/i.test(categoria) ? 'vulcao' : /drought/i.test(categoria) ? 'seca' : 'outro')
const nomeTipo: Record<TipoReal, string> = { calor: 'Calor', chuva: 'Chuva', incendio: 'Incêndio', tempestade: 'Tempestade', enchente: 'Enchente', ciclone: 'Ciclone', seca: 'Seca', terremoto: 'Terremoto', vulcao: 'Vulcão', outro: 'Evento natural' }

export type EventoNasaPerto = { id: string; titulo: string; categoria: string; km: number; dias: number }
/** Eventos NASA perto da cidade escolhida: dos últimos 3 dias = alto; até 30 dias = atenção. */
export function itensNasa(eventos: EventoNasaPerto[], cidade: string): ItemReal[] {
  return eventos.map(e => {
    const tipo = tipoNasa(e.categoria)
    const quando = e.dias < 1 ? 'hoje' : `há ${Math.round(e.dias)} d`
    return { id: `nasa-${e.id}`, tipo, nivel: e.dias <= 3 ? 'high' as const : 'attention' as const, titulo: `${nomeTipo[tipo]} (satélite NASA)`,
      local: `a ${Math.round(e.km)} km de ${cidade}`, quando,
      detalhe: `${e.titulo}. Observado ${e.dias < 1 ? 'há menos de 1 dia' : `há ${Math.round(e.dias)} dia(s)`}, a ${Math.round(e.km)} km do centro de ${cidade}. Evento catalogado pela NASA; não confirma risco local.`,
      fonte: 'NASA EONET', fonteUrl: EONET, perto: true, escopo: 'brasil' as const }
  })
}

const TIPO_GDACS: Record<string, TipoReal> = { FL: 'enchente', TC: 'ciclone', DR: 'seca', WF: 'incendio', EQ: 'terremoto', VO: 'vulcao', TS: 'enchente' }
// América do Sul (aproximado): alertas aqui contam como "perto".
export const naAmericaDoSul = (lat: number, lon: number) => lat >= -56 && lat <= 13 && lon >= -82 && lon <= -34
export type AlertaGdacs = { id: string; tipo: string; tipoNome: string; nivel: 'vermelho' | 'laranja'; nome: string; pais: string | null; inicio: string | null; latitude: number; longitude: number; link: string | null; severidade?: string | null }
/** Alertas mundiais oficiais (GDACS/ONU): vermelho = crítico, laranja = alto. */
export function itensGdacs(alertas: AlertaGdacs[]): ItemReal[] {
  return alertas.map(a => {
    const perto = naAmericaDoSul(a.latitude, a.longitude) || /brazil|brasil/i.test(a.pais ?? '')
    return { id: `gdacs-${a.id}`, tipo: TIPO_GDACS[a.tipo] ?? 'outro', nivel: a.nivel === 'vermelho' ? 'critical' as const : 'high' as const,
      titulo: `${a.tipoNome}: ${a.nome}`, local: a.pais || 'Oceano / sem país', quando: diaMes(a.inicio),
      detalhe: `${a.severidade ? `${a.severidade}. ` : ''}Alerta ${a.nivel} do GDACS (ONU / Comissão Europeia), em vigor desde ${diaMes(a.inicio)}.`,
      fonte: 'GDACS (ONU)', fonteUrl: a.link && a.link.startsWith('https://') ? a.link : GDACS, perto, escopo: perto ? 'brasil' as const : 'mundo' as const }
  })
}

const PESO: Record<RiskLevel, number> = { critical: 0, high: 1, attention: 2 }
/** Ordem de prioridade: o que é perto (Brasil / América do Sul) vem antes do resto do mundo; depois a gravidade. */
export function priorizar(itens: ItemReal[]): ItemReal[] {
  return [...itens].sort((a, b) => Number(b.perto) - Number(a.perto) || PESO[a.nivel] - PESO[b.nivel])
}

export const orientacoes: Record<TipoReal, string> = {
  calor: 'Orientar hidratação, evitar sol forte entre 10h e 16h e dar atenção a idosos, crianças e pessoas com doenças crônicas. Calor e seca aumentam o risco de queimadas.',
  chuva: 'Acompanhar o nível dos rios e as encostas, revisar pontos de apoio e lembrar a população do alerta gratuito por SMS (enviar o CEP para 40199).',
  incendio: 'Acompanhar a fumaça e a qualidade do ar, orientar a não fazer queimadas e acionar os Bombeiros (193) se o fogo ameaçar moradias.',
  tempestade: 'Atenção a ventos fortes, queda de árvores e falta de energia. Evitar áreas abertas e ruas alagadas.',
  enchente: 'Monitorar áreas baixas e margens de rios, preparar saídas e pontos de apoio e evitar atravessar água corrente.',
  ciclone: 'Acompanhar a trajetória pelas fontes oficiais. Em geral fora do Brasil: útil para equipes de ajuda e para quem tem familiares na região.',
  seca: 'Monitorar o abastecimento de água e o risco de queimadas.',
  terremoto: 'Evento fora do Brasil, acompanhado por fonte oficial internacional. Útil para equipes de ajuda humanitária.',
  vulcao: 'Evento acompanhado por fonte oficial internacional. Cinzas podem afetar voos.',
  outro: 'Acompanhar as atualizações da fonte oficial.',
}
export const tituloOrientacao = (item: ItemReal) => `${item.titulo.split(':')[0]} · ${item.local}`
