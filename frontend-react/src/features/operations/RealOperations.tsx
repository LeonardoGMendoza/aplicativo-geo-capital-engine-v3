import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, CloudSun, Database, ExternalLink, Flame, House, Map, Search, Stethoscope, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RiskBadge } from '@/components/shared/RiskBadge'
import { MapErrorBoundary } from '@/components/shared/MapErrorBoundary'
import { MetricCard } from './components/MetricCard'
import { PanelHeading } from './components/PanelHeading'
import { itensDaPrevisao, itensGdacs, itensNasa, orientacoes, priorizar, tituloOrientacao } from './data/real'
import type { CidadePrevista, ItemReal } from './data/real'
import { useNasaSession } from '@/features/nasa/NasaSession'
import { buscarPrevisoes, cidadesCalor, cidadesChuva } from '@/features/climate/climate'
import type { Previsao } from '@/features/climate/climate'
import { buscarAlertasGlobais, buscarRadar, RADAR_COR_TV } from '@/features/climate/globalWeather'
import type { AlertaGlobal } from '@/features/climate/globalWeather'
import { cidadesMapa, CORES, eventosPerto, pontosDoMapa, RAIO_EVENTOS_KM } from '@/features/climate/cityMap'
import type { PontoMapa } from '@/features/climate/cityMap'
import { geocode, getNearbyPlaces } from '@/features/shelters/places'
import type { Coordinates } from '@/features/shelters/places'
import '@/features/climate/climate.css'
const CityRealMap = lazy(() => import('@/features/climate/CityRealMap'))

type Estado<T> = { dados: T | null; erro: boolean }
const vazio = <T,>(): Estado<T> => ({ dados: null, erro: false })
const numero = <T,>(e: Estado<T>, f: (d: T) => number) => (e.erro ? '—' : e.dados === null ? '…' : f(e.dados))

function paraCidade(p: Previsao): CidadePrevista {
  const i = p.maximas.reduce((m, v, k) => (Number.isFinite(v) && (m < 0 || v > p.maximas[m]) ? k : m), -1)
  const j = p.chuvas.reduce((m, v, k) => (Number.isFinite(v) && (m < 0 || v > p.chuvas[m]) ? k : m), -1)
  return { nome: p.cidade.nome, uf: p.cidade.uf, maxima: i >= 0 ? p.maximas[i] : null, diaMaxima: p.dias[i] ?? null, chuva: j >= 0 ? p.chuvas[j] : null, diaChuva: p.dias[j] ?? null }
}

export function RealOperations({ onDemo }: { onDemo: () => void }) {
  const { result: nasa, loading: nasaCarregando, error: nasaErro } = useNasaSession()
  const [cidade, setCidade] = useState(cidadesMapa[0])
  const [busca, setBusca] = useState('')
  const [buscaMsg, setBuscaMsg] = useState('')
  const [previsao, setPrevisao] = useState<Estado<Previsao[]>>(vazio)
  const [gdacs, setGdacs] = useState<Estado<AlertaGlobal[]>>(vazio)
  const [lugares, setLugares] = useState<Estado<PontoMapa[]>>(vazio)
  const [radarUrl, setRadarUrl] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<{ item: ItemReal; orientar?: boolean } | null>(null)
  const [aba, setAba] = useState<'todos' | 'brasil' | 'mundo'>('todos')
  const [filtro, setFiltro] = useState('')
  const gatilho = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    buscarPrevisoes([...cidadesCalor, ...cidadesChuva], { signal: abort.signal }).then(d => !abort.signal.aborted && setPrevisao({ dados: d, erro: false })).catch(() => !abort.signal.aborted && setPrevisao({ dados: null, erro: true }))
    buscarAlertasGlobais({ signal: abort.signal }).then(r => !abort.signal.aborted && setGdacs({ dados: r.alertas, erro: false })).catch(() => !abort.signal.aborted && setGdacs({ dados: null, erro: true }))
    buscarRadar({ signal: abort.signal }).then(r => !abort.signal.aborted && setRadarUrl(r.tileUrl(RADAR_COR_TV))).catch(() => {})
    return () => abort.abort()
  }, [])

  useEffect(() => {
    const abort = new AbortController()
    setLugares(vazio())
    getNearbyPlaces(cidade.coordenadas, { signal: abort.signal }).then(r => !abort.signal.aborted && setLugares({ dados: pontosDoMapa(r.items), erro: false })).catch(() => !abort.signal.aborted && setLugares({ dados: null, erro: true }))
    return () => abort.abort()
  }, [cidade])

  const perto = useMemo(() => (nasa ? eventosPerto(nasa.events, cidade.coordenadas) : []), [nasa, cidade])
  const itens = useMemo(() => priorizar([
    ...(previsao.dados ? itensDaPrevisao(previsao.dados.map(paraCidade)) : []),
    ...itensNasa(perto.map(e => ({ id: e.evento.id, titulo: e.evento.title, categoria: e.evento.categories.map(c => c.id || c.title).join(' '), km: e.km, dias: e.dias })), cidade.nome),
    ...(gdacs.dados ? itensGdacs(gdacs.dados) : []),
  ]), [previsao, perto, gdacs, cidade])
  const prioritarios = itens.slice(0, 3)
  const filtrados = itens.filter(i => (aba === 'todos' || i.escopo === aba) && `${i.titulo} ${i.local}`.toLocaleLowerCase('pt-BR').includes(filtro.toLocaleLowerCase('pt-BR')))
  const cidadesForte = previsao.dados?.map(paraCidade).filter(c => (c.maxima ?? 0) >= 35 || (c.chuva ?? 0) >= 50).length
  const abrigos = lugares.dados?.filter(p => p.tipo === 'casa') ?? []
  const saude = lugares.dados?.filter(p => p.tipo === 'cruz') ?? []
  const maisPerto = [...(lugares.dados ?? [])].sort((a, b) => a.lugar.distanceKm - b.lugar.distanceKm).slice(0, 7)

  function abrir(item: ItemReal, orientar = false) {
    gatilho.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDetalhe({ item, orientar })
  }
  async function buscar(event: FormEvent) {
    event.preventDefault()
    if (busca.trim().length < 2) return
    setBuscaMsg('Buscando…')
    try {
      const [primeiro] = await geocode(busca.trim())
      if (primeiro) { setCidade({ nome: primeiro.displayName?.split(',').slice(0, 2).join(',') ?? primeiro.name, coordenadas: primeiro.coordinates as Coordinates }); setBuscaMsg('') }
      else setBuscaMsg('Endereço não encontrado. Tente cidade e estado, por exemplo: Blumenau SC.')
    } catch { setBuscaMsg('Não foi possível buscar o endereço agora.') }
  }
  const verTodos = () => { const alvo = document.getElementById('central-alertas'); alvo?.scrollIntoView({ behavior: 'smooth' }); alvo?.focus({ preventScroll: true }) }

  const fontes = [
    { nome: 'Previsão do tempo', origem: 'Open-Meteo', url: 'https://open-meteo.com/', ok: !!previsao.dados, erro: previsao.erro, texto: '8 cidades · 3 dias' },
    { nome: 'Alertas mundiais', origem: 'GDACS (ONU)', url: 'https://www.gdacs.org/', ok: !!gdacs.dados, erro: gdacs.erro, texto: gdacs.dados ? `${gdacs.dados.length} alertas laranja/vermelho` : '' },
    { nome: 'Eventos por satélite', origem: 'NASA EONET', url: 'https://eonet.gsfc.nasa.gov/', ok: !!nasa, erro: !!nasaErro && !nasaCarregando, texto: nasa ? `${nasa.events.length} eventos no mundo` : '' },
    { nome: 'Abrigos e saúde', origem: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright', ok: !!lugares.dados, erro: lugares.erro, texto: cidade.nome },
    { nome: 'Chuva agora', origem: 'Radar RainViewer', url: 'https://www.rainviewer.com/', ok: !!radarUrl, erro: false, texto: 'no mapa' },
  ]

  return <>
    <div className="demo-strip real-strip" role="note"><span className="flex items-center gap-2"><Database className="size-3.5 shrink-0" /><strong>DADOS REAIS</strong><span className="hidden sm:inline">Previsão, satélite, alertas da ONU e mapa colaborativo, consultados agora. Critérios do protótipo: não substitui alerta oficial.</span></span><button type="button" className="real-strip-demo" onClick={onDemo}>Ver Modo demonstração</button></div>

    <div className="overview-layout">
      <div className="min-w-0">
        <section aria-label="Indicadores com dados reais" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <MetricCard title="Alertas vermelhos" value={numero(gdacs, d => d.filter(a => a.nivel === 'vermelho').length)} note="Mundo · GDACS (ONU)" icon={TriangleAlert} tone="red" />
          <MetricCard title="Calor ou chuva forte" value={cidadesForte ?? (previsao.erro ? '—' : '…')} note="de 8 cidades · próximos 3 dias" icon={Flame} tone="orange" />
          <MetricCard title="Abrigos e pontos de apoio" value={numero(lugares, () => abrigos.length)} note={`${cidade.nome} · OpenStreetMap`} icon={House} tone="blue" />
          <MetricCard title="Hospitais e UBS" value={numero(lugares, () => saude.length)} note={`${cidade.nome} · OpenStreetMap`} icon={Stethoscope} tone="green" />
        </section>
        <div className="primary-layout">
          <section className="light-panel flex flex-col" id="mapa" aria-label="Mapa da situação atual, dados reais">
            <PanelHeading title="Mapa da Situação Atual" icon={Map} />
            <div className="flex gap-1 overflow-x-auto px-2 pb-2">{cidadesMapa.map(c => <button key={c.nome} type="button" aria-pressed={cidade.nome === c.nome} onClick={() => setCidade(c)} className="whitespace-nowrap rounded px-2 py-1.5 text-xs text-white" style={{ background: cidade.nome === c.nome ? '#0873f5' : '#075271' }}>{c.nome}</button>)}</div>
            <form onSubmit={buscar} className="flex gap-1 px-2 pb-2" role="search"><label className="flex min-w-0 flex-1 items-center gap-1 rounded border bg-white px-2"><Search className="size-3 shrink-0 text-muted-foreground" /><input aria-label="Buscar outra cidade ou endereço" value={busca} onChange={e => setBusca(e.target.value)} maxLength={120} placeholder="Buscar outra cidade ou endereço…" className="min-w-0 flex-1 py-1.5 text-xs outline-none" /></label><button type="submit" className="mini-select" disabled={busca.trim().length < 2}>Buscar</button></form>
            {(buscaMsg || lugares.erro) && <p role="status" className="px-3 pb-2 text-xs text-amber-900">{buscaMsg || 'Abrigos e hospitais (OpenStreetMap) indisponíveis agora para esta cidade. Tente de novo em instantes.'}</p>}
            <div className="ops-real-mapa mx-2 min-h-[310px] flex-1 overflow-hidden rounded-md">
              <MapErrorBoundary message="Mapa indisponível agora. Os números acima continuam valendo.">
                <Suspense fallback={<p role="status" className="p-3 text-xs">Carregando mapa…</p>}>
                  <CityRealMap centro={cidade.coordenadas} pontos={lugares.dados ?? []} eventos={perto} radarUrl={radarUrl} onRadarFalhou={() => setRadarUrl(null)} />
                </Suspense>
              </MapErrorBoundary>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"><span><i className="ops-bola" style={{ background: CORES.critico }} />NASA (3 dias) · <i className="ops-bola" style={{ background: CORES.atencao }} />NASA (30 dias) · <i className="ops-bola" style={{ background: CORES.abrigo }} />Abrigo · <i className="ops-bola" style={{ background: CORES.saude }} />Saúde · chuva do radar</span><Link to="/clima" className="text-link">Clima ao vivo</Link></div>
            <p className="px-3 pb-2 text-xs text-muted-foreground">{cidade.nome} · {lugares.dados ? `${abrigos.length} abrigos/pontos de apoio e ${saude.length} hospitais/UBS mapeados` : lugares.erro ? 'locais indisponíveis' : 'buscando abrigos e saúde…'} · {nasa ? `${perto.length} evento(s) NASA a até ${RAIO_EVENTOS_KM} km` : 'consultando NASA…'}</p>
          </section>
          <div className="flex min-w-0 flex-col gap-2">
            <section className="light-panel shrink-0" aria-label="Ações prioritárias com dados reais">
              <PanelHeading title="Ações Prioritárias"><button type="button" className="text-link" onClick={verTodos}>Ver todas ({itens.length})</button></PanelHeading>
              <div className="space-y-1 px-2 pb-2">
                {prioritarios.length === 0 && <p role="status" className="p-2 text-xs text-muted-foreground">{previsao.dados || gdacs.dados ? 'Nenhum alerta acima dos critérios agora. Isso não significa ausência de risco.' : 'Consultando as fontes…'}</p>}
                {prioritarios.map(item => <div key={item.id} className="rounded-md border border-transparent p-2" style={{ background: '#f7fafc' }}><div className="flex items-start gap-2"><span className="flex size-7 shrink-0 items-center justify-center rounded-full" style={{ background: item.nivel === 'critical' ? '#ffe6ed' : '#fff1d7', color: item.nivel === 'critical' ? '#ed2450' : '#df8c12' }}><TriangleAlert className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold leading-tight">{item.titulo}</p><p className="mt-1 text-xs text-muted-foreground">{item.local}</p></div><span className="text-xs text-muted-foreground">{item.quando}</span></div><div className="mt-1 flex items-center justify-between pl-9"><span className="text-xs text-muted-foreground">Fonte: {item.fonte}</span><button type="button" className="rounded bg-[#e4f0fb] px-2 py-1 text-xs font-medium text-[#075fb3]" onClick={() => abrir(item)}>Ver detalhes</button></div></div>)}
              </div>
            </section>
            <section className="light-panel flex-1" aria-label="Orientações para os alertas reais"><PanelHeading title="Orientações" /><div className="space-y-2 px-3 pb-3">{prioritarios.map(item => <button type="button" className="flex w-full items-start gap-2 text-left" key={item.id} onClick={() => abrir(item, true)}><TriangleAlert className="mt-0.5 size-4 shrink-0 text-risk-critical" /><div className="flex-1"><p className="text-xs font-semibold leading-snug">{tituloOrientacao(item)}</p><p className="mt-1 text-xs leading-snug text-muted-foreground">Orientação geral para revisão humana.</p></div><span className="rounded bg-rose-50 px-1.5 py-1 text-xs text-rose-700">Revisar</span></button>)}<p className="border-t pt-2 text-xs text-muted-foreground">Texto de apoio fixo, sem IA. Para consultar os documentos oficiais, use a <Link to="/inteligencia" className="underline">Inteligência (IA)</Link>.</p></div></section>
          </div>
        </div>
      </div>
    </div>

    <div className="middle-layout">
      <section className="light-panel" id="central-alertas" tabIndex={-1} aria-label="Central de alertas com dados reais">
        <PanelHeading title="Central de Alertas" subtitle={`${itens.length} alertas de fontes reais; Brasil e América do Sul primeiro.`} icon={BellRing}><span className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">Dados reais</span></PanelHeading>
        <div className="compact-tabs">{([['todos', 'Todos'], ['brasil', 'Brasil e região'], ['mundo', 'Resto do mundo']] as const).map(([id, rotulo]) => <button key={id} type="button" aria-pressed={aba === id} onClick={() => setAba(id)}>{rotulo}</button>)}</div>
        <div className="flex flex-wrap gap-2 px-3 pb-2"><label className="flex min-w-0 flex-1 items-center gap-1 rounded border px-2"><Search className="size-3 text-muted-foreground" /><input aria-label="Buscar alerta na central" placeholder="Buscar alerta ou lugar…" value={filtro} onChange={e => setFiltro(e.target.value)} className="min-w-0 w-full py-1.5 text-xs outline-none" /></label></div>
        <div className="max-h-[360px] overflow-auto px-2 pb-2"><table className="data-table"><caption className="sr-only">Alertas de fontes reais</caption><thead><tr><th>Tipo</th><th>Onde</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filtrados.map(item => <tr key={item.id}><td className="max-w-44 font-medium">{item.titulo}</td><td>{item.local}</td><td><RiskBadge level={item.nivel} /></td><td><button type="button" className="rounded border bg-white px-2 py-0.5 text-xs" onClick={() => abrir(item)} aria-label={`Ver detalhes: ${item.titulo}`}>Ver</button></td></tr>)}</tbody></table>{filtrados.length === 0 && <p role="status" className="p-5 text-center text-xs text-muted-foreground">{itens.length ? 'Nenhum alerta corresponde aos filtros.' : 'Consultando as fontes…'}</p>}</div>
      </section>
      <section className="light-panel" aria-label="Abrigos e saúde mais perto">
        <PanelHeading title="Abrigos e saúde perto" subtitle={`${cidade.nome} · OpenStreetMap`} icon={House} />
        <ul className="space-y-1 px-2 pb-2">{maisPerto.map(p => <li key={p.lugar.id} className="flex items-start gap-2 rounded-md p-2" style={{ background: '#f7fafc' }}><span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white" style={{ background: p.cor }}>{p.tipo === 'casa' ? <House className="size-3.5" /> : <Stethoscope className="size-3.5" />}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold leading-tight">{p.lugar.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{p.rotulo} · {p.lugar.distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km do centro</p></div><a className="text-link" href={p.lugar.osmUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ver ${p.lugar.name} no OpenStreetMap`}><ExternalLink className="size-3.5" /></a></li>)}</ul>
        {lugares.dados && maisPerto.length === 0 && <p className="px-3 pb-3 text-xs text-muted-foreground">Nenhum local mapeado perto do centro.</p>}
        {!lugares.dados && <p role="status" className="px-3 pb-3 text-xs text-muted-foreground">{lugares.erro ? 'OpenStreetMap indisponível agora.' : 'Buscando…'}</p>}
        <p className="px-3 pb-3 text-xs text-muted-foreground">Mapeado por voluntários: não confirma vaga nem funcionamento. <Link to="/abrigos" className="underline">Lista completa</Link></p>
      </section>
      <section className="light-panel" aria-label="Fontes consultadas">
        <PanelHeading title="Fontes consultadas" subtitle="Tudo público e sem chave" icon={CloudSun} />
        <ul className="space-y-1 px-3 pb-3 text-xs">{fontes.map(f => <li key={f.nome} className="flex items-start gap-2 border-b pb-1.5 last:border-0"><span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: f.ok ? '#0aaa86' : f.erro ? '#fa244b' : '#f5a016' }} /><div className="min-w-0 flex-1"><p className="font-semibold">{f.nome}</p><p className="text-muted-foreground"><a href={f.url} target="_blank" rel="noopener noreferrer" className="underline">{f.origem}</a>{f.ok && f.texto ? ` · ${f.texto}` : f.erro ? ' · indisponível agora' : ' · consultando…'}</p></div></li>)}</ul>
      </section>
    </div>

    <section className="light-panel mt-3 flex flex-wrap items-center justify-between gap-3 p-3 text-xs" aria-label="Painéis sem fonte real">
      <p className="max-w-3xl text-muted-foreground"><strong className="text-foreground">Visão Corporativa, Impacto Social e número de pessoas</strong> não têm fonte pública em tempo real, por isso aparecem só no Modo demonstração (dados fictícios).</p>
      <Button size="sm" variant="outline" onClick={onDemo}>Ver Modo demonstração</Button>
    </section>

    <Dialog open={detalhe !== null} onOpenChange={open => { if (!open) setDetalhe(null) }}><DialogContent className="max-h-[85dvh] overflow-y-auto text-foreground" onCloseAutoFocus={event => { event.preventDefault(); gatilho.current?.focus() }}>
      <DialogHeader><DialogTitle>{detalhe?.orientar ? 'Orientação geral' : 'Detalhes do alerta'}</DialogTitle><DialogDescription>Dados reais de fonte pública, consultados agora.</DialogDescription></DialogHeader>
      <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-800">DADOS REAIS · {detalhe?.item.fonte}</Badge>
      {detalhe && <div className="flex flex-wrap items-center justify-between gap-2 rounded border bg-secondary p-3"><div><p className="text-sm font-semibold">{detalhe.item.titulo}</p><p className="mt-1 text-xs text-muted-foreground">{detalhe.item.local} · {detalhe.item.quando}</p></div><RiskBadge level={detalhe.item.nivel} /></div>}
      {detalhe && !detalhe.orientar && <p className="text-sm leading-relaxed">{detalhe.item.detalhe}</p>}
      {detalhe && <div className="rounded border border-sky-200 bg-sky-50 p-3 text-sm leading-relaxed text-sky-950"><p className="text-xs font-semibold uppercase tracking-wide">Orientação geral · revise antes de divulgar</p><p className="mt-1">{orientacoes[detalhe.item.tipo]}</p></div>}
      {detalhe && <a href={detalhe.item.fonteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#075fba] underline">Fonte oficial: {detalhe.item.fonte}<ExternalLink className="size-3" /></a>}
      <p className="text-xs leading-relaxed text-muted-foreground">Não confirma risco local nem rota segura. Nenhuma mensagem é enviada: a decisão é humana.</p>
      <DialogFooter><DialogClose asChild><Button>Fechar</Button></DialogClose></DialogFooter>
    </DialogContent></Dialog>
  </>
}
