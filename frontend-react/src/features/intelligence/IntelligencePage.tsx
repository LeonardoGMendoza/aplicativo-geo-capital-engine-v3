import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BrainCircuit, FileText, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ask, citacao, estadoTexto, getStatus, nomesDocumentos, perfis, perguntasProntas } from './intelligence'
import type { Perfil, Resposta, Status } from './intelligence'

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
  return <div className="min-w-0 space-y-5">
    <header><p className="text-xs font-semibold text-[#25d3b6]">OMNI-ECORESCUE / V3</p><h1 className="mt-1 text-2xl font-semibold">Inteligência (IA)</h1>
      <p className="mt-2 text-sm text-[#b5d2e2]">Pergunte aos documentos oficiais de desastres passados. A IA sugere com a fonte e a página; o humano decide.</p></header>

    <section className="light-panel space-y-3 p-4" aria-labelledby="ia-pergunta">
      <h2 id="ia-pergunta" className="flex items-center gap-2 text-base font-semibold"><BrainCircuit className="size-5 text-[#0866d0]" aria-hidden="true" />Faça uma pergunta</h2>
      <p role="status" className="text-sm text-muted-foreground">{estadoTexto(status)}</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">Quem está perguntando?
          <select className="mini-select mt-1 w-full sm:w-auto" value={perfil} onChange={e => setPerfil(e.target.value as Perfil)}>{perfis.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </label>
        <label className="block text-sm" htmlFor="ia-texto">Sua pergunta</label>
        <textarea id="ia-texto" className="mini-select w-full text-sm" rows={3} maxLength={300} value={pergunta} onChange={e => setPergunta(e.target.value)} placeholder="Ex.: Como organizar a evacuação numa enchente?" />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={carregando || indisponivel || pergunta.trim().length < 3}>{carregando ? 'Consultando…' : 'Perguntar à IA'}</Button>
          <span className="text-xs text-muted-foreground">{pergunta.length}/300</span>
        </div>
      </form>
      <div className="flex flex-wrap gap-2" aria-label="Perguntas prontas">
        {perguntasProntas.map(p => <button key={p} type="button" className="mini-select text-left" disabled={carregando || indisponivel} onClick={() => void enviar(p)}>{p}</button>)}
      </div>
    </section>

    {carregando && <p role="status" className="light-panel p-4 text-sm">Buscando nos documentos e escrevendo a resposta… pode levar até 30 segundos.</p>}
    {erro && <p role="alert" className="light-panel p-4 text-sm text-amber-900">{erro}</p>}

    {resultado && <section className="light-panel space-y-3 p-4" aria-live="polite" aria-labelledby="ia-resposta">
      <h2 id="ia-resposta" className="text-base font-semibold">{resultado.modo === 'ia' ? 'Sugestão da IA' : 'Trechos encontrados'}</h2>
      <p className="text-xs text-muted-foreground">Pergunta: {resultado.pergunta}</p>
      {resultado.modo === 'ia' && resultado.resposta
        ? <><p className="whitespace-pre-line text-sm leading-relaxed">{resultado.resposta}</p><p className="text-xs text-muted-foreground">Gerado por {resultado.modelo}, a partir dos trechos abaixo.</p></>
        : <p className="text-sm text-amber-900">A IA da Oracle não respondeu agora. Abaixo estão os trechos mais parecidos encontrados nos documentos.</p>}
      <p className="flex items-start gap-2 text-xs font-semibold text-[#0866d0]"><ShieldCheck className="size-4 shrink-0" aria-hidden="true" />{resultado.aviso}</p>
      <h3 className="pt-1 text-sm font-semibold">De onde veio</h3>
      <ol className="space-y-2">{resultado.trechos.map((t, i) => <li key={`${t.fonte}-${t.pagina}-${i}`} className="rounded-md border border-[#d6e5ee] p-3">
        <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold"><FileText className="size-4 text-[#0866d0]" aria-hidden="true" />[{i + 1}] {nomesDocumentos[t.fonte] ?? t.fonte} · {citacao(t)}<span className="font-normal text-muted-foreground">· semelhança {Math.round(t.similaridade * 100)}%</span></p>
        <details className="mt-1 text-sm"><summary className="cursor-pointer text-xs text-[#075fba]">Ver trecho</summary><p className="mt-1 leading-relaxed">{t.texto}</p></details>
      </li>)}</ol>
    </section>}

    <section className="light-panel space-y-2 p-4" aria-labelledby="ia-base">
      <h2 id="ia-base" className="text-base font-semibold">Base de documentos</h2>
      {status?.documentos.length ? <ul className="space-y-1 text-sm">{status.documentos.map(d => <li key={d.fonte}>{nomesDocumentos[d.fonte] ?? d.fonte} · {d.paginas} páginas</li>)}</ul> : <p className="text-sm text-muted-foreground">Lista indisponível no momento.</p>}
      <p className="text-xs text-muted-foreground">Como funciona: cada documento foi dividido em trechos; a pergunta é comparada com todos (Cohere, busca por semelhança) e os 3 mais parecidos vão para a IA da Oracle Cloud, que escreve a resposta citando PDF e página. Os documentos tratam de desastres passados: a resposta é apoio, não ordem.</p>
    </section>
  </div>
}
