// Assistente com rosto (Clara ou Rafael, os mesmos do VinaCare) para o Modo acessível.
// Este arquivo só é baixado quando a pessoa liga o assistente (o 3D pesa alguns MB).
// Voz: Azure pelo servidor do Omni (boca sincronizada). Sem a voz da nuvem: voz do próprio celular.
import { TalkingHead } from './talkinghead/talkinghead.mjs'
import { LipsyncPt_br } from './talkinghead/lipsync-pt_br.mjs'
import type { IdiomaVoz } from '../oficiais/voz'
import { IDIOMAS_VOZ } from '../oficiais/voz'

export type NomeAssistente = 'Clara' | 'Rafael'
// Mesmos ajustes do VinaCare (postura e piscar)
const AVATARES: Record<NomeAssistente, Record<string, unknown>> = {
  Clara: { url: '/avatars/avaturn.glb', body: 'F', avatarMood: 'neutral', lipsyncLang: 'pt_br',
    retarget: { Hips: { y: 0.03 }, Spine: { y: 0.02 }, Spine1: { y: 0.02, z: 0.01 }, Spine2: { y: 0.02, z: 0.01 }, Neck: { z: 0.02, y: 0.01 }, Head: { z: 0.02 }, LeftShoulder: { rx: -0.5 }, RightShoulder: { rx: -0.5 }, scaleToHipsLevel: 1.0 },
    baseline: { headRotateX: -0.05, eyeBlinkLeft: 0.15, eyeBlinkRight: 0.15 } },
  Rafael: { url: '/avatars/avatarsdk.glb', body: 'M', avatarMood: 'neutral', lipsyncLang: 'pt_br',
    retarget: { Neck: { z: -0.01, rx: -0.15 }, Neck1: { z: -0.01, rx: -0.15 }, Neck2: { z: -0.01, rx: -0.15 }, LeftShoulder: { rz: -0.3 }, RightShoulder: { rz: 0.3 }, scaleToEyesLevel: 1.0, origin: { y: -0.1 } },
    baseline: { headRotateX: -0.04, eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05 } },
}

/** Tempo aproximado de cada palavra (a boca acompanha o áudio). */
export function tempos(texto: string) {
  const words = texto.trim().split(/\s+/).filter(Boolean)
  const wtimes: number[] = [], wdurations: number[] = []
  let t = 120
  for (const w of words) {
    const d = Math.max(170, (w.replace(/[^\p{L}\p{N}]/gu, '').length || 1) * 72)
    wtimes.push(t); wdurations.push(d)
    t += d + (/[.,!?;:]$/.test(w) ? 260 : 50)
  }
  return { words, wtimes, wdurations, total: t + 200 }
}

function api() { return (import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '') }
const ehIOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export class Assistente {
  private head: TalkingHead
  private player = new Audio()
  private nuvem = true
  private fim: (() => void) | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  private constructor(head: TalkingHead) {
    this.head = head
    this.player.setAttribute('playsinline', '')
    this.player.preload = 'auto'
  }

  /** Cria o rosto dentro do elemento e carrega o avatar (mostra o progresso). */
  static async criar(el: HTMLElement, nome: NomeAssistente, progresso?: (pct: number) => void) {
    const head = new TalkingHead(el, { lipsyncModules: [], lipsyncLang: 'pt_br', cameraView: 'upper', avatarMood: 'neutral', modelFPS: 30, mixerGainSpeech: 3 })
    head.lipsync['pt_br'] = new LipsyncPt_br()
    const a = new Assistente(head)
    await a.trocar(nome, progresso)
    try { const r = await fetch(`${api()}/api/v1/voz/status`, { cache: 'no-store' }); a.nuvem = r.ok && (await r.json()).nuvem === true } catch { a.nuvem = false }
    return a
  }

  async trocar(nome: NomeAssistente, progresso?: (pct: number) => void) {
    await this.head.showAvatar(AVATARES[nome], ev => { if (ev.lengthComputable) progresso?.(Math.round(ev.loaded / ev.total * 100)) })
    this.head.setView('upper')
  }

  /** Precisa ser chamado dentro de um toque (iPhone): libera o som e volta o áudio para o alto-falante principal. */
  liberarSom() {
    try { (navigator as unknown as { audioSession?: { type: string } }).audioSession!.type = 'playback' } catch { /* Safari antigo */ }
    try { void this.head.audioCtx.resume() } catch { /* ignore */ }
    this.player.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
    void this.player.play().catch(() => {})
  }

  private bocaMuda(texto: string, ms: number) {
    const tm = tempos(texto), k = ms / tm.total, ctx = this.head.audioCtx
    const mudo = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * ms / 1000)), ctx.sampleRate)
    this.head.speakAudio({ audio: mudo, words: tm.words, wtimes: tm.wtimes.map(t => t * k), wdurations: tm.wdurations.map(t => t * k) }, { lipsyncLang: 'pt_br' })
  }

  private terminar(ms: number) {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => { const f = this.fim; this.fim = null; f?.() }, ms + 300)
  }

  private async pelaNuvem(texto: string, idioma: IdiomaVoz, nome: NomeAssistente) {
    const r = await fetch(`${api()}/api/v1/voz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: texto.slice(0, 900), idioma, assistente: nome }) })
    if (!r.ok) throw new Error(`voz ${r.status}`)
    const blob = await r.blob()
    const url = URL.createObjectURL(blob)
    // Toca por um <audio> (no iPhone sai no volume cheio) e a boca acompanha em silêncio.
    await new Promise<void>((ok, erro) => {
      let comecou = false
      this.player.onplaying = () => {
        if (comecou) return
        comecou = true
        const ms = (Number.isFinite(this.player.duration) && this.player.duration > 0 ? this.player.duration : tempos(texto).total / 1000) * 1000
        this.bocaMuda(texto, ms); this.terminar(ms)
        setTimeout(() => URL.revokeObjectURL(url), ms + 2000)
        ok()
      }
      this.player.onerror = () => { URL.revokeObjectURL(url); erro(new Error('player')) }
      this.player.volume = 1; this.player.muted = false
      this.player.src = url
      this.player.play().catch(erro)
    })
  }

  private peloAparelho(texto: string, idioma: IdiomaVoz) {
    const tm = tempos(texto)
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(texto)
      const bcp = IDIOMAS_VOZ.find(i => i.id === idioma)!.bcp
      u.lang = bcp; u.rate = 0.92
      u.voice = speechSynthesis.getVoices().find(v => v.lang === bcp) ?? speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(idioma)) ?? null
      let comecou = false
      const boca = () => { if (!comecou) { comecou = true; this.bocaMuda(texto, tm.total) } }
      u.onstart = boca
      u.onend = () => { const f = this.fim; this.fim = null; f?.() }
      setTimeout(boca, 700)
      speechSynthesis.cancel(); speechSynthesis.speak(u)
    } else { this.bocaMuda(texto, tm.total); this.terminar(tm.total) }
  }

  /** Fala o texto com o rosto. Chama aoTerminar quando acaba. */
  async falar(texto: string, idioma: IdiomaVoz, nome: NomeAssistente, aoTerminar?: () => void) {
    this.parar()
    this.fim = aoTerminar ?? null
    if (this.nuvem && navigator.onLine !== false) {
      try { await this.pelaNuvem(texto, idioma, nome); return } catch { /* cai para a voz do celular */ }
    }
    this.peloAparelho(texto, idioma)
  }

  parar() {
    if (this.timer) clearTimeout(this.timer)
    try { this.player.pause() } catch { /* ignore */ }
    try { if ('speechSynthesis' in window) speechSynthesis.cancel() } catch { /* ignore */ }
    try { this.head.stopSpeaking() } catch { /* ignore */ }
    const f = this.fim; this.fim = null; f?.()
  }

  humor(h: 'neutral' | 'happy' | 'sad' | 'love') { try { this.head.setMood(h) } catch { /* ignore */ } }

  destruir() { this.parar(); try { this.head.stop(); this.head.dispose() } catch { /* ignore */ } }
}
export const usaIOS = ehIOS
