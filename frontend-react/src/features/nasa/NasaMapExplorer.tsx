import { lazy, Suspense, useMemo, useState } from 'react'
import { AssetProximityPanel } from './AssetProximityPanel'
import type { Asset } from './proximity'
import { useNasaSession } from './NasaSession'
import type { NasaEvent } from './contracts'
import { categories, categoryStyle, filterEvents, formatObservation, mapPosition, observationLabel, PAGE_SIZE, pageForEvent } from './geography'

const GeographicMap = lazy(() => import('./NasaGeographicMap'))
export function NasaMapExplorer({ events }: { events: NasaEvent[] }) {
  const { category, setCategory, search, setSearch, selectedId, setSelectedId, page, setPage } = useNasaSession()
  const { result } = useNasaSession()
  const unavailable = result?.state === 'unavailable' || result?.state === 'error'
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const filtered = useMemo(() => filterEvents(events, category, search), [events, category, search])
  const visibleSelection = filtered.some(event => event.id === selectedId) ? selectedId : null
  const located = filtered.filter(event => mapPosition(event))
  const selected = filtered.find(event => event.id === visibleSelection)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageEvents = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  function selectEvent(id: string) { setSelectedId(id); setPage(pageForEvent(filtered, id)) }
  return <div className="space-y-2">
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-36 flex-col gap-1">Categoria<select aria-label="Categoria de evento NASA" className="mini-select" value={category} onChange={event => { setCategory(event.target.value); setSelectedId(null); setPage(0) }}><option value="all">Todas as categorias</option>{categories.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      <label className="flex min-w-36 flex-1 flex-col gap-1">Buscar por nome<input className="mini-select" placeholder="Nome do evento NASA…" aria-label="Buscar evento NASA por nome" value={search} onChange={event => { setSearch(event.target.value); setSelectedId(null); setPage(0) }} /></label>
    </div>
    <p role="status">{unavailable ? 'Catálogo NASA indisponível. Somente os ativos de referência podem ser visualizados; triagem bloqueada.' : `${filtered.length} evento(s) no filtro · ${located.length} localização(ões) no mapa · ${filtered.length - located.length} sem localização representável.`}</p>
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">{categories.map(item => <span key={item.id} className="flex items-center gap-1"><span style={{ background: item.color }} className="flex size-4 items-center justify-center rounded-full font-bold text-white">{item.symbol}</span>{item.label}</span>)}<span>Contorno sólido: recente · tracejado: antiga · pontilhado: horário desconhecido</span></div>
    <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
      <Suspense fallback={<p role="status" className="flex h-[300px] items-center justify-center rounded border bg-secondary">Carregando mapa…</p>}><GeographicMap events={filtered} selectedId={visibleSelection} onSelect={selectEvent} assets={assets} selectedAssetId={selectedAssetId} onAssetSelect={setSelectedAssetId} /></Suspense>
      <div className="min-w-0">
        <div aria-label="Lista de eventos NASA filtrados" className="max-h-[250px] space-y-1 overflow-y-auto rounded border bg-secondary p-1 lg:h-[340px] lg:max-h-[340px]">
          {filtered.length === 0 && <p className="p-3">{unavailable ? 'Eventos NASA indisponíveis nesta consulta. Isso não indica ausência de risco.' : 'Nenhum evento corresponde aos filtros. Isso não indica ausência de risco.'}</p>}
          {pageEvents.map((event, i) => <button key={`${event.id}-${i}`} type="button" className={`w-full rounded border bg-white p-2 text-left text-xs hover:border-primary ${visibleSelection === event.id ? 'border-primary ring-1 ring-primary' : 'border-transparent'}`} aria-pressed={visibleSelection === event.id} aria-label={`Selecionar evento NASA: ${event.title}`} onClick={() => selectEvent(event.id)}>
            <span className="font-semibold">{event.title}</span><span className="mt-1 block" style={{ color: categoryStyle(event).color }}>{event.categories.map(c => c.title).join(', ') || 'Categoria desconhecida'}</span><span className="mt-1 block text-muted-foreground">{observationLabel(event)} · {formatObservation(event.observedAt)}</span>{!mapPosition(event) && <span className="mt-1 block text-amber-900">Sem coordenadas válidas para este mapa; evento mantido na lista.</span>}
          </button>)}
        </div>
        <div className="mt-1 flex items-center justify-between gap-1 text-xs" aria-label="Paginação dos eventos NASA"><button type="button" className="mini-select" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>Página {currentPage + 1}/{pageCount}</span><button type="button" className="mini-select" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Próxima</button></div>
        {selected && <div role="status" className="mt-1 rounded border border-primary/30 p-2 text-xs"><strong>{selected.title}</strong><p>{selected.id} · origem: {selected.source}</p><p>Observação: {formatObservation(selected.observedAt)}</p><p>{selected.coordinates ? `Lat/Lon: ${selected.coordinates.latitude.toFixed(4)}, ${selected.coordinates.longitude.toFixed(4)}` : `Localização indisponível (${selected.coordinateState})`}</p>{selected.coordinates?.method === 'first_polygon_vertex' && <p>Primeiro vértice do polígono; não é centroide.</p>}{!mapPosition(selected) && <p>Não é possível centralizar este evento no mapa.</p>}</div>}
      </div>
    </div>
    <AssetProximityPanel fetchedAt={result?.fetchedAt ?? null} usable={result?.state === 'success' || result?.state === 'empty'} selectedId={selectedAssetId} onAssets={setAssets} onSelected={setSelectedAssetId} />
  </div>
}
