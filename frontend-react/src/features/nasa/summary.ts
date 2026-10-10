import type { EventsResponse } from './contracts'
export function nasaSummary(result: EventsResponse | null, loading: boolean, error: string | null) {
  if (loading) return { label: 'Consultando NASA…', count: null, problem: false }
  if (error) return { label: 'Falha de acesso à API · situação indisponível', count: null, problem: true }
  if (!result) return { label: 'NASA ainda não consultada nesta sessão', count: null, problem: false }
  if (result.state === 'error' || result.state === 'unavailable') return { label: result.state === 'error' ? 'Falha de integração NASA' : 'NASA indisponível', count: null, problem: true }
  return { label: result.state === 'stale' ? 'Última resposta desatualizada' : result.state === 'empty' ? 'Consulta válida sem eventos' : 'Catálogo NASA consultado', count: result.events.length, problem: false }
}
