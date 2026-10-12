import type { Asset, ProximityResult } from '../../nasa/proximity'
import { formatObservation, observationLabel } from '../../nasa/geography'
import { Button } from '@/components/ui/button'
import { assetStatus } from '../screening'

export function CorporateAssetDetails({ asset, result, loading, failed, onFocus }: { asset: Asset | undefined; result: ProximityResult | null; loading: boolean; failed: boolean; onFocus: (kind: 'asset' | 'event') => void }) {
  if (!asset) return <p>Selecione um ativo na lista ou no mapa para consultar seus detalhes.</p>
  const match = result?.matches.find(m => m.asset.id === asset.id)
  return <div className="space-y-3 break-words text-sm">
    <h3 className="font-semibold">{asset.name}</h3>
    <p role="status">{assetStatus(result, asset.id, loading, failed)}</p>
    <dl className="grid gap-2 sm:grid-cols-2"><div><dt className="font-semibold">Identificador</dt><dd>{asset.id}</dd></div><div><dt className="font-semibold">Coordenadas de referência</dt><dd>{asset.coordinates.latitude.toFixed(4)}, {asset.coordinates.longitude.toFixed(4)}</dd></div><div><dt className="font-semibold">Comunidade de referência</dt><dd>{asset.communityDescription || 'Descrição não informada'}</dd></div><div><dt className="font-semibold">Origem do cadastro</dt><dd>{asset.sourceFile || 'Não informada'} · sem verificação operacional</dd></div></dl>
    <p className="text-xs text-muted-foreground">A descrição comunitária não fornece coordenadas verificadas e não representa população afetada.</p>
    {match && <div className="space-y-2 rounded border bg-secondary p-3"><h3 className="font-semibold">{match.event.title}</h3><p>{match.event.id} · {match.event.source}</p><p>{match.event.categories.map(c => c.title).join(', ') || 'Categoria não informada'} · {match.distanceKm.toFixed(2)} km</p><p>Observação: {formatObservation(match.event.observedAt)} · {observationLabel(match.event)}</p><p>Coordenadas do evento: {match.event.coordinates?.latitude.toFixed(4)}, {match.event.coordinates?.longitude.toFixed(4)}</p>{match.geometryApproximate && <p className="text-amber-900">Geometria aproximada: primeiro vértice do polígono; não representa centroide ou distância até a borda.</p>}</div>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => onFocus('asset')}>Ver ativo no mapa</Button>{match && <Button variant="outline" onClick={() => onFocus('event')}>Ver evento no mapa</Button>}</div>
  </div>
}
