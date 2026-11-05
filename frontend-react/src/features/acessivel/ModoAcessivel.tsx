// Modo acessível: para idosos, quem enxerga pouco ou lê com dificuldade. Tudo grande, por voz:
// a pessoa toca e fala a pergunta; o Omni responde em texto grande e lê em voz alta.
// Sem internet: responde com os guias de emergência guardados no aparelho (a voz do celular funciona offline).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mic, Square, UserRound, Volume2 } from 'lucide-react'
import type { Assistente, NomeAssistente } from './avatar'
import { FOTO_ASSISTENTE } from './CartaoAssistente'
import { BrandSymbol } from '@/components/shared/Brand'
import { guias } from '../preparar/conteudo'
import type { Guia } from '../preparar/conteudo'
import { ask } from '../intelligence/intelligence'
import { buscarOficiais } from '../oficiais/oficiais'
import { lerLugares } from '../lugares/meusLugares'
import type { IdiomaVoz } from '../oficiais/voz'
import { falar, fraseDoLugar, gravarIdiomaVoz, idiomaDoSite, IDIOMAS_VOZ, lerIdiomaVoz, modoSom, vozDisponivel } from '../oficiais/voz'
import { useLanguage } from '@/i18n'
import './acessivel.css'

/** Perguntas prontas: cada uma tem um guia (em português) que funciona sem internet.
 * Em espanhol ou inglês, com internet, a mesma pergunta vai para a IA, que responde no idioma escolhido. */
export const ATALHOS: { texto: string; es: string; en: string; guia: string }[] = [
  { texto: 'A água está subindo', es: 'El agua está subiendo', en: 'The water is rising', guia: 'enchente' },
  { texto: 'Faltou energia', es: 'Se cortó la luz', en: 'The power is out', guia: 'apagao' },
  { texto: 'Alguém se machucou', es: 'Alguien se lastimó', en: 'Someone got hurt', guia: 'socorros' },
  { texto: 'Estou com medo', es: 'Tengo miedo', en: 'I am scared', guia: 'emocional' },
  { texto: 'Explosão ou ataque', es: 'Explosión o ataque', en: 'Explosion or attack', guia: 'guerra' },
  { texto: 'Acidente nuclear', es: 'Accidente nuclear', en: 'Nuclear accident', guia: 'nuclear' },
]
export const rotuloAtalho = (a: (typeof ATALHOS)[number], idioma: IdiomaVoz) => idioma === 'pt' ? a.texto : a[idioma]

/** Textos da tela nos três idiomas da voz. */
export const TEXTOS = {
  pt: { voltar: 'Voltar', marca: 'Omni · Modo acessível', sub: 'Fale a sua pergunta. O Omni responde em voz alta.', assistente: 'assistente de emergência',
    entende: 'Fale a sua pergunta. Entende português, espanhol e inglês.', abrindo: 'Abrindo', ola: (n: string) => `Oi! Eu sou ${n === 'Clara' ? 'a Clara' : 'o Rafael'}. Toque no botão azul e fale comigo.`,
    ouvindo: 'Estou ouvindo… fale agora', pensando: 'Pensando…', falarCom: (n: string) => `Falar com ${n === 'Clara' ? 'a Clara' : 'o Rafael'}`, toque: 'Toque e fale a sua pergunta',
    escreva: 'Escreva a sua pergunta', exemplo: 'Ex.: o que eu faço se a água subir?', perguntar: 'Perguntar', soVoz: 'Só voz (sem o rosto)', mostrar: 'Mostrar a assistente (rosto que fala)',
    perguntou: 'Você perguntou', resposta: 'Resposta', parar: 'Parar', ouvirDeNovo: 'Ouvir de novo', lugares: 'Ouvir os alertas dos meus lugares',
    atalhos: 'Ou toque num destes (funcionam sem internet):', nota: 'As respostas resumem orientações oficiais. Em perigo, ligue 199.',
    semConexao: 'Sem conexão com a IA agora. Escolha um dos botões abaixo: eles funcionam sem internet.', semConexaoFala: 'Sem conexão agora. Escolha um dos botões grandes da tela.',
    naoOuvi: 'Não consegui ouvir. Toque de novo e fale perto do celular.', fonteIa: 'IA do Omni com documentos oficiais da Defesa Civil', fonteDoc: 'Trechos dos documentos oficiais',
    fonteGuia: 'Guia de emergência guardado no aparelho', meusLugares: 'Meus lugares', semLugares: 'Você ainda não adicionou lugares. Peça ajuda a alguém para adicionar a sua cidade na tela de Alertas oficiais.',
    alertasLugares: 'Alertas dos seus lugares', semAlertas: 'Não consegui buscar os alertas agora. Tente de novo em instantes.', copia: 'Última cópia guardada no aparelho', fonteAlertas: 'Avisos oficiais e previsão do tempo',
    guiaPt: '', emergencia: ['Defesa Civil', 'Bombeiros', 'SAMU'] },
  es: { voltar: 'Volver', marca: 'Omni · Modo accesible', sub: 'Diga su pregunta. Omni responde en voz alta.', assistente: 'asistente de emergencias',
    entende: 'Diga su pregunta. Entiende español, portugués e inglés.', abrindo: 'Abriendo', ola: (n: string) => `¡Hola! Soy ${n}. Toque el botón azul y hable conmigo.`,
    ouvindo: 'Le escucho… hable ahora', pensando: 'Pensando…', falarCom: (n: string) => `Hablar con ${n}`, toque: 'Toque y diga su pregunta',
    escreva: 'Escriba su pregunta', exemplo: 'Ej.: ¿qué hago si sube el agua?', perguntar: 'Preguntar', soVoz: 'Solo voz (sin el rostro)', mostrar: 'Mostrar la asistente (rostro que habla)',
    perguntou: 'Usted preguntó', resposta: 'Respuesta', parar: 'Detener', ouvirDeNovo: 'Escuchar otra vez', lugares: 'Escuchar las alertas de mis lugares',
    atalhos: 'O toque uno de estos:', nota: 'Las respuestas resumen orientaciones oficiales. En peligro, llame al 199 (Brasil) o al número de emergencias de su país.',
    semConexao: 'Sin conexión con la IA ahora. Elija uno de los botones de abajo: funcionan sin internet (en portugués).', semConexaoFala: 'Sin conexión ahora. Elija uno de los botones grandes de la pantalla.',
    naoOuvi: 'No pude escuchar. Toque otra vez y hable cerca del celular.', fonteIa: 'IA de Omni con documentos oficiales de Defensa Civil', fonteDoc: 'Fragmentos de documentos oficiales',
    fonteGuia: 'Guía de emergencia guardada en el celular (en portugués)', meusLugares: 'Mis lugares', semLugares: 'Aún no agregó lugares. Pida ayuda para agregar su ciudad en la pantalla de Alertas oficiales.',
    alertasLugares: 'Alertas de sus lugares', semAlertas: 'No pude buscar las alertas ahora. Intente de nuevo en un momento.', copia: 'Última copia guardada en el celular', fonteAlertas: 'Avisos oficiales y pronóstico del tiempo',
    guiaPt: ' Sin internet, las guías se leen en portugués.', emergencia: ['Defensa Civil', 'Bomberos', 'SAMU'] },
  en: { voltar: 'Back', marca: 'Omni · Accessible mode', sub: 'Say your question. Omni answers out loud.', assistente: 'emergency assistant',
    entende: 'Say your question. Understands English, Portuguese and Spanish.', abrindo: 'Opening', ola: (n: string) => `Hi! I am ${n}. Tap the blue button and talk to me.`,
    ouvindo: "I'm listening… speak now", pensando: 'Thinking…', falarCom: (n: string) => `Talk to ${n}`, toque: 'Tap and say your question',
    escreva: 'Type your question', exemplo: 'E.g.: what do I do if the water rises?', perguntar: 'Ask', soVoz: 'Voice only (no face)', mostrar: 'Show the assistant (talking face)',
    perguntou: 'You asked', resposta: 'Answer', parar: 'Stop', ouvirDeNovo: 'Listen again', lugares: 'Hear the alerts for my places',
    atalhos: 'Or tap one of these:', nota: 'Answers summarize official guidance. If you are in danger, call 199 (Brazil) or your local emergency number.',
    semConexao: 'No connection to the AI now. Choose one of the buttons below: they work offline (in Portuguese).', semConexaoFala: 'No connection now. Choose one of the big buttons on the screen.',
    naoOuvi: "I couldn't hear you. Tap again and speak close to the phone.", fonteIa: 'Omni AI with official Civil Defense documents', fonteDoc: 'Excerpts from official documents',
    fonteGuia: 'Emergency guide saved on the phone (in Portuguese)', meusLugares: 'My places', semLugares: 'You have not added places yet. Ask someone to add your city on the Official alerts screen.',
    alertasLugares: 'Alerts for your places', semAlertas: "I couldn't get the alerts now. Try again in a moment.", copia: 'Last copy saved on the phone', fonteAlertas: 'Official warnings and weather forecast',
    guiaPt: ' Offline, guides are read in Portuguese.', emergencia: ['Civil Defense', 'Fire Dept.', 'Ambulance'] },
}

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
  return texto.replace(/\*\*|__|#+\s?/g, '').replace(/\[(\d+)\]/g, '')
    .replace(/\s*\([^()]*\.pdf[^()]*\)/gi, '')   // tira as citações "(arquivo.pdf, pág. 3)": ruins de ouvir
    .replace(/\s+/g, ' ').trim()
}

type Reconhecedor = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; abort?: () => void
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
  const [resposta, setResposta] = useState<{ titulo: string; texto: string; fonte: string; lingua: IdiomaVoz } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  const parar = useRef<(() => void) | null>(null)
  // Assistente com rosto: abre sozinho (como no VinaCare). Sem internet, fica só a voz do celular.
  const [comAssistente, setComAssistente] = useState(() => {
    try { if (navigator.onLine === false || localStorage.getItem('omni-assistente-ligado') === 'nao') return false } catch { /* ignore */ }
    return true
  })
  const [nomeAssistente, setNomeAssistente] = useState<NomeAssistente>(() => { try { return localStorage.getItem('omni-assistente') === 'Rafael' ? 'Rafael' : 'Clara' } catch { return 'Clara' } })
  const [carregando, setCarregando] = useState<number | null>(null)
  const assistente = useRef<Assistente | null>(null)
  const palco = useRef<HTMLDivElement>(null)
  useEffect(() => () => { assistente.current?.destruir(); assistente.current = null }, [])
  useEffect(() => {
    if (!comAssistente || assistente.current) return
    let cancelado = false
    setCarregando(0)
    void (async () => {
      try {
        const { Assistente } = await import('./avatar')
        if (cancelado || !palco.current) return
        const a = await Assistente.criar(palco.current, nomeAssistente, setCarregando)
        if (cancelado) { a.destruir(); return }
        assistente.current = a
        setCarregando(null)
      } catch (erro) {
        const detalhe = erro instanceof Error ? erro.message : String(erro)
        console.error('assistente', erro)
        if (!cancelado) { setComAssistente(false); setCarregando(null); setMsg(`Não consegui abrir o assistente neste aparelho. A voz do celular continua funcionando. (detalhe: ${detalhe.slice(0, 120)})`) }
      }
    })()
    return () => { cancelado = true }
  }, [comAssistente]) // eslint-disable-line

  /** No iPhone o som só é liberado dentro de um toque: chamar no começo de cada botão. */
  function liberar() { assistente.current?.liberarSom() }
  function alternarAssistente() {
    const ligar = !comAssistente
    try { localStorage.setItem('omni-assistente-ligado', ligar ? 'sim' : 'nao') } catch { /* ignore */ }
    if (!ligar) { assistente.current?.destruir(); assistente.current = null }
    setComAssistente(ligar)
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
  const T = TEXTOS[idioma]
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
    setResposta({ titulo, texto, fonte, lingua })
    dizer(`${titulo}. ${texto}`, lingua)
  }
  function responderComGuia(g: Guia) {
    mostrar(g.titulo, `${g.resumo} ${g.passos.map((p, i) => `${i + 1}. ${p}`).join(' ')}`, `${T.fonteGuia} · ${g.fonte.nome}`, 'pt')
  }

  async function perguntar(texto: string) {
    const q = texto.trim()
    if (q.length < 3) return
    setPergunta(q); setMsg(''); setOcupado(true); setResposta(null)
    const guia = guiaParaPergunta(q)
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline')
      const r = await ask(q, 'comunidade', { idioma })
      const corpo = limparParaFala(r.resposta ?? r.trechos.slice(0, 2).map(t => t.texto).join(' '))
      if (!corpo) throw new Error('vazio')
      mostrar(T.resposta, corpo, r.modo === 'ia' ? T.fonteIa : T.fonteDoc)
    } catch {
      if (guia) responderComGuia(guia)
      else { setMsg(T.semConexao); dizer(T.semConexaoFala) }
    } finally { setOcupado(false) }
  }

  function ouvirPergunta() {
    liberar()
    if (ouvindo) { rec.current?.stop(); return }
    const r = criarReconhecedor()
    if (!r) return
    parar.current?.()
    r.lang = bcp; r.interimResults = false; r.maxAlternatives = 1
    // Igual ao VinaCare: ao terminar de ouvir, solta o microfone e volta o som para o alto-falante principal
    r.onresult = e => {
      const t = e.results[0]?.[0]?.transcript ?? ''
      try { r.abort?.() } catch { /* ignore */ }
      modoSom('playback')
      if (t) void perguntar(t)
    }
    r.onerror = () => { modoSom('playback'); setMsg(T.naoOuvi) }
    r.onend = () => { modoSom('playback'); setOuvindo(false) }
    rec.current = r
    setOuvindo(true)
    modoSom('play-and-record')
    try { r.start() } catch { modoSom('playback'); setOuvindo(false) }
  }

  async function ouvirMeusLugares() {
    liberar()
    const lugares = lerLugares()
    if (!lugares.length) { mostrar(T.meusLugares, T.semLugares, 'Omni'); return }
    setOcupado(true)
    try {
      const r = await buscarOficiais(lugares)
      const texto = r.lugares.map(c => fraseDoLugar(c, idioma)).join(' ')
      mostrar(T.alertasLugares, texto, r.guardado ? T.copia : T.fonteAlertas)
    } catch { mostrar(T.meusLugares, T.semAlertas, 'Omni') } finally { setOcupado(false) }
  }

  function trocarIdioma(v: IdiomaVoz) { setIdioma(v); gravarIdiomaVoz(v); setResposta(null); setMsg('') }
  /** Atalho: em português (ou sem internet) lê o guia guardado; em espanhol/inglês com internet, a IA responde no idioma. */
  function usarAtalho(a: (typeof ATALHOS)[number], g: Guia) {
    liberar(); setMsg('')
    const online = typeof navigator === 'undefined' || navigator.onLine !== false
    if (idioma !== 'pt' && online) { void perguntar(rotuloAtalho(a, idioma)); return }
    setPergunta(rotuloAtalho(a, idioma)); responderComGuia(g)
  }

  return <div className="ac-app">
    <header className="ac-topo">
      <Link to="/cidadao" className="ac-voltar"><ArrowLeft aria-hidden="true" />{T.voltar}</Link>
      <BrandSymbol className="h-10 w-9" decorative />
      <div><p className="ac-marca">{T.marca}</p><p className="ac-sub">{T.sub}</p></div>
      <label className="ac-idioma"><span className="sr-only">Idioma</span>
        <select value={idioma} onChange={e => trocarIdioma(e.target.value as IdiomaVoz)}>{IDIOMAS_VOZ.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}</select></label>
    </header>

    <main className="ac-main" id="main-content">
      {comAssistente && <section className="ac-cartao" aria-label={`Assistente ${nomeAssistente}`}>
        <header className="ac-cartao-topo">
          <div><h1>{nomeAssistente} · {T.assistente}</h1><p>{T.entende}</p></div>
          <i className={`ac-ponto ${carregando === null ? 'is-pronto' : ''}`} aria-hidden="true" />
        </header>
        <div className="ac-palco">
          {carregando !== null && nomeAssistente === 'Clara' && <img className="ac-poster" src={FOTO_ASSISTENTE} alt="" aria-hidden="true" />}
          <div ref={palco} className="ac-palco-3d" role="img" aria-label={`Rosto da assistente ${nomeAssistente}`} />
          {carregando !== null && <p className="ac-palco-carregando" role="status">{T.abrindo} {nomeAssistente}… {carregando > 0 ? `${carregando}%` : ''}</p>}
          {carregando === null && !resposta && !falando && <p className="ac-balao">{T.ola(nomeAssistente)}</p>}
          <button type="button" className="ac-troca" onClick={() => void trocarAssistente()} disabled={carregando !== null}>{nomeAssistente === 'Clara' ? 'Rafael' : 'Clara'}</button>
        </div>
      </section>}
      {temMicrofone
        ? <button type="button" className={`ac-mic ${ouvindo ? 'is-ouvindo' : ''}`} onClick={ouvirPergunta} disabled={ocupado} aria-pressed={ouvindo}>
            <Mic aria-hidden="true" /><span>{ouvindo ? T.ouvindo : ocupado ? T.pensando : comAssistente ? T.falarCom(nomeAssistente) : T.toque}</span></button>
        : <form className="ac-escrever" onSubmit={e => { e.preventDefault(); liberar(); void perguntar(pergunta) }}>
            <label htmlFor="ac-pergunta">{T.escreva}</label>
            <textarea id="ac-pergunta" name="pergunta" rows={2} value={pergunta} onChange={e => setPergunta(e.target.value)} placeholder={T.exemplo} />
            <button type="submit" disabled={ocupado || pergunta.trim().length < 3}>{ocupado ? T.pensando : T.perguntar}</button>
          </form>}
      <button type="button" className="ac-so-voz" onClick={alternarAssistente}><UserRound aria-hidden="true" />{comAssistente ? T.soVoz : T.mostrar}</button>
      {pergunta && temMicrofone && <p className="ac-pergunta">{T.perguntou}: “{pergunta}”</p>}
      {msg && <p className="ac-msg" role="status">{msg}</p>}

      {resposta && <section className="ac-resposta" aria-live="polite">
        <h1>{resposta.titulo}</h1>
        <p>{resposta.texto}</p>
        <div className="ac-resposta-acoes">
          {vozDisponivel() && <button type="button" onClick={() => falando ? (parar.current?.(), setFalando(false)) : dizer(`${resposta.titulo}. ${resposta.texto}`, resposta.lingua)}>
            {falando ? <><Square aria-hidden="true" />{T.parar}</> : <><Volume2 aria-hidden="true" />{T.ouvirDeNovo}</>}</button>}
        </div>
        <p className="ac-fonte">{resposta.fonte}</p>
      </section>}

      <section className="ac-emergencia" aria-label="Ligar para emergência">
        <a href="tel:199"><strong>199</strong>{T.emergencia[0]}</a><a href="tel:193"><strong>193</strong>{T.emergencia[1]}</a><a href="tel:192"><strong>192</strong>{T.emergencia[2]}</a>
      </section>

      <button type="button" className="ac-lugares" onClick={() => void ouvirMeusLugares()} disabled={ocupado}><Volume2 aria-hidden="true" />{T.lugares}</button>

      <section aria-label="Perguntas prontas (funcionam sem internet)">
        <h2 className="ac-titulo">{T.atalhos}</h2>
        <div className="ac-atalhos">{ATALHOS.map(a => { const g = guias.find(x => x.id === a.guia); return g
          ? <button key={a.guia} type="button" onClick={() => usarAtalho(a, g)}><span aria-hidden="true">{g.emoji}</span>{rotuloAtalho(a, idioma)}</button> : null })}</div>
      </section>
      <p className="ac-nota">{T.nota}{T.guiaPt}</p>
    </main>
  </div>
}
