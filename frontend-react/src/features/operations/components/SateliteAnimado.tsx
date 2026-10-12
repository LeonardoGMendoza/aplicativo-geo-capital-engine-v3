import { useEffect, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { diasDoFilme, urlSateliteLadrilhos } from '../data/complementares'
import type { Coordenadas } from '../data/complementares'

const semMovimento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const dataBR = (d: string) => d.split('-').reverse().join('/')

function Centralizar({ c }: { c: Coordenadas }) {
  const map = useMap()
  useEffect(() => { map.setView([c.latitude, c.longitude], 7) }, [map, c.latitude, c.longitude])
  return null
}

/**
 * Satélite dentro do site, em movimento: imagens reais da NASA dos últimos 8 dias em sequência (nuvens andando)
 * + radar de chuva de agora por cima. Dá para arrastar e dar zoom. Nada abre em outro site.
 */
export default function SateliteAnimado({ c, radarUrl, onData }: { c: Coordenadas; radarUrl: string | null; onData: (data: string) => void }) {
  const dias = diasDoFilme(8)
  const ultimo = dias.length - 1
  const [i, setI] = useState(ultimo)
  const [tocando, setTocando] = useState(() => !semMovimento())
  const [prontos, setProntos] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    if (!tocando) return
    const id = setTimeout(() => setI(atual => {
      for (let p = 1; p <= dias.length; p++) { const n = (atual + p) % dias.length; if (prontos.has(dias[n])) return n }
      return atual
    }), i === ultimo ? 2000 : 800)
    return () => clearTimeout(id)
  }, [tocando, i, prontos])
  const atual = dias[i]
  useEffect(() => { onData(atual) }, [atual, onData])

  return <>
    <MapContainer center={[c.latitude, c.longitude]} zoom={7} minZoom={4} maxZoom={9} scrollWheelZoom={false} zoomControl={false} attributionControl={false} className="absolute inset-0 size-full">
      <Centralizar c={c} />
      {dias.map(d => <TileLayer key={d} url={urlSateliteLadrilhos(d)} maxNativeZoom={9} maxZoom={9} opacity={d === atual ? 1 : 0} zIndex={d === atual ? 2 : 1}
        eventHandlers={{ load: () => setProntos(p => (p.has(d) ? p : new Set(p).add(d))) }} />)}
      {radarUrl && <TileLayer url={radarUrl} opacity={0.65} maxNativeZoom={7} maxZoom={9} zIndex={5} />}
      <CircleMarker center={[c.latitude, c.longitude]} radius={6} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#ff5971', fillOpacity: 1 }} />
    </MapContainer>
    <button type="button" className="absolute bottom-24 right-3 z-[500] rounded bg-[#0d5072] px-2 py-1 text-xs" onClick={() => setTocando(t => !t)} aria-pressed={tocando}>{tocando ? '❚❚ Pausar' : '▶ Animar'} · {dataBR(atual)}</button>
  </>
}
