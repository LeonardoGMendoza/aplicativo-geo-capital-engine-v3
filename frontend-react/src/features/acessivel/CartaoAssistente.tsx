// Cartão da assistente na Área do cidadão: a Clara já aparece (como no VinaCare) e o botão abre a conversa.
// O 3D só carrega quando o cartão aparece na tela e se houver internet (e o aparelho não estiver em economia de dados).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mic } from 'lucide-react'
import type { Assistente, NomeAssistente } from './avatar'
import './acessivel.css'

function podeCarregar() {
  if (typeof navigator === 'undefined' || navigator.onLine === false) return false
  const c = (navigator as unknown as { connection?: { saveData?: boolean } }).connection
  return !c?.saveData
}

export function CartaoAssistente() {
  const palco = useRef<HTMLDivElement>(null)
  const assistente = useRef<Assistente | null>(null)
  const [estado, setEstado] = useState<'espera' | number | 'pronto' | 'sem'>(podeCarregar() ? 'espera' : 'sem')
  const nome: NomeAssistente = (() => { try { return localStorage.getItem('omni-assistente') === 'Rafael' ? 'Rafael' : 'Clara' } catch { return 'Clara' } })()
  useEffect(() => {
    if (estado !== 'espera' || !palco.current) return
    let cancelado = false
    const el = palco.current
    const abrir = async () => {
      try {
        const { Assistente } = await import('./avatar')
        if (cancelado) return
        const a = await Assistente.criar(el, nome, pct => !cancelado && setEstado(pct))
        if (cancelado) { a.destruir(); return }
        assistente.current = a
        setEstado('pronto')
      } catch { if (!cancelado) setEstado('sem') }
    }
    const obs = new IntersectionObserver(e => { if (e.some(x => x.isIntersecting)) { obs.disconnect(); void abrir() } })
    obs.observe(el)
    return () => { cancelado = true; obs.disconnect(); assistente.current?.destruir(); assistente.current = null }
  }, []) // eslint-disable-line

  return <section className="ac-cartao ac-cartao-cidadao" aria-label="Assistente de emergência">
    <header className="ac-cartao-topo">
      <div><h2>Assistente de emergência</h2><p>Pergunte falando. Entende português, espanhol e inglês.</p></div>
      <i className={`ac-ponto ${estado === 'pronto' ? 'is-pronto' : ''}`} aria-hidden="true" />
    </header>
    {estado !== 'sem' && <div className="ac-palco ac-palco-cidadao">
      <div ref={palco} className="ac-palco-3d" role="img" aria-label={`Assistente ${nome}`} />
      {typeof estado === 'number' && <p className="ac-palco-carregando" role="status">Abrindo {nome === 'Clara' ? 'a Clara' : 'o Rafael'}… {estado > 0 ? `${estado}%` : ''}</p>}
    </div>}
    <div className="ac-cartao-acao">
      <Link to="/cidadao/acessivel" className="ac-falar"><Mic aria-hidden="true" />Falar com {nome === 'Clara' ? 'a assistente' : 'o assistente'}</Link>
      <p>Letras grandes e respostas em voz alta. Funciona também sem internet (só voz).</p>
    </div>
  </section>
}
