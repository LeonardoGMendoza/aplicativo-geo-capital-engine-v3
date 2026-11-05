// Modo acessível: para idosos, quem enxerga pouco ou lê com dificuldade. Tudo grande, por voz:
// a pessoa toca e fala a pergunta; o Omni responde em texto grande e lê em voz alta.
// Sem internet: responde com os guias de emergência guardados no aparelho (a voz do celular funciona offline).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mic, Square, UserRound, Volume2 } from 'lucide-react'
import type { Assistente, NomeAssistente } from './avatar'
import { BrandSymbol } from '@/components/shared/Brand'
import { guias } from '../preparar/conteudo'
import type { Guia } from '../preparar/conteudo'
import { ask } from '../intelligence/intelligence'
import { buscarOficiais } from '../oficiais/oficiais'
import { lerLugares } from '../lugares/meusLugares'
import type { IdiomaVoz } from '../oficiais/voz'
import { falar, fraseDoLugar, gravarIdiomaVoz, idiomaDoSite, IDIOMAS_VOZ, lerIdiomaVoz, vozDisponivel } from '../oficiais/voz'
import { useLanguage } from '@/i18n'
import './acessivel.css'

/** Perguntas prontas: cada uma tem um guia que funciona sem internet. */
export const ATALHOS: { texto: string; guia: string }[] = [
  { texto: 'A água está subindo', guia: 'enchente' },
  { texto: 'Faltou energia', guia: 'apagao' },
  { texto: 'Alguém se machucou', guia: 'socorros' },
  { texto: 'Estou com medo', guia: 'emocional' },
  { texto: 'Explosão ou ataque', guia: 'guerra' },
  { texto: 'Acidente nuclear', guia: 'nuclear' },
]

const PALAVRAS: Record<string, RegExp> = {
  enchente: /água|agua|enchente|alag|inunda|chuva|rio|subindo|deslizamento/i,
  apagao: /energia|luz|apagão|apagao|blecaute|sem força/i,
  socorros: /machuc|ferid|sangr|desmai|queimad|socorro|respira/i,
  emocional: /medo|ansied|pânico|panico|nervos|chorar|calma/i,
  nuclear: /nuclear|radia|usina|angra/i,
  guerra: /guerra|ataque|bomba|explos|míssil|missil|tiro/i,
  bateria: /bateria|celular|carregar/i,
}

/** Guia mais provável para uma pergunta falada (para responder sem internet). */
export function guiaParaPergunta(pergunta: string): Guia | null {
  const id = Object.entries(PALAVRAS).find(([, re]) => re.test(pergunta))?.[0]
  return id ? guias.find(g => g.id === id) ?? null : null
}

export function textoDoGuia(g: Guia) {
  return `${g.titulo}. ${g.resumo} ${g.passos.map((p, i) => `${i + 1}. ${p}`).join(' ')}`
}

export function limparParaFala(texto: string) {
  return texto.replace(/\*\*|__|#+\s?/g, '').replace(/\[(\d+)\]/g, '').replace(/\s+/g, ' ').trim()
}

type Reconhecedor = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null }
function criarReconhecedor(): Reconhecedor | null {
  const w = window as unknown as { SpeechRecognition?: new () => Reconhecedor; webkitSpeechRecognition?: new () => Reconhecedor }
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return C ? new C() : null
}

export function ModoAcessivelPage() {
  const [idioma, setIdioma] = useState<IdiomaVoz>(() => lerIdiomaVoz())
  const [ouvindo, setOuvindo] = useState(false)
  const [falando, setFalando] = useState(false)
  const [pergunta, setPergunta] = useState('')
  const [resposta, setResposta] = useState<{ titulo: string; texto: string; fonte: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  const parar = useRef<(() => void) | null>(null)
  // Assistente com rosto (opcional): o 3D só é baixado quando a pessoa liga
  const [comAssistente, setComAssistente] = useState(false)
  const [nomeAssistente, setNomeAssistente] = useState<NomeAssistente>(() => { try { return localStorage.getItem('omni-assistente') === 'Rafael' ? 'Rafael' : 'Clara' } catch { return 'Clara' } })
  const [carregando, setCarregando] = useState<number | null>(null)
  const assistente = useRef<Assistente | null>(null)
  const palco = useRef<HTMLDivElement>(null)
  useEffect(() => () => { assistente.current?.destruir(); assistente.current = null }, [])

  async function ligarAssistente() {
    if (comAssistente) { assistente.current?.destruir(); assistente.current = null; setComAssistente(false); return }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setMsg('Sem internet o assistente com rosto não abre. A voz do celular continua funcionando.'); return }
    setComAssistente(true); setCarregando(0); setMsg('')
    await new Promise(r => requestAnimationFrame(r))
    try {
      const { Assistente } = await import('./avatar')
      if (!palco.current) return
      const a = await Assistente.criar(palco.current, nomeAssistente, setCarregando)
      a.liberarSom()
      assistente.current = a
      setCarregando(null)
      const ola = { pt: `Oi, eu sou a ${nomeAssistente === 'Clara' ? 'Clara' : 'o Rafael'}. Toque no botão e me faça uma pergunta.`, es: `Hola, soy ${nomeAssistente}. Toque el botón y hágame una pregunta.`, en: `Hi, I am ${nomeAssistente}. Tap the button and ask me a question.` }
      dizer(ola[idioma])
    } catch {
      setComAssistente(false); setCarregando(null)
      setMsg('Não consegui abrir o assistente neste aparelho. A voz do celular continua funcionando.')
    }
  }
  async function trocarAssistente() {
    const novo: NomeAssistente = nomeAssistente === 'Clara' ? 'Rafael' : 'Clara'
    setNomeAssistente(novo)
    try { localStorage.setItem('omni-assistente', novo) } catch { /* ignore */ }
    if (!assistente.current) return
    setCarregando(0)
    try { await assistente.current.trocar(novo, setCarregando) } finally { setCarregando(null) }
  }
  const rec = useRef<Reconhecedor | null>(null)
  const temMicrofone = typeof window !== 'undefined' && !!criarReconhecedor()
  const bcp = IDIOMAS_VOZ.find(i => i.id === idioma)!.bcp
  useEffect(() => () => { parar.current?.(); rec.current?.stop() }, [])
  const { language } = useLanguage()
  useEffect(() => { const v = idiomaDoSite(language); setIdioma(v); gravarIdiomaVoz(v) }, [language])

  function dizer(texto: string, lingua: IdiomaVoz = idioma) {
    parar.current?.()
    setFalando(true)
    const a = assistente.current
    if (a) {  // com rosto: voz da Azure (ou do celular) e boca mexendo
      void a.falar(texto, lingua, nomeAssistente, () => setFalando(false))
      parar.current = () => a.parar()
      return
    }
    parar.current = falar(texto, lingua, () => setFalando(false))
  }
  function mostrar(titulo: string, texto: string, fonte: string, lingua: IdiomaVoz = idioma) {
    setResposta({ titulo, texto, fonte })
    dizer(`${titulo}. ${texto}`, lingua)
  }
  function responderComGuia(g: Guia) {
    mostrar(g.titulo, `${g.resumo} ${g.passos.map((p, i) => `${i + 1}. ${p}`).join(' ')}`, `Guia de emergência guardado no aparelho · ${g.fonte.nome}`, 'pt')
  }

  async function perguntar(texto: string) {
    const q = texto.trim()
    if (q.length < 3) return
    setPergunta(q); setMsg(''); setOcupado(true); setResposta(null)
    const guia = guiaParaPergunta(q)
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline')
      const r = await ask(q, 'comunidade')
      const corpo = limparParaFala(r.resposta ?? r.trechos.slice(0, 2).map(t => t.texto).join(' '))
      if (!corpo) throw new Error('vazio')
      mostrar('Resposta', corpo, r.modo === 'ia' ? 'IA do Omni com documentos oficiais da Defesa Civil' : 'Trechos dos documentos oficiais')
    } catch {
      if (guia) responderComGuia(guia)
      else { setMsg('Sem conexão com a IA agora. Escolha um dos botões abaixo: eles funcionam sem internet.'); dizer('Sem conexão agora. Escolha um dos botões grandes da tela.') }
    } finally { setOcupado(false) }
  }

  function ouvirPergunta() {
    if (ouvindo) { rec.current?.stop(); return }
    const r = criarReconhecedor()
    if (!r) return
    parar.current?.()
    r.lang = bcp; r.interimResults = false; r.maxAlternatives = 1
    r.onresult = e => { const t = e.results[0]?.[0]?.transcript ?? ''; if (t) void perguntar(t) }
    r.onerror = () => setMsg('Não consegui ouvir. Toque de novo e fale perto do celular.')
    r.onend = () => setOuvindo(false)
    rec.current = r
    setOuvindo(true)
    r.start()
  }

  async function ouvirMeusLugares() {
    const lugares = lerLugares()
    if (!lugares.length) { mostrar('Meus lugares', 'Você ainda não adicionou lugares. Peça ajuda a alguém para adicionar a sua cidade na tela de Alertas oficiais.', 'Omni'); return }
    setOcupado(true)
    try {
      const r = await buscarOficiais(lugares)
      const texto = r.lugares.map(c => fraseDoLugar(c, idioma)).join(' ')
      mostrar(idioma === 'pt' ? 'Alertas dos seus lugares' : idioma === 'es' ? 'Alertas de sus lugares' : 'Alerts for your places', texto, r.guardado ? 'Última cópia guardada no aparelho' : 'Avisos oficiais e previsão do tempo')
    } catch { mostrar('Meus lugares', 'Não consegui buscar os alertas agora. Tente de novo em instantes.', 'Omni') } finally { setOcupado(false) }
  }

  function trocarIdioma(v: IdiomaVoz) { setIdioma(v); gravarIdiomaVoz(v) }

  return <div className="ac-app">
    <header className="ac-topo">
      <Link to="/cidadao" className="ac-voltar"><ArrowLeft aria-hidden="true" />Voltar</Link>
      <BrandSymbol className="h-10 w-9" decorative />
      <div><p className="ac-marca">Omni · Modo acessível</p><p className="ac-sub">Fale a sua pergunta. O Omni responde em voz alta.</p></div>
      <label className="ac-idioma"><span className="sr-only">Idioma</span>
        <select value={idioma} onChange={e => trocarIdioma(e.target.value as IdiomaVoz)}>{IDIOMAS_VOZ.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}</select></label>
    </header>

    <main className="ac-main" id="main-content">
      <div className="ac-assistente-barra">
        <button type="button" className={`ac-assistente-btn ${comAssistente ? 'is-on' : ''}`} onClick={() => void ligarAssistente()} aria-pressed={comAssistente}>
          <UserRound aria-hidden="true" />{comAssistente ? 'Desligar assistente' : 'Com assistente (rosto que fala)'}</button>
        {comAssistente && <button type="button" className="ac-assistente-troca" onClick={() => void trocarAssistente()} disabled={carregando !== null}>Trocar para {nomeAssistente === 'Clara' ? 'Rafael' : 'Clara'}</button>}
      </div>
      {comAssistente && <div className="ac-palco">
        <div ref={palco} className="ac-palco-3d" aria-label={`Assistente ${nomeAssistente}`} role="img" />
        {carregando !== null && <p className="ac-palco-carregando" role="status">Abrindo {nomeAssistente === 'Clara' ? 'a Clara' : 'o Rafael'}… {carregando > 0 ? `${carregando}%` : ''}</p>}
      </div>}
      <section className="ac-emergencia" aria-label="Ligar para emergência">
        <a href="tel:199"><strong>199</strong>Defesa Civil</a><a href="tel:193"><strong>193</strong>Bombeiros</a><a href="tel:192"><strong>192</strong>SAMU</a>
      </section>

      {temMicrofone
        ? <button type="button" className={`ac-mic ${ouvindo ? 'is-ouvindo' : ''}`} onClick={ouvirPergunta} disabled={ocupado} aria-pressed={ouvindo}>
            <Mic aria-hidden="true" /><span>{ouvindo ? 'Estou ouvindo… fale agora' : ocupado ? 'Pensando…' : 'Toque e fale a sua pergunta'}</span></button>
        : <form className="ac-escrever" onSubmit={e => { e.preventDefault(); void perguntar(pergunta) }}>
            <label htmlFor="ac-pergunta">Escreva a sua pergunta</label>
            <textarea id="ac-pergunta" name="pergunta" rows={2} value={pergunta} onChange={e => setPergunta(e.target.value)} placeholder="Ex.: o que eu faço se a água subir?" />
            <button type="submit" disabled={ocupado || pergunta.trim().length < 3}>{ocupado ? 'Pensando…' : 'Perguntar'}</button>
          </form>}
      {pergunta && temMicrofone && <p className="ac-pergunta">Você perguntou: “{pergunta}”</p>}
      {msg && <p className="ac-msg" role="status">{msg}</p>}

      {resposta && <section className="ac-resposta" aria-live="polite">
        <h1>{resposta.titulo}</h1>
        <p>{resposta.texto}</p>
        <div className="ac-resposta-acoes">
          {vozDisponivel() && <button type="button" onClick={() => falando ? (parar.current?.(), setFalando(false)) : dizer(`${resposta.titulo}. ${resposta.texto}`)}>
            {falando ? <><Square aria-hidden="true" />Parar</> : <><Volume2 aria-hidden="true" />Ouvir de novo</>}</button>}
        </div>
        <p className="ac-fonte">{resposta.fonte}</p>
      </section>}

      <button type="button" className="ac-lugares" onClick={() => void ouvirMeusLugares()} disabled={ocupado}><Volume2 aria-hidden="true" />Ouvir os alertas dos meus lugares</button>

      <section aria-label="Perguntas prontas (funcionam sem internet)">
        <h2 className="ac-titulo">Ou toque num destes (funcionam sem internet):</h2>
        <div className="ac-atalhos">{ATALHOS.map(a => { const g = guias.find(x => x.id === a.guia); return g
          ? <button key={a.guia} type="button" onClick={() => { setPergunta(a.texto); setMsg(''); responderComGuia(g) }}><span aria-hidden="true">{g.emoji}</span>{a.texto}</button> : null })}</div>
      </section>
      <p className="ac-nota">As respostas resumem orientações oficiais. Em perigo, ligue 199. Os guias são lidos em português.</p>
    </main>
  </div>
}
