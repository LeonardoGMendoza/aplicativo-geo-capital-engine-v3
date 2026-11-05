// Painel "Alertas oficiais": visual no padrão dos serviços oficiais (NWS, MeteoAlarm, INMET).
// Meus lugares no topo, tabela por estado, mapa pintado pelo nível e o detalhe do aviso com "Ouvir".
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, ExternalLink, MapPin, ShieldAlert, Snowflake, Square, Sun, TriangleAlert, Volume2 } from 'lucide-react'
import { MapErrorBoundary } from '@/components/shared/MapErrorBoundary'
import './oficiais.css'
import type { AlertaOficial, LinhaUF, Nivel, Regiao, RespostaOficiais, ResumoLugar } from './oficiais'
import { buscarOficiais, COR_NIVEL, diaCurto, quandoTexto, REGIOES, ROTULO_NIVEL, separar, tabelaPorEstado, tabelaPorPais, TIPOS } from './oficiais'
import type { IdiomaVoz } from './voz'
import { falar, fraseDoAlerta, fraseDoLugar, gravarIdiomaVoz, IDIOMAS_VOZ, lerIdiomaVoz, vozDisponivel } from './voz'
import { MeusLugaresEditor, useMeusLugares } from '../lugares/MeusLugaresEditor'
import { useLanguage } from '@/i18n'
import { idiomaDoSite } from './voz'
import { IconeEvento } from './icones'

const Mapa = lazy(() => import('./OficiaisMapa'))
const ATUALIZAR_MS = 10 * 60 * 1000
const COR_OK = '#2e7d32'

function horario(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function IconeTempo({ codigo }: { codigo: number | null }) {
  const I: LucideIcon = codigo == null ? Cloud : codigo >= 95 ? CloudLightning : (codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86 ? Snowflake
    : (codigo >= 61 && codigo <= 67) || (codigo >= 80 && codigo <= 82) ? CloudRain : codigo >= 51 && codigo <= 57 ? CloudDrizzle
    : codigo === 45 || codigo === 48 ? CloudFog : codigo <= 1 ? Sun : codigo === 2 ? CloudSun : Cloud
  return <I className="ofc-dia-icone" aria-hidden="true" />
}

/** Botão "Ouvir": lê o texto com a voz do aparelho (funciona sem internet). */
function BotaoOuvir({ texto, idioma, rotulo = 'Ouvir' }: { texto: () => string; idioma: IdiomaVoz; rotulo?: string }) {
  const [falando, setFalando] = useState(false)
  const parar = useRef<(() => void) | null>(null)
  useEffect(() => () => parar.current?.(), [])
  if (!vozDisponivel()) return null
  function alternar() {
    if (falando) { parar.current?.(); setFalando(false); return }
    setFalando(true)
    parar.current = falar(texto(), idioma, () => setFalando(false))
  }
  return <button type="button" className="ofc-ouvir" onClick={alternar} aria-pressed={falando} aria-label={falando ? 'Parar leitura' : `${rotulo} em voz alta`}>
    {falando ? <Square className="size-3.5" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}{falando ? 'Parar' : rotulo}
  </button>
}

function seloDoLugar(c: ResumoLugar) {
  if (!c.nivel) return { texto: 'Normal', cor: COR_OK }
  return { texto: ROTULO_NIVEL[c.nivel], cor: COR_NIVEL[c.nivel] }
}

function CartaoLugar({ c, idioma }: { c: ResumoLugar; idioma: IdiomaVoz }) {
  const selo = seloDoLugar(c)
  const a = c.alertas[0]
  const pior = c.previsao.find(d => d.nivel)
  return <article className="ofc-lugar" style={{ '--c': selo.cor } as CSSProperties}>
    <header className="ofc-lugar-topo">
      <div><h3>{c.nome}</h3><p>{c.pais ?? 'Meu lugar'}</p></div>
      <span className={`ofc-selo ${c.nivel === 'moderado' ? 'is-claro' : ''}`}>{selo.texto}</span>
    </header>
    <p className="ofc-lugar-status">
      {a ? <><span className="ofc-fonte">{a.fonte.split(' ')[0]}</span><b>{a.evento}</b> {a.quando === 'vem' ? quandoTexto(a).toLowerCase() : `em vigor · ${quandoTexto(a).toLowerCase()}`}.</>
        : pior ? <><span className="ofc-fonte">Previsão</span>{pior.motivos[0]} ({diaCurto(pior.data).semana.toLowerCase()} {diaCurto(pior.data).dia}).</>
          : 'Sem alertas oficiais. Nenhum perigo previsto para os próximos 7 dias.'}
    </p>
    {c.previsao.length > 0 && <ol className="ofc-dias" aria-label="Próximos 7 dias">{c.previsao.map(d => <li key={d.data} title={d.motivos.join(' · ') || 'Sem perigo previsto'}>
      <span className="ofc-dia-sem">{diaCurto(d.data).semana}</span><span className="ofc-dia-num">{diaCurto(d.data).dia}</span>
      <IconeTempo codigo={d.codigo} />
      <span className="ofc-dia-temp">{d.tmax != null ? `${Math.round(d.tmax)}°` : '–'}<small>/{d.tmin != null ? `${Math.round(d.tmin)}°` : '–'}</small></span>
      <i className="ofc-dia-barra" style={d.nivel ? { background: COR_NIVEL[d.nivel] } : undefined} />
    </li>)}</ol>}
    <footer className="ofc-lugar-acoes"><BotaoOuvir texto={() => fraseDoLugar(c, idioma)} idioma={idioma} /></footer>
  </article>
}

function CelulaUF({ nivel, tipo }: { nivel?: Nivel; tipo: string }) {
  if (!nivel) return <td><span className="ofc-cel is-vazia" aria-label={`${tipo}: sem aviso`} /></td>
  return <td><span className={`ofc-cel ${nivel === 'moderado' ? 'is-claro' : ''}`} style={{ background: COR_NIVEL[nivel] }} aria-label={`${tipo}: ${ROTULO_NIVEL[nivel]}`} title={`${tipo}: ${ROTULO_NIVEL[nivel]}`}>
    <IconeEvento evento={tipo} className="size-3.5" /></span></td>
}

/** Tabela no estilo MeteoAlarm: por estado (Brasil) ou por país (resto do mundo). */
function TabelaNiveis({ modo, alertas, onFiltro, filtro }: { modo: 'estado' | 'pais'; alertas: AlertaOficial[]; onFiltro: (k: string | null) => void; filtro: string | null }) {
  const todas = useMemo(() => modo === 'estado' ? tabelaPorEstado(alertas) : tabelaPorPais(alertas), [alertas, modo])
  const [verTodos, setVerTodos] = useState(false)
  const comAviso = todas.filter(l => l.max).length
  const chave = (l: LinhaUF) => modo === 'estado' ? l.uf : l.nome
  const linhas = modo === 'pais' || verTodos ? todas : todas.filter(l => l.max || l.uf === filtro)
  return <div className="ofc-tabela-wrap">
    <div className="ofc-bloco-titulo"><h3>{modo === 'estado' ? 'Avisos em vigor por estado' : 'Avisos em vigor por país'}</h3>
      <p>{modo === 'estado' ? `${comAviso} de 27 estados com aviso` : `${comAviso} ${comAviso === 1 ? 'país' : 'países'} com aviso nesta região`} · cor = nível mais alto de cada tipo · toque numa linha para filtrar</p></div>
    {modo === 'pais' && todas.length === 0 && <p className="ofc-vazio">Nenhum país com aviso oficial nesta região agora.</p>}
    {todas.length > 0 && <table className="ofc-tabela">
      <thead><tr><th scope="col">{modo === 'estado' ? 'UF' : 'País'}</th><th scope="col" className="is-esq">{modo === 'estado' ? 'Estado' : 'Nome'}</th>{TIPOS.map(t => <th key={t.id} scope="col">{t.nome}</th>)}<th scope="col">Avisos</th></tr></thead>
      <tbody>{linhas.map(l => <tr key={chave(l)} className={filtro === chave(l) ? 'is-ativo' : ''} onClick={() => onFiltro(filtro === chave(l) ? null : chave(l))}>
        <td><span className="ofc-uf" style={{ borderLeftColor: l.max ? COR_NIVEL[l.max] : COR_OK }}>{l.uf}</span></td>
        <td className="is-esq"><button type="button" className="ofc-uf-nome" aria-pressed={filtro === chave(l)}>{l.nome}</button></td>
        {TIPOS.map(t => <CelulaUF key={t.id} nivel={l.tipos[t.id]} tipo={t.nome} />)}
        <td className="ofc-qtd">{l.alertas.length || '–'}</td>
      </tr>)}</tbody>
    </table>}
    {modo === 'estado' && <button type="button" className="ofc-ver-todos" onClick={() => setVerTodos(v => !v)}>{verTodos ? 'Mostrar só os estados com aviso' : `Ver os 27 estados (${27 - comAviso} sem aviso)`}</button>}
  </div>
}

function LinhaAlerta({ a, ativo, onSelect }: { a: AlertaOficial; ativo: boolean; onSelect: (id: string) => void }) {
  return <button type="button" className={`ofc-linha ${ativo ? 'is-ativo' : ''}`} style={{ '--c': COR_NIVEL[a.severidade] } as CSSProperties} aria-pressed={ativo} onClick={() => onSelect(a.id)}>
    <span className="ofc-linha-icone"><IconeEvento evento={a.evento} className="size-[18px]" /></span>
    <span className="ofc-linha-texto"><b>{a.evento}{a.pais && a.regiao !== 'brasil' ? ` · ${a.pais}` : ''}</b><small>{a.area ? (a.area.length > 90 ? `${a.area.slice(0, 90)}…` : a.area) : '—'}</small></span>
    <span className="ofc-linha-tempo">{quandoTexto(a)}<small>{a.fonte.split(' ')[0]}</small></span>
  </button>
}

function Detalhe({ a, idioma }: { a: AlertaOficial; idioma: IdiomaVoz }) {
  return <div className="ofc-detalhe" aria-live="polite">
    <div>
      <h3 className="ofc-detalhe-titulo"><IconeEvento evento={a.evento} className="size-5" /><span>{a.evento} · {ROTULO_NIVEL[a.severidade]}</span></h3>
      <p>{a.descricao ?? a.titulo ?? 'Sem descrição na fonte oficial.'}</p>
      <div className="mt-2"><BotaoOuvir texto={() => fraseDoAlerta(a, idioma)} idioma={idioma} rotulo="Ouvir alerta" /></div>
    </div>
    <div><h4>O que fazer</h4><p>{a.instrucao ?? 'Siga as orientações da Defesa Civil local. Em perigo, ligue 199.'}</p></div>
    <div><h4>Vigência e fonte</h4><p>{quandoTexto(a)}<br />{a.fonte}</p>
      {a.area && <details className="mt-1"><summary>Áreas atingidas</summary><p className="ofc-areas">{a.area}</p></details>}
      {a.link && <a className="ofc-link" href={a.link} target="_blank" rel="noreferrer">Ver aviso oficial <ExternalLink className="size-3.5" aria-hidden="true" /></a>}</div>
  </div>
}

export function OficiaisSecao() {
  const [dados, setDados] = useState<RespostaOficiais | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [regiao, setRegiao] = useState<'todos' | Regiao>('brasil')
  const [aba, setAba] = useState<'agora' | 'vem'>('agora')
  const [amarelos, setAmarelos] = useState(true)
  const [estado, setEstado] = useState<string | null>(null)
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [idioma, setIdioma] = useState<IdiomaVoz>(() => lerIdiomaVoz())
  const [lugares, setLugares] = useMeusLugares()
  const chaveLugares = lugares.map(l => `${l.id}:${l.latitude},${l.longitude}`).join('|')
  useEffect(() => {
    let abort = new AbortController()
    const carregar = () => buscarOficiais(lugares, { signal: abort.signal }).then(r => { setDados(r); setErro(null) }).catch(e => { if (!abort.signal.aborted) setErro(e instanceof Error ? e.message : 'Alertas oficiais indisponíveis agora.') })
    carregar()
    const timer = setInterval(() => { abort.abort(); abort = new AbortController(); carregar() }, ATUALIZAR_MS)
    return () => { clearInterval(timer); abort.abort() }
  }, [chaveLugares]) // busca de novo quando a lista de lugares muda

  const doBrasil = useMemo(() => (dados?.alertas ?? []).filter(a => a.regiao === 'brasil' && a.quando === 'agora'), [dados])
  const { agora, vem } = useMemo(() => separar(dados?.alertas ?? [], regiao, amarelos), [dados, regiao, amarelos])
  const filtrarUF = (l: AlertaOficial[]) => !estado ? l : regiao === 'brasil' ? l.filter(a => a.ufs?.includes(estado)) : l.filter(a => a.pais === estado)
  const lista = filtrarUF(aba === 'agora' ? agora : vem)
  const noMapa = useMemo(() => [...agora, ...vem], [agora, vem])
  const selecionado = noMapa.find(a => a.id === selecionadoId) ?? lista[0] ?? null
  const todosLugares = [...(dados?.lugares ?? []), ...(dados?.locaisPadrao ?? [])]
  const fontes = dados?.fontes ?? []
  function trocarIdioma(v: IdiomaVoz) { setIdioma(v); gravarIdiomaVoz(v) }
  // A voz acompanha o idioma do site (menu "Idioma" na lateral)
  const { language } = useLanguage()
  useEffect(() => { trocarIdioma(idiomaDoSite(language)) }, [language]) // eslint-disable-line

  return <div className="ofc space-y-3">
    {(dados?.locaisPadrao.length ?? 0) > 0 && <section className="ofc-painel" aria-label="Locais monitorados">
      <header className="ofc-painel-topo"><h2><ShieldAlert className="size-4" aria-hidden="true" />Locais monitorados</h2><span className="ofc-meta">Definidos pela Defesa Civil desta instalação</span></header>
      <div className="ofc-lugares">{dados!.locaisPadrao.map(c => <CartaoLugar key={c.id} c={c} idioma={idioma} />)}</div>
    </section>}

    <section className="ofc-painel" aria-label="Meus lugares: alertas e previsão">
      <header className="ofc-painel-topo">
        <h2><MapPin className="size-4" aria-hidden="true" />Meus lugares</h2>
        <div className="ofc-meta">
          {dados && <span>{dados.guardado ? `Sem conexão · cópia de ${horario(dados.obtidoEm)}` : `Atualizado ${horario(dados.obtidoEm)}`}</span>}
          {vozDisponivel() && <label className="ofc-idioma"><Volume2 className="size-3.5" aria-hidden="true" /><span className="sr-only">Idioma da voz</span>
            <select value={idioma} onChange={e => trocarIdioma(e.target.value as IdiomaVoz)}>{IDIOMAS_VOZ.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}</select></label>}
        </div>
      </header>
      {lugares.length > 0 && !dados && !erro && <p className="ofc-vazio" role="status">Buscando alertas oficiais e previsão dos seus lugares…</p>}
      {!dados && erro && <p className="ofc-vazio" role="status">{erro} Isso não indica ausência de risco.</p>}
      {dados && dados.lugares.length > 0 && <div className="ofc-lugares">{dados.lugares.map(c => <CartaoLugar key={c.id} c={c} idioma={idioma} />)}</div>}
      <div className="ofc-editor"><MeusLugaresEditor lugares={lugares} onChange={setLugares} /></div>
    </section>

    <section className="ofc-painel" aria-label="Alertas oficiais">
      <header className="ofc-painel-topo">
        <h2><TriangleAlert className="size-4" aria-hidden="true" />Alertas oficiais</h2>
        <ul className="ofc-fontes" aria-label="Situação das fontes">{fontes.map(f => <li key={f.id} title={f.estado === 'sucesso' ? 'Respondendo' : f.estado === 'antigo' ? 'Fora do ar: mostrando a última lista' : 'Fora do ar'}>
          <i className={`ofc-ponto is-${f.estado}`} />{f.nome.split(' (')[0]}</li>)}</ul>
      </header>
      <div className="ofc-barra">
        <div className="flex flex-wrap gap-2">
          <div className="ofc-seg" role="group" aria-label="Quando">
            <button type="button" aria-pressed={aba === 'agora'} onClick={() => { setAba('agora'); setSelecionadoId(null) }}>Em vigor<span>{filtrarUF(agora).length}</span></button>
            <button type="button" aria-pressed={aba === 'vem'} onClick={() => { setAba('vem'); setSelecionadoId(null) }}>Próximos dias<span>{filtrarUF(vem).length}</span></button>
          </div>
          <div className="ofc-seg" role="group" aria-label="Região">
            {REGIOES.map(r => <button key={r.id} type="button" aria-pressed={regiao === r.id} onClick={() => { setRegiao(r.id); setEstado(null); setSelecionadoId(null) }}>{r.nome}</button>)}
          </div>
        </div>
        <div className="ofc-legenda">
          {(['extremo', 'severo', 'moderado'] as Nivel[]).map(n => <span key={n}><i style={{ background: COR_NIVEL[n] }} />{ROTULO_NIVEL[n]}</span>)}
          <label><input type="checkbox" checked={amarelos} onChange={e => setAmarelos(e.target.checked)} /> Incluir “Atenção”</label>
        </div>
      </div>
      {fontes.some(f => f.estado !== 'sucesso') && <p className="ofc-aviso-fonte" role="status">Fonte fora do ar: {fontes.filter(f => f.estado !== 'sucesso').map(f => f.nome).join(' · ')}. Isso não indica ausência de risco.</p>}
      <div className="ofc-corpo">
        <MapErrorBoundary message="Mapa indisponível. A lista ao lado continua valendo."><Suspense fallback={<p role="status" className="ofc-mapa ofc-vazio">Carregando mapa…</p>}>
          <Mapa alertas={noMapa} lugares={todosLugares} selecionado={selecionado} onSelect={setSelecionadoId} />
        </Suspense></MapErrorBoundary>
        <div className="ofc-lista" aria-label={aba === 'agora' ? 'Alertas em vigor' : 'Alertas dos próximos dias'}>
          {estado && <p className="ofc-filtro">Mostrando: <b>{estado}</b> <button type="button" onClick={() => setEstado(null)}>limpar</button></p>}
          {dados && lista.length === 0 && <p className="ofc-vazio">Nenhum alerta oficial {aba === 'agora' ? 'em vigor' : 'para os próximos dias'} nesta seleção.</p>}
          {lista.slice(0, 100).map(a => <LinhaAlerta key={a.id} a={a} ativo={a.id === selecionado?.id} onSelect={setSelecionadoId} />)}
        </div>
      </div>
      {selecionado && <Detalhe a={selecionado} idioma={idioma} />}
      <TabelaNiveis modo={regiao === 'brasil' ? 'estado' : 'pais'} alertas={regiao === 'brasil' ? doBrasil : agora} filtro={estado}
        onFiltro={k => { setEstado(k); setAba('agora'); setSelecionadoId(null) }} />
      <footer className="ofc-rodape"><span>Fontes oficiais de cada país. Este painel não substitui as orientações da Defesa Civil local.</span><span>Brasil: Defesa Civil 199 · Bombeiros 193 · SAMU 192</span></footer>
    </section>
  </div>
}

export function AlertasOficiaisPage() {
  return <div className="space-y-3">
    <header className="text-white"><h1 className="text-2xl font-semibold">Alertas oficiais</h1>
      <p className="mt-1 text-xs text-[#b5d2e2]">Avisos dos serviços meteorológicos de cada país e previsão para os seus lugares.</p></header>
    <OficiaisSecao />
  </div>
}
