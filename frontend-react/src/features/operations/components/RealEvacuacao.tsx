import { lazy, Suspense, useEffect, useState } from 'react'
import { House, LocateFixed, Route, ShieldCheck, Stethoscope } from 'lucide-react'
import { PanelHeading } from './PanelHeading'
import { MapErrorBoundary } from '@/components/shared/MapErrorBoundary'
import { buscarRota } from '../data/rota'
import type { Rota } from '../data/rota'
import { distanciaKm } from '@/features/climate/cityMap'
import type { EventoPerto, PontoMapa } from '@/features/climate/cityMap'
import type { Coordinates } from '@/features/shelters/places'
const RotaMapa = lazy(() => import('./RotaMapa'))

type Aba = 'Rota' | 'Abrigos' | 'Orientação'
const km = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/**
 * "Evacuação e Abrigos" com dados reais, no lugar do traçado ilustrativo da demonstração:
 * a rota é calculada pelas ruas (OpenStreetMap/OSRM) e desenhada aqui dentro, sem mandar para outro site.
 */
export function RealEvacuacao({ cidade, lugares, destinoId, onDestino, eventos }: {
  cidade: { nome: string; coordenadas: Coordinates }; lugares: PontoMapa[]; destinoId: string | null; onDestino: (id: string) => void; eventos: EventoPerto[]
}) {
  const [aba, setAba] = useState<Aba>('Rota')
  const [origemGps, setOrigemGps] = useState<Coordinates | null>(null)
  const [usarGps, setUsarGps] = useState(false)
  const [gpsMsg, setGpsMsg] = useState('')
  const [rota, setRota] = useState<Rota | null>(null)
  const [calculando, setCalculando] = useState(false)
  const destino = lugares.find(p => p.lugar.id === destinoId) ?? lugares[0] ?? null
  const origem = usarGps && origemGps ? origemGps : cidade.coordenadas

  useEffect(() => { setUsarGps(false); setGpsMsg('') }, [cidade.nome])
  useEffect(() => {
    if (!destino) { setRota(null); return }
    const abort = new AbortController()
    setCalculando(true); setRota(null)
    buscarRota(origem, destino.lugar.coordinates, { signal: abort.signal })
      .then(r => { if (!abort.signal.aborted) { setRota(r); setCalculando(false) } })
      .catch(() => { if (!abort.signal.aborted) setCalculando(false) })
    return () => abort.abort()
  }, [origem.latitude, origem.longitude, destino?.lugar.id])

  function pedirGps() {
    if (!('geolocation' in navigator)) { setGpsMsg('Este aparelho não informa a localização.'); return }
    setGpsMsg('Pedindo a localização…')
    navigator.geolocation.getCurrentPosition(p => {
      const c = { latitude: p.coords.latitude, longitude: p.coords.longitude }
      if (destino && distanciaKm(c, destino.lugar.coordinates) > 80) { setGpsMsg(`Você está a mais de 80 km de ${cidade.nome}; a origem continua sendo o centro da cidade.`); return }
      setOrigemGps(c); setUsarGps(true); setGpsMsg('')
    }, () => setGpsMsg('Localização não permitida. A origem continua sendo o centro da cidade.'), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 })
  }

  return <section className="light-panel flex flex-col" id="evacuacao-real" tabIndex={-1} aria-label="Evacuação e abrigos com dados reais">
    <PanelHeading title="Evacuação e Abrigos" subtitle={`Rota real pelas ruas até abrigo ou saúde · ${cidade.nome}`} icon={Route} />
    <div className="compact-tabs">{(['Rota', 'Abrigos', 'Orientação'] as const).map(item => <button type="button" key={item} aria-pressed={aba === item} onClick={() => setAba(item)}>{item}</button>)}</div>
    {aba === 'Orientação' ? <div className="space-y-3 px-4 py-6 text-xs"><ShieldCheck className="size-7 text-primary" />
      <p>A rota é a mais curta de carro pelas ruas do OpenStreetMap. Ela <b>não sabe</b> se a rua está alagada, bloqueada ou em área de risco.</p>
      <p>Confirme abrigo e caminho com a Defesa Civil (199) ou Bombeiros (193). Evite atravessar áreas marcadas em vermelho ou laranja no mapa.</p>
      <p>Para o cidadão, o app de fuga fica em <b>omni.sandlj.com.br/cidadao</b> (rota a partir do celular).</p></div>
    : aba === 'Abrigos' ? <ul className="max-h-[330px] space-y-1 overflow-auto p-3">{lugares.map(p => <li key={p.lugar.id}><button type="button" className="flex w-full items-center gap-2 rounded border p-2.5 text-left text-xs" aria-pressed={destino?.lugar.id === p.lugar.id} onClick={() => { onDestino(p.lugar.id); setAba('Rota') }}>{p.tipo === 'casa' ? <House className="size-4 shrink-0 text-[#0dac8c]" /> : <Stethoscope className="size-4 shrink-0 text-[#087bef]" />}<span className="min-w-0 flex-1 truncate">{p.lugar.name}</span><span className="text-muted-foreground">{km(p.lugar.distanceKm)} km</span></button></li>)}
        {!lugares.length && <p className="text-xs text-muted-foreground">Nenhum local mapeado perto.</p>}</ul>
    : <>
      <div className="flex flex-wrap items-end gap-2 px-3 pb-2">
        <label className="min-w-0 flex-1 text-xs text-muted-foreground">Origem<select className="mini-select mt-1 w-full" value={usarGps ? 'gps' : 'centro'} onChange={e => { if (e.target.value === 'gps') { if (origemGps) setUsarGps(true); else pedirGps() } else setUsarGps(false) }}><option value="centro">Centro de {cidade.nome}</option><option value="gps">Minha localização</option></select></label>
        <label className="min-w-0 flex-1 text-xs text-muted-foreground">Destino (real)<select className="mini-select mt-1 w-full" value={destino?.lugar.id ?? ''} onChange={e => onDestino(e.target.value)} disabled={!lugares.length}>{lugares.map(p => <option key={p.lugar.id} value={p.lugar.id}>{p.tipo === 'casa' ? '🏠' : '✚'} {p.lugar.name}</option>)}</select></label>
        <button type="button" className="flex items-center gap-1 rounded bg-primary px-3 py-2 text-xs font-medium text-white" onClick={pedirGps}><LocateFixed className="size-3.5" />Usar minha localização</button>
      </div>
      {gpsMsg && <p role="status" className="px-3 pb-2 text-xs text-amber-900">{gpsMsg}</p>}
      <div className="rota-caixa mx-2 overflow-hidden rounded-md">
        {destino ? <MapErrorBoundary message="Mapa da rota indisponível agora."><Suspense fallback={<p role="status" className="p-3 text-xs text-white">Carregando mapa…</p>}>
          <RotaMapa origem={origem} destino={destino.lugar.coordinates} tipo={destino.tipo} rota={rota} eventos={eventos} />
        </Suspense></MapErrorBoundary> : <p role="status" className="p-3 text-xs text-white">Buscando abrigos e saúde…</p>}
        {destino && (calculando || rota) && <span className="rota-selo">{calculando ? 'CALCULANDO ROTA…' : rota?.calculada ? 'ROTA REAL · ruas do OpenStreetMap' : 'LINHA RETA · serviço de rotas fora do ar'}</span>}
      </div>
      <p role="status" className="px-3 pt-2 text-xs">{destino && rota ? <><b>{usarGps ? 'Você' : 'Centro'} → {destino.lugar.name}:</b> {km(rota.km)} km{rota.minutos ? ` · cerca de ${rota.minutos} min de carro` : ' em linha reta'}</> : ' '}</p>
      <p className="px-3 pb-2 text-xs text-muted-foreground">Rota não validada para evacuação: não sabe de alagamento ou bloqueio. Confirme com a Defesa Civil.</p>
    </>}
  </section>
}
