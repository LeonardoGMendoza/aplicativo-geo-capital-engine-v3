import { useEffect, useRef, useState } from 'react'
import { GeographyApiError, getProximityForAssets } from '../nasa/proximity'
import type { ProximityResult } from '../nasa/proximity'
import { createScreeningGate } from './screening'

export function useCorporateScreening(ids: string[], fetchedAt: string | null, datasetVersion: string) {
  const scope = JSON.stringify([ids, fetchedAt, datasetVersion])
  const gate = useRef(createScreeningGate())
  const activeScope = useRef(scope)
  const controller = useRef<AbortController | null>(null)
  const [state, setState] = useState<{ scope: string; result: ProximityResult | null; loading: boolean; error: string | null }>({ scope, result: null, loading: false, error: null })
  // Guard even before effect cleanup, when a new context has already rendered.
  activeScope.current = scope
  useEffect(() => {
    gate.current.invalidate(); controller.current?.abort()
    setState({ scope, result: null, loading: false, error: null })
    return () => { gate.current.invalidate(); controller.current?.abort() }
  }, [scope])

  function invalidate() {
    gate.current.invalidate(); controller.current?.abort()
    setState({ scope, result: null, loading: false, error: null })
  }
  async function consult() {
    if (!fetchedAt || !ids.length) return
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    const ticket = gate.current.begin()
    setState({ scope, result: null, loading: true, error: null })
    const current = () => !abort.signal.aborted && gate.current.accepts(ticket) && activeScope.current === scope
    try {
      const result = await getProximityForAssets(ids, fetchedAt, { signal: abort.signal })
      if (result.datasetVersion !== datasetVersion) throw new Error('O catálogo de ativos mudou. Atualize a página antes de consultar novamente.')
      if (current()) setState({ scope, result, loading: false, error: null })
    } catch (error) {
      if (current()) setState({ scope, result: null, loading: false, error: error instanceof GeographyApiError && error.status === 422 ? error.message : 'Triagem indisponível. Verifique a API e tente novamente. Falha de consulta não indica ausência de proximidade.' })
    }
  }
  const visible = state.scope === scope ? state : { result: null, loading: false, error: null }
  return { ...visible, consult, invalidate }
}
