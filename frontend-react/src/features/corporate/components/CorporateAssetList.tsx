import type { Asset, ProximityResult } from '../../nasa/proximity'
import { assetStatus } from '../screening'

export function CorporateAssetList({ assets, selectedId, result, loading, failed, onSelect }: { assets: Asset[]; selectedId: string | null; result: ProximityResult | null; loading: boolean; failed: boolean; onSelect: (id: string) => void }) {
  return <div aria-label="Lista de ativos corporativos" className="max-h-[440px] space-y-2 overflow-y-auto p-1">
    {!assets.length && <p className="p-3">Nenhum ativo corresponde à busca.</p>}
    {assets.map(asset => {
      const match = result?.matches.find(m => m.asset.id === asset.id)
      return <button key={asset.id} type="button" aria-pressed={selectedId === asset.id} onClick={() => onSelect(asset.id)} className={`w-full rounded border p-3 text-left text-sm hover:border-primary ${selectedId === asset.id ? 'border-primary bg-secondary ring-1 ring-primary' : 'bg-white'}`}>
        <span className="block font-semibold">{asset.name}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{assetStatus(result, asset.id, loading, failed)}</span>
        {match && <span className="mt-1 block text-xs">{match.event.title} · {match.distanceKm.toFixed(2)} km</span>}
      </button>
    })}
  </div>
}
