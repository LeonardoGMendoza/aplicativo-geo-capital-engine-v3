import { lazy, Suspense, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BrandSymbol } from '@/components/shared/Brand'
import { MapErrorBoundary } from '@/components/shared/MapErrorBoundary'
import { categoryMeta, formatDistance, nearestOf, routeLinks } from '../shelters/places'
import type { PlaceCategory } from '../shelters/places'
import { useNearbySearch } from './useNearbySearch'
import './citizen.css'
const NearbyPlacesMap = lazy(() => import('../shelters/NearbyPlacesMap'))

// Ordem pensada para emergência: abrigo e saúde primeiro.
export const citizenCategories: PlaceCategory[] = ['shelter', 'hospital', 'clinic', 'pharmacy', 'police', 'food']
export const emergencyNumbers = [
  { number: '199', label: 'Defesa Civil' },
  { number: '193', label: 'Bombeiros' },
  { number: '192', label: 'SAMU' },
] as const

export function CitizenPage() {
  const search = useNearbySearch()
  const [address, setAddress] = useState('')
  const [category, setCategory] = useState<PlaceCategory | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const { data, status, busy } = search
  const nearest = data && category ? nearestOf(data.items, category) : undefined
  const picked = data && pickedId ? data.items.find(p => p.id === pickedId && p.category === category) : undefined
  const selected = picked ?? nearest
  const sameCategory = data && category ? data.items.filter(p => p.category === category).slice(0, 10) : []

  function submit(event: FormEvent) { event.preventDefault(); setCategory(null); void search.searchAddress(address) }
  function locate() { setCategory(null); search.locate() }
  function choose(next: PlaceCategory) {
    setCategory(next); setPickedId(null)
    requestAnimationFrame(() => document.getElementById('citizen-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const statusText = status === 'locating' ? 'Procurando sua localização…' : status === 'geocoding' ? 'Procurando o endereço…' : status === 'loading' ? 'Buscando locais perto de você… pode levar até 30 segundos.' : ''

  return <div className="citizen-app">
    <header className="citizen-header">
      <BrandSymbol className="h-11 w-10" decorative />
      <div><p className="citizen-brand">Omni-<span>EcoRescue</span></p><p className="citizen-tagline">Ajuda perto de você</p></div>
    </header>

    <main className="citizen-main" id="main-content">
      <section aria-labelledby="citizen-emergency" className="citizen-card citizen-emergency">
        <h1 id="citizen-emergency" className="citizen-title">Em perigo agora? Ligue:</h1>
        <div className="citizen-calls">
          {emergencyNumbers.map(e => <a key={e.number} href={`tel:${e.number}`} className="citizen-call"><strong>{e.number}</strong><span>{e.label}</span></a>)}
        </div>
      </section>

      <section aria-labelledby="citizen-where" className="citizen-card">
        <h2 id="citizen-where" className="citizen-title">Onde você está?</h2>
        <button type="button" className="citizen-primary" onClick={locate} disabled={busy}>📍 Usar minha localização</button>
        <form onSubmit={submit} className="citizen-form" role="search">
          <label htmlFor="citizen-address">ou digite seu endereço</label>
          <div className="citizen-form-row">
            <input id="citizen-address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, número e cidade" autoComplete="street-address" maxLength={120} />
            <button type="submit" disabled={busy || address.trim().length < 2}>Buscar</button>
          </div>
        </form>
        {statusText && <p role="status" className="citizen-status">{statusText}</p>}
        {status === 'error' && <p role="alert" className="citizen-error">{search.message}</p>}
        {search.origin && status !== 'error' && <p className="citizen-origin">Perto de: <strong>{search.origin.label}</strong>{search.accuracy !== null && <> (precisão ~{search.accuracy.toLocaleString('pt-BR')} m)</>}</p>}
        {search.accuracy !== null && search.accuracy > 100 && <p className="citizen-warning">A posição pode estar imprecisa. Se estiver errada, digite seu endereço.</p>}
      </section>

      {data && <section aria-labelledby="citizen-need" className="citizen-card">
        <h2 id="citizen-need" className="citizen-title">Do que você precisa?</h2>
        {data.state === 'stale' && <p className="citizen-warning">Sem conexão com o mapa agora: mostrando a última busca salva.</p>}
        <div className="citizen-grid">
          {citizenCategories.map(c => {
            const best = nearestOf(data.items, c)
            return <button key={c} type="button" className="citizen-need" aria-pressed={category === c} disabled={!best} style={{ '--place-color': categoryMeta[c].color } as CSSProperties} onClick={() => choose(c)}>
              <span className="citizen-need-icon" aria-hidden="true">{categoryMeta[c].emoji}</span>
              <span className="citizen-need-label">{categoryMeta[c].short === 'Abrigos' ? 'Abrigo' : categoryMeta[c].label}</span>
              <span className="citizen-need-dist">{best ? formatDistance(best.distanceKm) : 'nenhum perto'}</span>
            </button>
          })}
        </div>
      </section>}

      {selected && <section id="citizen-result" aria-live="polite" aria-labelledby="citizen-place" className="citizen-card citizen-result" style={{ '--place-color': categoryMeta[selected.category].color } as CSSProperties}>
        <p className="citizen-kicker">{selected.shelterKind === 'possible' ? 'Possível ponto de apoio' : categoryMeta[selected.category].label}{picked ? '' : ' mais próximo'}</p>
        <h2 id="citizen-place" className="citizen-place">{categoryMeta[selected.category].emoji} {selected.name}</h2>
        <p className="citizen-distance">{formatDistance(selected.distanceKm)} <span>em linha reta</span></p>
        {selected.address && <p className="citizen-address">📍 {selected.address}</p>}
        {selected.note && <p className="citizen-warning">{selected.note}</p>}
        <a className="citizen-route citizen-route-waze" href={routeLinks(selected.coordinates).waze} target="_blank" rel="noopener noreferrer">🚗 Ir pelo Waze</a>
        <a className="citizen-route citizen-route-google" href={routeLinks(selected.coordinates).google} target="_blank" rel="noopener noreferrer">🗺️ Ir pelo Google Maps</a>
        <p className="citizen-small">A rota sai de onde você está agora. O app não sabe se a rua está alagada ou bloqueada nem se o local está aberto: siga a Defesa Civil.</p>
        {data && <MapErrorBoundary message="Mapa indisponível. Use os botões de rota acima."><Suspense fallback={<p role="status">Carregando mapa…</p>}>
          <NearbyPlacesMap origin={data.origin} items={sameCategory} selectedId={selected.id} onSelect={setPickedId} onMoveOrigin={c => { setPickedId(null); void search.searchAt(c, 'Ponto ajustado no mapa') }} />
        </Suspense></MapErrorBoundary>}
      </section>}

      <section className="citizen-card citizen-footer">
        <p>Locais do OpenStreetMap, mapeados por voluntários. Podem estar desatualizados.</p>
        <p><Link to="/abrigos">Ver lista completa, todas as categorias e checklist de preparação →</Link></p>
      </section>
    </main>
  </div>
}
