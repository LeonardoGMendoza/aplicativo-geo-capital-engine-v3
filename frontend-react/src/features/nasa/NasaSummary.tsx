import { Link } from 'react-router-dom'
import { Satellite } from 'lucide-react'
import { useNasaSession } from './NasaSession'
import { nasaSummary } from './summary'
import { formatObservation } from './geography'
export function NasaSummary() {
  const { result, loading, error, refresh } = useNasaSession()
  const summary = nasaSummary(result, loading, error)
  return <section aria-label="Resumo independente NASA EONET" className="light-panel nasa-entry flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
    <div className="min-w-0"><h2 className="flex items-center gap-2 font-semibold"><Satellite className="size-4 text-primary" />Eventos reais · NASA EONET</h2>
      <p className="mt-1" role={summary.problem ? 'alert' : 'status'}>{summary.label}{summary.count !== null ? ` · ${summary.count} evento(s) globais` : ''}{result?.dataQuality === 'partial' && summary.count !== null ? ' · dados parciais' : ''}</p>
      <p className="mt-1 text-xs text-muted-foreground">Origem: NASA EONET · obtenção: {formatObservation(result?.fetchedAt ?? null)}. Catálogo independente: não alimenta os indicadores simulados abaixo.</p>
      {(summary.problem || result?.state === 'empty' || result?.state === 'stale') && <p className="mt-1 text-xs text-amber-900">Ausência de dados ou eventos não significa ausência de risco.</p>}
    </div>
    <div className="nasa-entry-actions flex flex-wrap gap-2"><button type="button" disabled={loading} className="mini-select" onClick={refresh}>Consultar resumo NASA</button><Link className="rounded bg-primary px-3 py-2 font-medium text-white" to="/mapa">Explorar eventos NASA</Link></div>
  </section>
}
