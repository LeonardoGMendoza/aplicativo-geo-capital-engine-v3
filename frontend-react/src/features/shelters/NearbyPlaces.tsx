import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { MapErrorBoundary } from '@/components/shared/MapErrorBoundary'
import { Button } from '@/components/ui/button'
import { categoryMeta, categoryOrder, filterPlaces, formatDistance, geocode, getNearbyPlaces, nearestOf, quickCities, routeLinks } from './places'
import type { Coordinates, GeocodeResult, NearbyResponse, PlaceCategory } from './places'
const NearbyPlacesMap = lazy(() => import('./NearbyPlacesMap'))

type Status = 'idle' | 'locating' | 'geocoding' | 'loading' | 'done' | 'error'
const PAGE = 30
const MAX_ACCURACY_M = 5000

export function NearbyPlaces() {
  const [query, setQuery] = useState('')
  const [origin, setOrigin] = useState<{ coordinates: Coordinates; label: string } | null>(null)
  const [alternatives, setAlternatives] = useState<GeocodeResult[]>([])
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [data, setData] = useState<NearbyResponse | null>(null)
  const [active, setActive] = useState<Set<PlaceCategory>>(() => new Set(categoryOrder))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const controller = useRef<AbortController | null>(null)
  const searchInput = useRef<HTMLInputElement | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  function next() { controller.current?.abort(); controller.current = new AbortController(); return controller.current.signal }

  async function loadNearby(coordinates: Coordinates, label: string, signal = next()) {
    setOrigin({ coordinates, label }); setAccuracy(null); setStatus('loading'); setMessage(''); setData(null); setSelectedId(null); setLimit(PAGE)
    try {
      const result = await getNearbyPlaces(coordinates, { signal })
      if (signal.aborted) return
      setData(result); setStatus('done')
    } catch (error) {
      if (signal.aborted) return
      setStatus('error'); setMessage(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'A busca demorou demais. Tente de novo em instantes.')
    }
  }

  async function search(event: FormEvent) {
    event.preventDefault()
    const signal = next()
    setStatus('geocoding'); setMessage(''); setAlternatives([])
    try {
      const results = await geocode(query, { signal })
      if (signal.aborted) return
      if (!results.length) { setStatus('error'); setMessage('Local não encontrado. Tente outro nome (cidade, bairro ou endereço, em qualquer país).'); return }
      setAlternatives(results.slice(1))
      await loadNearby(results[0].coordinates, results[0].displayName ?? results[0].name, signal)
    } catch (error) {
      if (signal.aborted) return
      setStatus('error'); setMessage(error instanceof Error ? error.message : 'Falha na busca.')
    }
  }

  function locateMe() {
    if (!('geolocation' in navigator)) { setStatus('error'); setMessage('Localização não disponível neste navegador. Digite a cidade ou o endereço.'); return }
    next(); setStatus('locating'); setMessage(''); setAlternatives([])
    navigator.geolocation.getCurrentPosition(
      pos => {
        const meters = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null
        // acima de 5 km o navegador só adivinhou pela internet: buscar ali mostraria locais de outro bairro
        if (meters !== null && meters > MAX_ACCURACY_M) {
          // não deixa na tela o resultado de uma busca anterior: parece que é a posição da pessoa
          setData(null); setOrigin(null); setSelectedId(null); setAccuracy(null)
          searchInput.current?.focus()
          setStatus('error')
          setMessage(`O navegador só conseguiu estimar sua posição com erro de ~${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km (pela internet, sem GPS). Digite seu endereço na busca acima. No Windows, ative Configurações → Privacidade → Localização para o computador achar a posição pelo Wi-Fi.`)
          return
        }
        void loadNearby({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, 'Sua localização atual (estimada pelo navegador)'); setAccuracy(meters)
      },
      err => { setStatus('error'); setMessage(err.code === err.PERMISSION_DENIED ? 'Permissão de localização negada. Digite a cidade ou o endereço.' : 'Não foi possível obter sua localização. Digite a cidade ou o endereço.') },
      { timeout: 10_000, enableHighAccuracy: true, maximumAge: 0 },
    )
  }

  // no computador, sem GPS, o navegador estima a posição pela rede e pode errar: o usuário arrasta o ponto azul
  function moveOrigin(coordinates: Coordinates) { setAlternatives([]); void loadNearby(coordinates, 'Ponto ajustado no mapa') }

  function toggle(category: PlaceCategory) {
    setActive(prev => { const s = new Set(prev); if (s.has(category)) s.delete(category); else s.add(category); return s })
    setLimit(PAGE)
  }

  function goNearest(category: PlaceCategory) {
    const best = data ? nearestOf(data.items, category) : undefined
    if (!best) return
    setActive(prev => prev.has(category) ? prev : new Set([...prev, category]))
    setSelectedId(best.id)
  }

  const items = data ? filterPlaces(data.items, active) : []
  const counts = new Map<PlaceCategory, number>((data?.categories ?? []).map(c => [c.id, c.count] as const))
  const selected = data?.items.find(p => p.id === selectedId)
  const busy = status === 'locating' || status === 'geocoding' || status === 'loading'
  const statusText = status === 'locating' ? 'Obtendo sua localização…' : status === 'geocoding' ? 'Procurando o endereço…' : status === 'loading' ? 'Buscando locais no OpenStreetMap… pode levar até 30 segundos.' : ''

  return <section className="light-panel space-y-4 p-4" aria-labelledby="nearby-places">
    <div><h2 id="nearby-places" className="text-lg font-semibold">Locais próximos — OpenStreetMap</h2>
      <p className="text-sm">Abrigos, saúde, segurança, alimento, farmácia, hospedagem e mercados em qualquer cidade do mundo. Clique em um local para abrir a rota no Waze ou no Google Maps.</p></div>

    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <form onSubmit={search} className="flex min-w-0 flex-1 gap-2" role="search">
        <label className="min-w-0 flex-1 text-sm">Cidade, bairro ou endereço<input ref={searchInput} className="mini-select mt-1 w-full" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ex.: Canoas RS, Rua Augusta 500 São Paulo…" maxLength={120} /></label>
        <Button type="submit" className="self-end" disabled={busy || query.trim().length < 2}>Buscar</Button>
      </form>
      <Button type="button" variant="outline" onClick={locateMe} disabled={busy}>📍 Usar minha localização</Button>
    </div>
    <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">Cidades do estudo de caso:</span>
      {quickCities.map(c => <button key={c.name} type="button" disabled={busy} className="place-chip" onClick={() => { setAlternatives([]); void loadNearby(c.coordinates, c.name) }}>{c.name}</button>)}</div>
    <p className="text-xs text-muted-foreground">A localização só é usada quando você clica no botão. A busca vai à API do projeto com a posição arredondada (~100 m) e não é salva.</p>

    {statusText && <p role="status" className="place-status">{statusText}</p>}
    {status === 'error' && <p role="alert" className="text-sm text-red-800">{message}</p>}
    {origin && <p className="text-sm"><strong>Buscando perto de:</strong> {origin.label}{accuracy !== null && <> · precisão informada pelo navegador: ~{accuracy.toLocaleString('pt-BR')} m</>}</p>}
    {accuracy !== null && accuracy > 100 && <p role="status" className="text-sm text-amber-900">A posição pode estar imprecisa (comum no computador sem GPS). Se o ponto azul estiver no lugar errado, arraste-o no mapa ou digite o seu endereço na busca.</p>}
    {alternatives.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs"><span>Não é este lugar?</span>{alternatives.map(a => <button key={`${a.coordinates.latitude},${a.coordinates.longitude}`} type="button" className="place-chip" disabled={busy} onClick={() => { setAlternatives([]); void loadNearby(a.coordinates, a.displayName ?? a.name) }}>{a.displayName ?? a.name}</button>)}</div>}

    {data && <>
      <div className="flex flex-wrap gap-2" aria-label="Filtrar categorias">
        {categoryOrder.map(c => <button key={c} type="button" className="place-filter" aria-pressed={active.has(c)} style={{ '--place-color': categoryMeta[c].color } as CSSProperties} onClick={() => toggle(c)}>{categoryMeta[c].emoji} {categoryMeta[c].short} <span className="tabular-nums">({counts.get(c) ?? 0})</span></button>)}
      </div>
      <p className="text-xs">{data.notice} {data.state === 'stale' && <strong>Fonte fora do ar: mostrando cópia de {new Date(data.fetchedAt).toLocaleString('pt-BR')}.</strong>} Raio da busca: {data.radiusKm} km.</p>
      {data.state === 'empty' && <p role="status" className="text-sm">Nenhum local dos tipos do mapa foi encontrado nesta área. Tente um bairro ou cidade maior. Isso não significa ausência de apoio na região.</p>}

      {data.items.length > 0 && <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.5fr)]">
        <div className="min-w-0 space-y-3">
          <div><h3 className="text-sm font-semibold">Ir para o mais próximo</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">{categoryOrder.map(c => <button key={c} type="button" className="place-nearest" style={{ '--place-color': categoryMeta[c].color } as CSSProperties} disabled={!counts.get(c)} onClick={() => goNearest(c)}>{categoryMeta[c].emoji} {categoryMeta[c].nearest}</button>)}</div></div>
          <h3 className="text-sm font-semibold">{items.length} locais nos filtros</h3>
          <ul className="place-list space-y-2">{items.slice(0, limit).map(p => <li key={p.id}><button type="button" aria-pressed={p.id === selectedId} className={`w-full rounded-xl border p-3 text-left ${p.id === selectedId ? 'border-teal-700 bg-teal-50' : 'border-slate-200 bg-white'}`} onClick={() => setSelectedId(p.id)}>
            <span className="block text-sm font-semibold">{categoryMeta[p.category].emoji} {p.name}</span>
            <span className="block text-xs">{p.shelterKind === 'possible' ? 'Possível ponto de apoio' : categoryMeta[p.category].label} · {formatDistance(p.distanceKm)}</span></button></li>)}</ul>
          {items.length > limit && <Button type="button" variant="outline" onClick={() => setLimit(l => l + PAGE)}>Mostrar mais</Button>}
        </div>

        <div className="min-w-0 space-y-4">
          <MapErrorBoundary message="Mapa indisponível. A lista e os botões de rota continuam funcionando."><Suspense fallback={<p role="status">Carregando mapa…</p>}>
            <NearbyPlacesMap origin={data.origin} items={items} selectedId={selectedId} onSelect={setSelectedId} onMoveOrigin={moveOrigin} />
          </Suspense></MapErrorBoundary>
          <div className="rounded-xl border border-slate-200 bg-white p-4" aria-live="polite">
            {!selected ? <p className="text-sm">Selecione um local na lista, no mapa ou use “Ir para o mais próximo”.</p> : <div className="space-y-2">
              <h3 className="text-base font-semibold">{categoryMeta[selected.category].emoji} {selected.name}</h3>
              <p className="text-sm">{selected.shelterKind === 'possible' ? 'Possível ponto de apoio' : selected.categoryLabel} · <strong>{formatDistance(selected.distanceKm)}</strong> em linha reta do ponto de busca</p>
              {selected.address && <p className="text-sm">📍 {selected.address}</p>}
              {selected.note && <p className="text-sm text-amber-900">{selected.note}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild><a href={routeLinks(selected.coordinates).waze} target="_blank" rel="noopener noreferrer">🚗 Rota no Waze</a></Button>
                <Button asChild><a href={routeLinks(selected.coordinates).google} target="_blank" rel="noopener noreferrer">🗺️ Rota no Google Maps</a></Button>
                <Button asChild variant="outline"><a href={selected.osmUrl} target="_blank" rel="noopener noreferrer">Ver no OpenStreetMap</a></Button>
              </div>
              <p className="text-xs">O aplicativo externo traça a rota a partir da sua localização atual. Ele não confirma que o local está aberto, nem condições de acesso ou do trajeto. Em emergência, siga a Defesa Civil (199).</p>
            </div>}
          </div>
        </div>
      </div>}
      <p className="text-xs text-muted-foreground">{data.attribution} · fonte: {data.source}</p>
    </>}
  </section>
}
