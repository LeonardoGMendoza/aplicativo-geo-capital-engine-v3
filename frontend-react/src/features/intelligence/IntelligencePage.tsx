import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { BookOpen, BrainCircuit, FileText, House, Layers, Mountain, Send, ShieldCheck, Siren, Sparkles, Waves } from 'lucide-react'
import { ask, citacao, estadoTexto, getStatus, nomesDocumentos, partesNegrito, perfis, perguntasProntas } from './intelligence'
import type { Perfil, Resposta, Status } from './intelligence'
import './intelligence.css'

// Cores das perguntas prontas, no estilo dos botões de categoria da sala de controle
const visualPerguntas = [
  { Icon: Waves, cor: '#0284c7' },
  { Icon: Siren, cor: '#e11d48' },
  { Icon: House, cor: '#16a34a' },
  { Icon: Mountain, cor: '#d97706' },
]
const corChip = (cor: string) => ({ '--chip': cor, '--chip-bg': `${cor}14`, '--chip-glow': `${cor}40` }) as CSSProperties
const corKpi = (cor: string) => ({ '--kpi': cor, '--kpi-glow': `${cor}2e` }) as CSSProperties

export function IntelligencePage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [pergunta, setPergunta] = useState('')
  const [perfil, setPerfil] = useState<Perfil>('defesa_civil')
  const [resultado, setResultado] = useState<Resposta | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const pedido = useRef<AbortController | null>(null)

  useEffect(() => {
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const consultar = () => getStatus().then(s => {
      if (!vivo) return
      setStatus(s)
      if (s.estado === 'preparando' || s.estado === 'parado') timer = setTimeout(consultar, 5000)
    }).catch(() => { if (vivo) setStatus(null) })
    consultar()
    return () => { vivo = false; clearTimeout(timer); pedido.current?.abort() }
  }, [])

  async function enviar(texto: string) {
    const limpo = texto.trim()
    if (limpo.length < 3 || carregando) return
    pedido.current?.abort()
    const controle = new AbortController()
    pedido.current = controle
    setPergunta(limpo); setCarregando(true); setErro(null); setResultado(null)
    try {
      const r = await ask(limpo, perfil, { signal: controle.signal })
      if (!controle.signal.aborted) setResultado(r)
    } catch (e) {
      if (!controle.signal.aborted) setErro(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'A IA demorou demais. Tente de novo.')
    } finally {
      if (!controle.signal.aborted) setCarregando(false)
    }
  }
  function submit(event: FormEvent) { event.preventDefault(); void enviar(pergunta) }

  const indisponivel = status?.estado === 'sem_chave'
  const pronto = status?.estado === 'pronto'
  const classeStatus = pronto ? 'ok' : indisponivel || status?.estado === 'erro' || !status ? 'off' : 'wait'
  const progresso = status && status.trechos ? Math.round((status.prontos / status.trechos) * 100) : 0

  return <div className="ia-neon space-y-5">
    <header>
      <p className="ia-kicker">Omni-EcoRescue · Inteligência</p>
      <h1 className="ia-title">Inteligência (IA)</h1>
      <p className="ia-sub">Pergunte aos documentos oficiais de desastres passados. A IA sugere com a fonte e a página; o humano decide.</p>
    </header>

    <section aria-label="Base de documentos da IA" className="space-y-3">
      <p role="status" className={`ia-status ${classeStatus}`}>{estadoTexto(status)}</p>
      {status && !pronto && !indisponivel && status.estado !== 'erro' && <div className="ia-progress" aria-hidden="true"><span style={{ width: `${progresso}%` }} /></div>}
      <div className="ia-kpis">
        <div className="ia-kpi" style={corKpi('#0891b2')}><FileText className="size-8" aria-hidden="true" /><div><p className="ia-kpi-num">{status?.documentos.length ?? '–'}</p><p className="ia-kpi-label">documentos oficiais</p></div></div>
        <div className="ia-kpi" style={corKpi('#059669')}><BookOpen className="size-8" aria-hidden="true" /><div><p className="ia-kpi-num">{status ? status.paginas.toLocaleString('pt-BR') : '–'}</p><p className="ia-kpi-label">páginas lidas</p></div></div>
        <div className="ia-kpi" style={corKpi('#7c3aed')}><Layers className="size-8" aria-hidden="true" /><div><p className="ia-kpi-num">{status ? status.trechos.toLocaleString('pt-BR') : '–'}</p><p className="ia-kpi-label">trechos na busca</p></div></div>
      </div>
    </section>

    <section className="ia-panel space-y-4" aria-labelledby="ia-pergunta">
      <h2 id="ia-pergunta" className="ia-panel-title"><BrainCircuit className="size-7" aria-hidden="true" />Faça uma pergunta</h2>
      <form onSubmit={submit} className="space-y-4">
        <div><label className="ia-label" htmlFor="ia-perfil">Quem está perguntando?</label>
          <select id="ia-perfil" className="ia-input" value={perfil} onChange={e => setPerfil(e.target.value as Perfil)}>{perfis.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
        <div><label className="ia-label" htmlFor="ia-texto">Sua pergunta</label>
          <textarea id="ia-texto" className="ia-input" rows={3} maxLength={300} value={pergunta} onChange={e => setPergunta(e.target.value)} placeholder="Ex.: Como organizar a evacuação numa enchente?" /></div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="ia-ask" disabled={carregando || indisponivel || pergunta.trim().length < 3}><Send className="size-5" aria-hidden="true" />{carregando ? 'Consultando…' : 'Perguntar à IA'}</button>
          <span className="ia-count">{pergunta.length}/300</span>
        </div>
      </form>
      <div><p className="ia-label">Perguntas prontas</p>
        <div className="ia-chips" aria-label="Perguntas prontas">
          {perguntasProntas.map((p, i) => { const { Icon, cor } = visualPerguntas[i % visualPerguntas.length]
            return <button key={p} type="button" className="ia-chip" style={corChip(cor)} disabled={carregando || indisponivel} onClick={() => void enviar(p)}><Icon className="size-7" aria-hidden="true" />{p}</button> })}
        </div>
      </div>
    </section>

    {carregando && <p role="status" className="ia-panel ia-loading">Buscando nos documentos e escrevendo a resposta… pode levar até 30 segundos.</p>}
    {erro && <p role="alert" className="ia-error">{erro}</p>}

    {resultado && <section className="ia-panel space-y-4" aria-live="polite" aria-labelledby="ia-resposta">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ia-resposta" className="ia-panel-title" style={{ marginBottom: 0 }}><Sparkles className="size-7" aria-hidden="true" />{resultado.modo === 'ia' ? 'Sugestão da IA' : 'Trechos encontrados'}</h2>
        {resultado.modo === 'ia' && <span className="ia-badge">● {resultado.modelo}</span>}
      </div>
      <p className="ia-muted">Pergunta: {resultado.pergunta}</p>
      {resultado.modo === 'ia' && resultado.resposta
        ? <p className="ia-answer">{partesNegrito(resultado.resposta).map((p, i) => p.negrito ? <strong key={i}>{p.texto}</strong> : <span key={i}>{p.texto}</span>)}</p>
        : <p className="ia-warn">A IA da Oracle não respondeu agora. Abaixo estão os trechos mais parecidos encontrados nos documentos.</p>}
      <p className="ia-note"><ShieldCheck className="size-5 shrink-0" aria-hidden="true" />{resultado.aviso}</p>
      <h3 className="ia-panel-title" style={{ fontSize: 19, marginBottom: 0 }}>De onde veio</h3>
      <ol className="ia-sources">{resultado.trechos.map((t, i) => <li key={`${t.fonte}-${t.pagina}-${i}`} className="ia-source">
        <p className="ia-source-head"><FileText className="size-5" aria-hidden="true" />[{i + 1}] {nomesDocumentos[t.fonte] ?? t.fonte}<span className="ia-page">{citacao(t).replace(`${t.fonte}, `, '')}</span></p>
        <p className="ia-muted">{citacao(t)}</p>
        <div className="ia-sim"><span>semelhança {Math.round(t.similaridade * 100)}%</span><span className="ia-sim-bar" aria-hidden="true"><span style={{ width: `${Math.round(t.similaridade * 100)}%` }} /></span></div>
        <details><summary>Ver trecho</summary><p>{t.texto}</p></details>
      </li>)}</ol>
    </section>}

    <section className="ia-panel space-y-3" aria-labelledby="ia-base">
      <h2 id="ia-base" className="ia-panel-title"><BookOpen className="size-7" aria-hidden="true" />Base de documentos</h2>
      {status?.documentos.length ? <ul className="ia-docs">{status.documentos.map(d => <li key={d.fonte}><span>{nomesDocumentos[d.fonte] ?? d.fonte}</span><b>{d.paginas} pág.</b></li>)}</ul> : <p className="ia-muted">Lista indisponível no momento.</p>}
      <p className="ia-muted">Como funciona: cada documento foi dividido em trechos; a pergunta é comparada com todos (Cohere, busca por semelhança) e os 3 mais parecidos vão para a IA da Oracle Cloud, que escreve a resposta citando PDF e página. Os documentos tratam de desastres passados: a resposta é apoio, não ordem.</p>
    </section>
  </div>
}
