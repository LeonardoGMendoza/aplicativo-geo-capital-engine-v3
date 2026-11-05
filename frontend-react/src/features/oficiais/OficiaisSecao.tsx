import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { MapErrorBoundary } from '@/components/shared/MapErrorBoundary'
import './oficiais.css'
import type { AlertaOficial, Regiao, RespostaOficiais, ResumoLugar } from './oficiais'
import { MeusLugaresEditor, useMeusLugares } from '../lugares/MeusLugaresEditor'
import { BANDEIRA, buscarOficiais, COR_NIVEL, diaDaSemana, emojiEvento, emojiTempo, fraseCidade, quandoTexto, REGIOES, ROTULO_NIVEL, seloCidade, separar } from './oficiais'

const Mapa = lazy(() => import('./OficiaisMapa'))
const ATUALIZAR_MS = 10 * 60 * 1000

function horario(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function CartaoCidade({ c }: { c: ResumoLugar }) {
  const cor = c.nivel ? COR_NIVEL[c.nivel] : '#15803d'
  return <details className="ofc-cidade" style={{ borderColor: cor }}>
    <summary>
      <span className="ofc-cidade-topo"><b>{BANDEIRA[c.pais] ?? ''} {c.nome}</b><span className="ofc-selo" style={{ background: cor }}>{seloCidade(c)}</span></span>
      <span className="ofc-cidade-frase">{fraseCidade(c)}</span>
      {c.previsao.length > 0 && <span className="ofc-dias" aria-label="Próximos 7 dias">{c.previsao.map(d => <span key={d.data} className="ofc-dia" title={d.motivos.join(' · ') || 'Sem perigo previsto'}>
        <small>{diaDaSemana(d.data)}</small><span>{emojiTempo(d.codigo)}</span>{d.nivel ? <i style={{ background: COR_NIVEL[d.nivel] }} /> : <i className="is-ok" />}
      </span>)}</span>}
    </summary>
    <div className="ofc-cidade-detalhe">
      {c.alertas.length === 0 && <p>Nenhum alerta oficial para esta cidade agora.</p>}
      {c.alertas.map(a => <p key={a.id}><b style={{ color: COR_NIVEL[a.severidade] }}>{emojiEvento(a.evento)} {a.evento}</b> · {quandoTexto(a)} · {a.fonte}
        {a.instrucao && <><br /><span>O que fazer: {a.instrucao}</span></>}</p>)}
      {c.previsao.filter(d => d.nivel).map(d => <p key={d.data}><b style={{ color: COR_NIVEL[d.nivel!] }}>{diaDaSemana(d.data)}</b>: {d.motivos.join(' · ')}</p>)}
      {c.previsao.length > 0 && <p className="ofc-nota">Previsão Open-Meteo (modelos meteorológicos). Não substitui o aviso oficial da Defesa Civil.</p>}
    </div>
  </details>
}

function ItemAlerta({ a, ativo, onSelect }: { a: AlertaOficial; ativo: boolean; onSelect: (id: string) => void }) {
  return <button type="button" className={`ofc-item ${ativo ? 'is-ativo' : ''}`} style={{ borderLeftColor: COR_NIVEL[a.severidade] }} aria-pressed={ativo} onClick={() => onSelect(a.id)}>
    <span className="ofc-item-titulo">{emojiEvento(a.evento)} {a.evento}{a.pais ? ` · ${a.pais}` : ''}</span>
    <span className="ofc-item-info" style={{ color: COR_NIVEL[a.severidade] }}>{ROTULO_NIVEL[a.severidade]} · {quandoTexto(a)}</span>
    {a.area && <span className="ofc-item-area">{a.area.length > 140 ? `${a.area.slice(0, 140)}…` : a.area}</span>}
  </button>
}

export function OficiaisSecao() {
  const [dados, setDados] = useState<RespostaOficiais | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [regiao, setRegiao] = useState<'todos' | Regiao>('todos')
  const [amarelos, setAmarelos] = useState(false)
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [lugares, setLugares] = useMeusLugares()
  const chaveLugares = lugares.map(l => `${l.id}:${l.latitude},${l.longitude}`).join('|')
  useEffect(() => {
    let abort = new AbortController()
    const carregar = () => buscarOficiais(lugares, { signal: abort.signal }).then(r => { setDados(r); setErro(null) }).catch(e => { if (!abort.signal.aborted) setErro(e instanceof Error ? e.message : 'Alertas oficiais indisponíveis agora.') })
    carregar()
    const timer = setInterval(() => { abort.abort(); abort = new AbortController(); carregar() }, ATUALIZAR_MS)
    return () => { clearInterval(timer); abort.abort() }
  }, [chaveLugares]) // busca de novo quando a lista de lugares muda
  const { agora, vem } = useMemo(() => separar(dados?.alertas ?? [], regiao, amarelos), [dados, regiao, amarelos])
  const noMapa = useMemo(() => [...agora, ...vem], [agora, vem])
  const selecionado = noMapa.find(a => a.id === selecionadoId) ?? null
  const todosLugares = [...(dados?.lugares ?? []), ...(dados?.locaisPadrao ?? [])]
  const emPerigo = todosLugares.filter(c => c.nivel === 'extremo' || c.nivel === 'severo')
  const fora = (dados?.fontes ?? []).filter(f => f.estado !== 'sucesso')

  return <>
    {(dados?.locaisPadrao.length ?? 0) > 0 && <section className="light-panel space-y-2 p-3" aria-label="Locais monitorados">
      <h2 className="text-lg font-semibold">🏛️ Locais monitorados</h2>
      <p className="text-xs text-muted-foreground">Definidos por quem administra este Omni (por exemplo, a Defesa Civil da cidade).</p>
      <div className="ofc-cidades">{dados!.locaisPadrao.map(c => <CartaoCidade key={c.id} c={c} />)}</div>
    </section>}

    <section className="light-panel ofc-familia space-y-2 p-3" aria-label="Meus lugares: alertas e previsão">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">📍 Meus lugares</h2>
        {dados && <span className="text-xs text-muted-foreground">{dados.guardado ? `Sem conexão · última cópia de ${horario(dados.obtidoEm)}` : `Atualizado ${horario(dados.obtidoEm)}`}</span>}
      </div>
      {emPerigo.length > 0 && <p role="alert" className="ofc-faixa">⚠️ Perigo agora ou nos próximos dias em: <b>{emPerigo.map(c => c.nome).join(', ')}</b>. Toque no lugar para ver o que fazer.</p>}
      {lugares.length > 0 && !dados && !erro && <p role="status">Buscando alertas oficiais e previsão dos seus lugares…</p>}
      {!dados && erro && <p role="status">{erro} Isso não indica ausência de risco.</p>}
      {dados && dados.lugares.length > 0 && <div className="ofc-cidades">{dados.lugares.map(c => <CartaoCidade key={c.id} c={c} />)}</div>}
      <MeusLugaresEditor lugares={lugares} onChange={setLugares} />
    </section>

    <section className="light-panel space-y-2 p-3" aria-label="Alertas oficiais do mundo">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">🚨 Alertas oficiais: agora e vem aí</h2>
        <span className="text-xs text-muted-foreground">INMET · NWS/NOAA · MeteoAlarm · Tsunami NOAA · USGS · GDACS</span>
      </div>
      <p className="text-xs">Tornado, temporal, vendaval, granizo, enchente, nevasca, tsunami e terremoto, direto dos serviços oficiais de cada país. <b>No Brasil, em perigo ligue 199 (Defesa Civil).</b></p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {REGIOES.map(r => <button key={r.id} type="button" className="mini-select" aria-pressed={regiao === r.id} style={regiao === r.id ? { background: '#0b2235', color: '#fff' } : undefined} onClick={() => { setRegiao(r.id); setSelecionadoId(null) }}>{r.nome}</button>)}
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={amarelos} onChange={e => setAmarelos(e.target.checked)} />Mostrar também avisos amarelos</label>
      </div>
      {fora.length > 0 && <p role="status" className="text-xs text-amber-900">Fora do ar agora: {fora.map(f => `${f.nome}${f.estado === 'antigo' ? ' (mostrando a última lista)' : ''}`).join(' · ')}. Isso não indica ausência de risco.</p>}
      <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(260px,380px)]">
        <MapErrorBoundary message="Mapa indisponível. A lista ao lado continua valendo."><Suspense fallback={<p role="status" className="ofc-mapa flex items-center justify-center rounded border bg-secondary">Carregando mapa…</p>}>
          <Mapa alertas={noMapa} lugares={todosLugares} selecionado={selecionado} onSelect={setSelecionadoId} />
        </Suspense></MapErrorBoundary>
        <div className="ofc-listas">
          <h3>🔴 Acontecendo agora <small>({agora.length})</small></h3>
          {dados && agora.length === 0 && <p className="text-xs">Nenhum alerta oficial ativo nesta região.</p>}
          {agora.slice(0, 80).map(a => <ItemAlerta key={a.id} a={a} ativo={a.id === selecionadoId} onSelect={setSelecionadoId} />)}
          <h3>🟠 Vem aí <small>({vem.length})</small></h3>
          {dados && vem.length === 0 && <p className="text-xs">Nenhum aviso para as próximas horas/dias nesta região.</p>}
          {vem.slice(0, 80).map(a => <ItemAlerta key={a.id} a={a} ativo={a.id === selecionadoId} onSelect={setSelecionadoId} />)}
        </div>
      </div>
      {selecionado && <div role="status" className="ofc-selecionado" style={{ borderColor: COR_NIVEL[selecionado.severidade] }}>
        <strong>{emojiEvento(selecionado.evento)} {selecionado.titulo ?? selecionado.evento}</strong>
        <p style={{ color: COR_NIVEL[selecionado.severidade] }}>{ROTULO_NIVEL[selecionado.severidade]} · {quandoTexto(selecionado)} · {selecionado.fonte}</p>
        {selecionado.descricao && <p>{selecionado.descricao}</p>}
        {selecionado.instrucao && <p><b>O que fazer:</b> {selecionado.instrucao}</p>}
        {selecionado.area && <details><summary>Áreas atingidas</summary><p>{selecionado.area}</p></details>}
        {selecionado.link && <a href={selecionado.link} target="_blank" rel="noreferrer">Ver na fonte oficial ↗</a>}
      </div>}
    </section>
  </>
}
