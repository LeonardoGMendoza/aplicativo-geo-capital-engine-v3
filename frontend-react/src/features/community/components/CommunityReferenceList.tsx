import type { Asset } from '../../nasa/proximity'
import { communityDescription } from '../reference'

export function CommunityReferenceList({ assets, selectedId, onSelect }: { assets: Asset[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <div aria-label="Referências comunitárias" className="max-h-[400px] space-y-2 overflow-y-auto p-1">
    {!assets.length && <p className="p-2 text-sm">Nenhuma referência corresponde à busca.</p>}
    {assets.map(asset => <button key={asset.id} type="button" aria-pressed={asset.id === selectedId} className={`w-full rounded border p-3 text-left text-sm hover:border-primary ${asset.id === selectedId ? 'border-primary bg-secondary ring-1 ring-primary' : 'bg-white'}`} onClick={() => onSelect(asset.id)}>
      <span className="block font-semibold">{communityDescription(asset)}</span>
      <span className="mt-1 block text-xs text-muted-foreground">Ativo associado: {asset.name}</span>
      <span className="mt-1 block break-words text-xs text-muted-foreground">Referência: {asset.id}</span>
    </button>)}
  </div>
}
