import { useEffect, useMemo, useState } from 'react'
import { BellRing, ExternalLink, Search } from 'lucide-react'
import { RiskBadge } from '@/components/shared/RiskBadge'
import { AlertActions } from './AlertActions'
import { useNasaSession } from '@/features/nasa/NasaSession'
import { capitalMaisPerto } from '@/features/nasa/leitura'
import { mapPosition } from '@/features/nasa/geography'
import { buscarPrevisoes, cidadesCalor, cidadesChuva } from '@/features/climate/climate'
import type { Previsao } from '@/features/climate/climate'
import { buscarAlertasGlobais } from '@/features/climate/globalWeather'
import type { AlertaGlobal } from '@/features/climate/globalWeather'
import { itensDaPrevisao, itensGdacs, itensNasa, naAmericaDoSul, orientacoes, priorizar } from '@/features/operations/data/real'
import type { CidadePrevista, ItemReal, TipoReal } from '@/features/operations/data/real'
import './alertas.css'

type Estado<T> = { dados: T | null; erro: boolean }
const RAIO_CAPITAL_KM = 300
const DIAS_NASA = 30
const NOME_TIPO: Record<TipoReal, string> = { calor: 'Calor', chuva: 'Chuva', incendio: 'Incêndio', tempestade: 'Tempestade', enchente: 'Enchente', ciclone: 'Ciclone', seca: 'Seca', terremoto: 'Terremoto', vulcao: 'Vulcão', outro: 'Outros' }

function paraCidade(p: Previsao): CidadePrevista {
  const i = p.maximas.reduce((m, v, k) => (Number.isFinite(v) && (m < 0 || v > p.maximas[m]) ? k : m), -1)
  const j = p.chuvas.reduce((m, v, k) => (Number.isFinite(v) && (m < 0 || v > p.chuvas[m]) ? k : m), -1)
  return { nome: p.cidade.nome, uf: p.cidade.uf, maxima: i >= 0 ? p.maximas[i] : null, diaMaxima: p.dias[i] ?? null, chuva: j >= 0 ? p.chuvas[j] : null, diaChuva: p.dias[j] ?? null }
}

/**
 * Página "Alertas": todos os alertas REAIS numa lista só (previsão Open-Meteo, satélite NASA perto das capitais
 * e alertas oficiais da ONU/GDACS), com detalhes, orientação, IA e envio por WhatsApp. Sempre dados reais.
 */
export function AlertasPage() {
  const nasa = useNasaSession()
  const [previsao, setPrevisao] = useState<Estado<Previsao[]>>({ dados: null, erro: false })
  const [gdacs, setGdacs] = useState<Estado<AlertaGlobal[]>>({ dados: null, erro: false })
  const [aba, setAba] = useState<'todos' | 'brasil' | 'mundo'>('todos')
  const [tipo, setTipo] = useState<TipoReal | ''>('')
  const [busca, setBusca] = useState('')
  const [escolhido, setEscolhido] = useState<string | null>(null)

  useEffect(() => { if (nasa.mode !== 'nasa') nasa.setMode('nasa') }, [nasa.mode]) // esta página é sempre real
  useEffect(() => {
    const abort = new AbortController()
    buscarPrevisoes([...cidadesCalor, ...cidadesChuva], { signal: abort.signal }).then(d => !abort.signal.aborted && setPrevisao({ dados: d, erro: false })).catch(() => !abort.signal.aborted && setPrevisao({ dados: null, erro: true }))
    buscarAlertasGlobais({ signal: abort.signal }).then(r => !abort.signal.aborted && setGdacs({ dados: r.alertas, erro: false })).catch(() => !abort.signal.aborted && setGdacs({ dados: null, erro: true }))
    return () => abort.abort()
  }, [])

  // Eventos NASA na América do Sul, até 30 dias, a até 300 km de uma capital brasileira.
  const nasaPerto = useMemo(() => {
    const agora = Date.now()
    return (nasa.result?.events ?? []).flatMap(e => {
      const pos = mapPosition(e); const cap = capitalMaisPerto(e)
      const t = e.observedAt ? Date.parse(e.observedAt) : NaN
      if (!pos || !cap || !Number.isFinite(t) || !naAmericaDoSul(pos[0], pos[1]) || cap.km > RAIO_CAPITAL_KM) return []
      const dias = (agora - t) / 86400000
      if (dias > DIAS_NASA) return []
      return itensNasa([{ id: e.id, titulo: e.title, categoria: e.categories.map(c => c.id || c.title).join(' '), km: cap.km, dias }], cap.nome)
        .map(item => ({ ...item, observadoEm: e.observedAt }))
    })
  }, [nasa.result])

  const itens = useMemo(() => priorizar([
    ...(previsao.dados ? itensDaPrevisao(previsao.dados.map(paraCidade)) : []),
    ...nasaPerto,
    ...(gdacs.dados ? itensGdacs(gdacs.dados) : []),
  ]), [previsao, nasaPerto, gdacs]) as (ItemReal & { observadoEm?: string | null })[]

  const filtrados = itens.filter(i => (aba === 'todos' || i.escopo === aba) && (!tipo || i.tipo === tipo)
    && `${i.titulo} ${i.local}`.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')))
  const atual = filtrados.find(i => i.id === escolhido) ?? filtrados[0] ?? null
  const tipos = [...new Set(itens.map(i => i.tipo))]
  const carregando = (!previsao.dados && !previsao.erro) || (!gdacs.dados && !gdacs.erro) || nasa.loading
  const conta = (n: ItemReal['nivel']) => itens.filter(i => i.nivel === n).length
  const agoraIso = useMemo(() => new Date().toISOString(), [atual?.id])

  return <div className="alertas-pagina min-w-0 space-y-4">
    <header className="text-white"><p className="text-xs font-semibold text-[#25d3b6]">OMNI-ECORESCUE / V3</p>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><BellRing className="size-6 text-[#2ce3c1]" aria-hidden="true" />Alertas</h1>
      <p className="mt-2 text-sm text-[#b5d2e2]">Todos os alertas reais numa lista só: previsão do tempo, satélite da NASA perto das capitais e alertas oficiais da ONU. Escolha um alerta para ver o que fazer e avisar por WhatsApp.</p></header>

    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Resumo dos alertas">
      {[['Críticos', conta('critical'), '#cf2442', '#fff0f3'], ['Altos', conta('high'), '#ba7909', '#fff7e8'], ['Atenção', conta('attention'), '#056cd7', '#edf5ff'], ['No Brasil e região', itens.filter(i => i.escopo === 'brasil').length, '#087f65', '#e9f9f2']]
        .map(([t, v, c, bg]) => <div key={t as string} className="alertas-kpi" style={{ background: bg as string, color: c as string }}><p className="text-2xl font-bold">{carregando && !itens.length ? '…' : v}</p><p className="text-xs">{t}</p></div>)}
    </section>

    <div className="alertas-grade">
      <section className="light-panel flex min-w-0 flex-col" aria-label="Lista de alertas reais">
        <div className="compact-tabs">{([['todos', 'Todos'], ['brasil', 'Brasil e região'], ['mundo', 'Resto do mundo']] as const).map(([id, rotulo]) => <button key={id} type="button" aria-pressed={aba === id} onClick={() => setAba(id)}>{rotulo}</button>)}</div>
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          <label className="flex min-w-0 flex-1 items-center gap-1 rounded border bg-white px-2"><Search className="size-3.5 text-muted-foreground" /><input aria-label="Buscar alerta" placeholder="Buscar alerta ou lugar…" value={busca} onChange={e => setBusca(e.target.value)} className="min-w-0 w-full py-2 text-sm outline-none" /></label>
          <select aria-label="Tipo de alerta" className="mini-select" value={tipo} onChange={e => setTipo(e.target.value as TipoReal | '')}><option value="">Todos os tipos</option>{tipos.map(t => <option key={t} value={t}>{NOME_TIPO[t]}</option>)}</select>
        </div>
        <ul className="alertas-lista px-2 pb-2">
          {filtrados.map(i => <li key={i.id}><button type="button" aria-pressed={atual?.id === i.id} className="alertas-item" onClick={() => setEscolhido(i.id)}>
            <span className={`alertas-barra nivel-${i.nivel}`} aria-hidden="true" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{i.titulo}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{i.local} · {i.quando} · {i.fonte}</span></span>
            <RiskBadge level={i.nivel} />
          </button></li>)}
        </ul>
        {!filtrados.length && <p role="status" className="p-5 text-center text-sm text-muted-foreground">{carregando ? 'Consultando as fontes…' : itens.length ? 'Nenhum alerta corresponde aos filtros.' : 'Nenhum alerta acima dos critérios agora. Isso não significa ausência de risco.'}</p>}
        {(previsao.erro || gdacs.erro || nasa.error) && <p role="alert" className="px-3 pb-3 text-xs text-amber-900">Alguma fonte não respondeu agora ({[previsao.erro && 'previsão', gdacs.erro && 'ONU/GDACS', nasa.error && 'NASA'].filter(Boolean).join(', ')}). A lista mostra o que chegou.</p>}
      </section>

      <section className="light-panel min-w-0 space-y-3 p-4" aria-label="Detalhes do alerta escolhido">
        {!atual ? <p className="text-sm text-muted-foreground">Escolha um alerta na lista.</p> : <>
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-semibold">{atual.titulo}</h2><p className="text-sm text-muted-foreground">{atual.local} · {atual.quando}</p></div><RiskBadge level={atual.nivel} /></div>
          <p className="text-sm leading-relaxed">{atual.detalhe}</p>
          <div className="rounded border border-sky-200 bg-sky-50 p-3 text-sm leading-relaxed text-sky-950"><p className="text-xs font-semibold uppercase tracking-wide">Orientação geral · revise antes de divulgar</p><p className="mt-1">{orientacoes[atual.tipo]}</p></div>
          <a href={atual.fonteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#075fba] underline">Fonte oficial: {atual.fonte}<ExternalLink className="size-3" /></a>
          <AlertActions key={atual.id} perfil="comunidade" ativo="" comunidade={atual.escopo === 'brasil' ? `Moradores de ${atual.local.replace(/^a \d+ km de /, '')} e região` : ''}
            evento={atual.titulo} categoria={NOME_TIPO[atual.tipo]} km={null} observadoEm={atual.observadoEm ?? agoraIso} />
        </>}
      </section>
    </div>
    <p className="text-xs text-[#9fc3d6]">Critérios do protótipo: calor a partir de 35 °C, chuva forte a partir de 50 mm/dia, satélite NASA até 30 dias e a até 300 km de uma capital, alertas laranja e vermelho da ONU. Não substitui o alerta oficial da Defesa Civil; a decisão é humana.</p>
  </div>
}
