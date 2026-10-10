import type { Asset, ProximityResult } from '../../nasa/proximity'
import { formatObservation, observationLabel } from '../../nasa/geography'
import { assetStatus } from '../../corporate/screening'
import { communityDescription, communityLimits } from '../reference'

export function CommunityContextPanel({ asset, result, loading, error }: { asset: Asset | undefined; result: ProximityResult | null; loading: boolean; error: string | null }) {
  const match = result?.matches.find(item => item.asset.id === asset?.id)
  return <section className="light-panel min-w-0 space-y-3 break-words p-4" aria-labelledby="community-context">
    <h2 id="community-context" className="text-base font-semibold">Contexto da referência selecionada</h2>
    {!asset ? <p className="text-sm">Selecione uma referência para conhecer sua descrição e o ativo associado.</p> : <>
      <h3 className="text-lg font-semibold">{communityDescription(asset)}</h3>
      <p className="text-sm">Ativo associado: <strong>{asset.name}</strong></p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Identificador do ativo</dt><dd>{asset.id}</dd></div><div><dt className="font-semibold">Coordenadas do ativo</dt><dd>{asset.coordinates.latitude.toFixed(4)}, {asset.coordinates.longitude.toFixed(4)}</dd></div><div><dt className="font-semibold">Origem</dt><dd>{asset.sourceFile || 'Não informada'}</dd></div><div><dt className="font-semibold">Verificação</dt><dd>Cadastro de referência, sem verificação operacional.</dd></div></dl>
      <p className="text-xs text-muted-foreground">As coordenadas acima pertencem ao ativo. Não há coordenadas comunitárias verificadas neste cadastro.</p>
      <div className="space-y-2 rounded border bg-secondary p-3 text-sm" aria-label="Resultado de proximidade do ativo associado">
        <h3 className="font-semibold">Proximidade do ativo associado</h3>
        <p role="status">{assetStatus(result, asset.id, loading, !!error)}</p>
        <p>{communityLimits}</p>
        {error && <p role="alert" className="text-amber-900">{error}</p>}
        {match && <div className="space-y-2 border-t pt-3"><h4 className="font-semibold">{match.event.title}</h4><p>{match.event.id} · {match.event.source}</p><p>{match.event.categories.map(c => c.title).join(', ') || 'Categoria não informada'}</p><p><strong>Distância entre o evento NASA e o ativo: {match.distanceKm.toFixed(2)} km</strong></p><p>Observação: {formatObservation(match.event.observedAt)} · {observationLabel(match.event)}</p><p>Coordenadas do evento: {match.event.coordinates?.latitude.toFixed(4)}, {match.event.coordinates?.longitude.toFixed(4)}</p>{match.geometryApproximate && <p className="text-amber-900">Geometria aproximada: primeiro vértice do polígono, sem cálculo de centroide ou distância até a borda.</p>}</div>}
        {result && <><p className="text-xs">Consulta NASA: {formatObservation(result.eventsFetchedAt)} · análise: {formatObservation(result.analyzedAt)} · pares avaliados: {result.evaluatedPairCount}</p>{result.warnings.map(w => <p key={w} className="text-amber-900">{w}</p>)}{result.skipped.length > 0 && <details><summary className="cursor-pointer py-3">{result.skipped.length} evento(s) omitido(s) por localização inadequada</summary><div className="max-h-40 overflow-y-auto">{result.skipped.map(s => <p key={s.eventId}>{s.eventId}: {s.reason}</p>)}</div></details>}</>}
      </div>
    </>}
  </section>
}
