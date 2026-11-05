// Tipos mínimos do TalkingHead (biblioteca em JavaScript, a mesma do VinaCare).
export class TalkingHead {
  constructor(node: HTMLElement, opt?: Record<string, unknown>)
  audioCtx: AudioContext
  lipsync: Record<string, unknown>
  renderer: { domElement: HTMLCanvasElement }
  showAvatar(avatar: Record<string, unknown>, onprogress?: ((ev: ProgressEvent) => void) | null): Promise<void>
  setView(view: string, opt?: Record<string, unknown>): void
  setMood(mood: string): void
  speakAudio(r: { audio: AudioBuffer; words: string[]; wtimes: number[]; wdurations: number[] }, opt?: Record<string, unknown>): void
  stopSpeaking(): void
  start(): void
  stop(): void
  dispose(): void
}
