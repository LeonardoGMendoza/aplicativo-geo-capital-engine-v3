import { lazy, Suspense, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { MapPinned } from 'lucide-react'
import { MapErrorBoundary } from '@/components/shared/MapErrorBoundary'
import { getEvents } from '../nasa/client'
import { geocode, getNearbyPlaces } from '../shelters/places'
import type { Coordinates } from '../shelters/places'
import { cidadesMapa, CORES, eventosPerto, pontosDoMapa, RAIO_EVENTOS_KM, DIAS_EVENTO_RECENTE } from './cityMap'
import type { EventoPerto, PontoMapa } from './cityMap'
import { buscarRadar, RADAR_COR_TV } from './globalWeather'
import './climate.css'
const CityRealMap = lazy(() => import('./CityRealMap'))

export function CityLiveMap() {
  const [cidade, setCidade] = useState(cidadesMapa[0])
  const [endereco, setEndereco] = useState('')
  const [pontos, setPontos] = useState<PontoMapa[] | null>(null)
  const [eventos, setEventos] = useState<EventoPerto[] | null>(null)
  const [radarUrl, setRadarUrl] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const abort = new AbortController()
    buscarRadar({ signal: abort.signal }).then(r => { if (!abort.signal.aborted) setRadarUrl(r.tileUrl(RADAR_COR_TV)) }).catch(() => {})
    return () => abort.abort()
  }, [])

  useEffect(() => {
    const abort = new AbortController(), centro = cidade.coordenadas
    const aviso = (texto: string) => { if (!abort.signal.aborted) setAvisos(a => a.includes(texto) ? a : [...a, texto]) }
    setPontos(null); setEventos(null); setAvisos([])
    getEvents({ baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000', signal: abort.signal })
      .then(r => { if (!abort.signal.aborted) setEventos(eventosPerto(r.events, centro)) })
      .catch(() => { setEventos([]); aviso('Eventos da NASA indisponíveis agora.') })
    getNearbyPlaces(centro, { signal: abort.signal })
      .then(r => { if (!abort.signal.aborted) setPontos(pontosDoMapa(r.items)) })
      .catch(() => { setPontos([]); aviso('Abrigos e hospitais (OpenStreetMap) indisponíveis agora. Tente de novo em instantes.') })
    return () => abort.abort()
  }, [cidade])

  async function buscar(event: FormEvent) {
    event.preventDefault()
    if (endereco.trim().length < 2) return
    setBuscando(true)
    try {
      const [primeiro] = await geocode(endereco.trim())
      if (primeiro) setCidade({ nome: primeiro.displayName ?? primeiro.name, coordenadas: primeiro.coordinates as Coordinates })
      else setAvisos(['Endereço não encontrado. Tente cidade e estado, por exemplo: Blumenau SC.'])
    } catch { setAvisos(['Não foi possível buscar o endereço agora.']) } finally { setBuscando(false) }
  }

  return <section className="ia-panel cidade" aria-labelledby="cidade-titulo">
    <h2 id="cidade-titulo" className="ia-panel-title"><MapPinned className="size-5" aria-hidden="true" />Sua cidade agora · mapa real</h2>
    <p className="ia-muted">Mesmo visual do mapa da demonstração, só que com dados reais: abrigos e hospitais do OpenStreetMap, chuva do radar e eventos da NASA perto da cidade.</p>
    <div className="cidade-escolha">
      {cidadesMapa.map(c => <button key={c.nome} type="button" className="cidade-chip" aria-pressed={cidade.nome === c.nome} onClick={() => setCidade(c)}>{c.nome}</button>)}
      <form onSubmit={buscar} className="cidade-busca" role="search">
        <label htmlFor="cidade-endereco" className="sr-only">Outra cidade ou endereço</label>
        <input id="cidade-endereco" className="ia-input" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Outra cidade ou endereço" maxLength={120} />
        <button type="submit" className="cidade-chip" disabled={buscando || endereco.trim().length < 2}>{buscando ? 'Buscando…' : 'Ver'}</button>
      </form>
    </div>
    <p role="status" className="cidade-resumo">
      <b>{cidade.nome}</b>
      <span><i style={{ background: CORES.abrigo }} /> {pontos ? `${pontos.filter(p => p.tipo === 'casa').length} abrigos/pontos de apoio` : 'buscando abrigos…'}</span>
      <span><i style={{ background: CORES.saude }} /> {pontos ? `${pontos.filter(p => p.tipo === 'cruz').length} hospitais/UBS` : 'buscando saúde…'}</span>
      <span><i style={{ background: CORES.critico }} /> {eventos ? `${eventos.length} evento(s) NASA a até ${RAIO_EVENTOS_KM} km` : 'consultando NASA…'}</span>
    </p>
    {avisos.map(a => <p key={a} role="alert" className="ia-warn">{a}</p>)}
    <MapErrorBoundary message="Mapa indisponível agora. Os números acima continuam valendo.">
      <Suspense fallback={<p role="status" className="ia-muted">Carregando mapa…</p>}>
        <CityRealMap centro={cidade.coordenadas} pontos={pontos ?? []} eventos={eventos ?? []} radarUrl={radarUrl} onRadarFalhou={() => setRadarUrl(null)} />
      </Suspense>
    </MapErrorBoundary>
    <p className="clima-fonte">DADOS REAIS · abrigos e saúde: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> (mapeados por voluntários; escolas aparecem como possível ponto de apoio) · chuva: radar <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">RainViewer</a> · alertas: NASA EONET, eventos dos últimos {DIAS_EVENTO_RECENTE} dias (vermelho = últimos 3 dias). Não confirma risco nem rota segura: siga a Defesa Civil.</p>
  </section>
}
