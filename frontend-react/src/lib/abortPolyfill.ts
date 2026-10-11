// Complemento para navegadores antigos (ex.: iPhone com iOS anterior ao 17.4), que não têm
// AbortSignal.any / AbortSignal.timeout. Sem isso, as consultas à API falham nesses aparelhos.
type SignalStatics = { any?: (signals: AbortSignal[]) => AbortSignal; timeout?: (ms: number) => AbortSignal }

export function installAbortPolyfill(target: SignalStatics = AbortSignal as unknown as SignalStatics) {
  if (typeof target.timeout !== 'function') {
    target.timeout = (ms: number) => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new DOMException('A operação demorou demais.', 'TimeoutError')), ms)
      return controller.signal
    }
  }
  if (typeof target.any !== 'function') {
    target.any = (signals: AbortSignal[]) => {
      const controller = new AbortController()
      for (const signal of signals) {
        if (signal.aborted) { controller.abort(signal.reason); break }
        signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
      }
      return controller.signal
    }
  }
}

if (typeof AbortSignal !== 'undefined') installAbortPolyfill()
