import { MapErrorBoundary } from '@/components/shared/MapErrorBoundary'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AssetProximityPanel } from './AssetProximityPanel'
import { AlertActions } from '@/features/alerts/AlertActions'
import type { Asset } from './proximity'
import { useNasaSession } from './NasaSession'
import type { NasaEvent } from './contracts'
import { categories, filterEvents, formatObservation, mapPosition, PAGE_SIZE, pageForEvent } from './geography'
import { capitalMaisPerto, categoriaPt, COR_EVENTO, corDoEvento, ondeFica, tituloPt, vistoHa } from './leitura'
import { buscarPlacas, buscarSismos } from './placas'
import type { PlacasDados, Periodo } from './placas'
import { PlacasResumo } from './PlacasResumo'

const GeographicMap = lazy(() => import('./NasaGeographicMap'))
export function NasaMapExplorer({ events }: { events: NasaEvent[] }) {
  const { category, setCategory, search, setSearch, selectedId, setSelectedId, page, setPage } = useNasaSession()
  const { result } = useNasaSession()
  const unavailable = result?.state === 'unavailable' || result?.state === 'error'
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [placas, setPlacas] = useState<PlacasDados | null>(null)
  const [verPlacas, setVerPlacas] = useState(true)
  const [focoPacifico, setFocoPacifico] = useState(0)
  const [periodo, setPeriodo] = useState<Periodo>('dia') // abre no "agora" (últimas 24 h)
  const [carregandoSismos, setCarregandoSismos] = useState(false)
  useEffect(() => {
    const abort = new AbortController()
    buscarPlacas({ signal: abort.signal }, 'dia').then(d => { if (!abort.signal.aborted) setPlacas(d) }).catch(() => { if (!abort.signal.aborted) setPlacas({ bordas: [], sismos: [], erroPlacas: true, erroSismos: true, fonteSismos: 'USGS', periodo: 'dia' }) })
    return () => abort.abort()
  }, [])
  useEffect(() => { // trocou o período: busca só os terremotos; as placas continuam
    if (!placas || placas.periodo === periodo) return
    const abort = new AbortController()
    setCarregandoSismos(true)
    buscarSismos(periodo, { signal: abort.signal }).then(r => { if (!abort.signal.aborted) { setPlacas(p => p && { ...p, ...r, periodo }); setCarregandoSismos(false) } })
    return () => abort.abort()
  }, [periodo, placas?.periodo])
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
      <label className="flex min-w-36 flex-col gap-1">Categoria<select aria-label="Categoria de evento NASA" className="mini-select" value={category} onChange={event => { setCategory(event.target.value); setSelectedId(null); setPage(0) }}><option value="all">Todos os eventos</option>{categories.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      <label className="flex min-w-36 flex-1 flex-col gap-1">Buscar por nome<input className="mini-select" placeholder="Nome do evento NASA…" aria-label="Buscar evento NASA por nome" value={search} onChange={event => { setSearch(event.target.value); setSelectedId(null); setPage(0) }} /></label>
    </div>
    <p role="status" className="text-sm">{unavailable ? 'Catálogo NASA indisponível agora. Isso não indica ausência de risco.' : <><b>{located.length}</b> evento(s) vistos por satélite no mapa{filtered.length - located.length > 0 ? ` · ${filtered.length - located.length} sem local (só na lista)` : ''}</>}</p>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"><span className="flex items-center gap-1.5"><i className="nasa-bola" style={{ background: COR_EVENTO.recente }} />Visto nos últimos dias</span><span className="flex items-center gap-1.5"><i className="nasa-bola" style={{ background: COR_EVENTO.antigo }} />Visto há mais tempo</span><span className="flex items-center gap-1.5"><i className="nasa-bola" style={{ background: '#0dac8c' }} />Número = grupo de eventos</span></div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" aria-label="Placas tectônicas e terremotos">
      <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" checked={verPlacas} onChange={e => setVerPlacas(e.target.checked)} />Placas tectônicas e terremotos</label>
      <button type="button" className="mini-select" onClick={() => { setVerPlacas(true); setFocoPacifico(n => n + 1) }}>Ver costa do Pacífico das Américas</button>
      {verPlacas && <><span className="flex items-center gap-1.5"><i className="placa-traco" />Borda entre placas</span><span className="flex items-center gap-1.5"><i className="nasa-bola" style={{ background: '#f08c1a' }} />Terremoto (maior = mais forte)</span><span className="flex items-center gap-1.5"><i className="nasa-bola" style={{ background: '#fff', boxShadow: '0 0 0 2px #2f7bff' }} />Sinal de tsunami</span></>}
      {verPlacas && placas === null && <span role="status">Carregando placas e terremotos…</span>}
      {verPlacas && placas?.erroPlacas && <span role="status">Placas indisponíveis agora.</span>}
    </div>
    <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(240px,340px)]">
      <MapErrorBoundary message="Mapa indisponível. Consulte a lista, as coordenadas e os detalhes textuais; a falha do mapa não confirma nem descarta risco."><Suspense fallback={<p role="status" className="flex h-[300px] items-center justify-center rounded border bg-secondary">Carregando mapa…</p>}><GeographicMap events={filtered} selectedId={visibleSelection} onSelect={selectEvent} assets={assets} selectedAssetId={selectedAssetId} onAssetSelect={setSelectedAssetId} placas={verPlacas ? placas : null} focoPacifico={focoPacifico} /></Suspense></MapErrorBoundary>
      <div className="min-w-0">
        <div aria-label="Lista de eventos NASA filtrados" className="max-h-[250px] space-y-1 overflow-y-auto rounded border bg-secondary p-1 lg:h-[420px] lg:max-h-[420px]">
          {filtered.length === 0 && <p className="p-3">{unavailable ? 'Eventos NASA indisponíveis nesta consulta. Isso não indica ausência de risco.' : 'Nenhum evento corresponde aos filtros. Isso não indica ausência de risco.'}</p>}
          {pageEvents.map((event, i) => <button key={`${event.id}-${i}`} type="button" className={`w-full rounded border bg-white p-2 text-left text-xs hover:border-primary ${visibleSelection === event.id ? 'border-primary ring-1 ring-primary' : 'border-transparent'}`} aria-pressed={visibleSelection === event.id} aria-label={`Selecionar evento NASA: ${event.title}`} onClick={() => selectEvent(event.id)}>
            <span className="flex items-start gap-2"><i className="nasa-bola mt-1 shrink-0" style={{ background: corDoEvento(event) }} /><span className="min-w-0"><span className="block font-semibold">{tituloPt(event.title)}</span><span className="mt-0.5 block text-muted-foreground">{categoriaPt(event)} · {vistoHa(event)}</span><span className="mt-0.5 block text-muted-foreground">{mapPosition(event) ? ondeFica(event) : 'Sem local no mapa'}</span></span></span>
          </button>)}
        </div>
        <div className="mt-1 flex items-center justify-between gap-1 text-xs" aria-label="Paginação dos eventos NASA"><button type="button" className="mini-select" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>Página {currentPage + 1}/{pageCount}</span><button type="button" className="mini-select" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Próxima</button></div>
        {selected && <div role="status" className="mt-1 rounded border border-primary/30 p-2 text-xs"><strong>{tituloPt(selected.title)}</strong><p style={{ color: corDoEvento(selected) }}>● {categoriaPt(selected)} · {vistoHa(selected)}</p><p>{ondeFica(selected)}</p><details className="text-muted-foreground"><summary className="cursor-pointer">Dados técnicos</summary><p>Nome NASA: {selected.title} · {selected.id}</p><p>Observação: {formatObservation(selected.observedAt)}</p><p>{selected.coordinates ? `Lat/Lon: ${selected.coordinates.latitude.toFixed(4)}, ${selected.coordinates.longitude.toFixed(4)}` : `Localização indisponível (${selected.coordinateState})`}{selected.coordinates?.method === 'first_polygon_vertex' ? ' · primeiro vértice do polígono' : ''}</p></details></div>}
      </div>
    </div>
    {verPlacas && placas && <PlacasResumo dados={placas} periodo={periodo} onPeriodo={setPeriodo} carregando={carregandoSismos} />}
    {selected && <section className="light-panel space-y-2 p-3" aria-label="Avisar a comunidade sobre o evento selecionado">
      <h3 className="text-sm font-semibold">Avisar a comunidade sobre este evento</h3>
      <AlertActions key={selected.id} perfil="comunidade" ativo="" comunidade={(() => { const p = capitalMaisPerto(selected); return p && p.km <= 400 ? `Moradores de ${p.nome} e região` : '' })()} evento={tituloPt(selected.title)} categoria={categoriaPt(selected)} km={null} observadoEm={selected.observedAt} />
    </section>}
    <AssetProximityPanel fetchedAt={result?.fetchedAt ?? null} usable={result?.state === 'success' || result?.state === 'empty'} selectedId={selectedAssetId} onAssets={setAssets} onSelected={setSelectedAssetId} />
  </div>
}
