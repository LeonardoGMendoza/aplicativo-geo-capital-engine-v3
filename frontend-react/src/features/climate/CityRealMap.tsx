import { useEffect, useMemo } from 'react'
import { divIcon, latLngBounds } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { CORES, maisPertoDoCentro, marcadorHtml } from './cityMap'
import type { EventoPerto, PontoMapa } from './cityMap'
import type { Coordinates } from '../shelters/places'

function Enquadrar({ centro, pontos }: { centro: Coordinates; pontos: PontoMapa[] }) {
  const map = useMap()
  const chave = `${centro.latitude},${centro.longitude}|${pontos.length}`
  useEffect(() => {
    // Enquadra a cidade e os pontos mostrados, sem afastar demais. Antes, recalcula o tamanho do mapa:
    // dentro de painéis que crescem depois (Centro de Operações), o Leaflet achava o mapa pequeno e afastava demais.
    const enquadrar = () => {
      map.invalidateSize()
      const todos: [number, number][] = [[centro.latitude, centro.longitude], ...pontos.map(p => [p.lugar.coordinates.latitude, p.lugar.coordinates.longitude] as [number, number])]
      if (todos.length === 1) map.setView(todos[0], 14)
      else map.fitBounds(latLngBounds(todos), { padding: [40, 40], maxZoom: 16 })
    }
    enquadrar()
    const depois = setTimeout(enquadrar, 350)
    return () => clearTimeout(depois)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, chave])
  useEffect(() => {
    if (typeof ResizeObserver !== 'function') return
    const obs = new ResizeObserver(() => map.invalidateSize())
    obs.observe(map.getContainer())
    return () => obs.disconnect()
  }, [map])
  return null
}

/** Mapa real com a cara do desenho do Felipe: fundo escuro esverdeado, casinhas verdes, alertas vermelho/laranja. */
export default function CityRealMap({ centro, pontos: todosPontos, eventos, radarUrl, onRadarFalhou }: { centro: Coordinates; pontos: PontoMapa[]; eventos: EventoPerto[]; radarUrl: string | null; onRadarFalhou: () => void }) {
  const pontos = useMemo(() => maisPertoDoCentro(todosPontos), [todosPontos])
  const icones = useMemo(() => ({
    casa: divIcon({ className: '', html: marcadorHtml('casa', CORES.abrigo), iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -18] }),
    cruz: divIcon({ className: '', html: marcadorHtml('cruz', CORES.saude), iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -18] }),
    critico: divIcon({ className: '', html: marcadorHtml('alerta', CORES.critico), iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -20] }),
    atencao: divIcon({ className: '', html: marcadorHtml('alerta', CORES.atencao), iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -20] }),
  }), [])
  return <div className="cidade-mapa">
    <MapContainer center={[centro.latitude, centro.longitude]} zoom={14} minZoom={4} maxZoom={18} scrollWheelZoom className="h-full w-full">
      <Enquadrar centro={centro} pontos={pontos} />
      <TileLayer className="cidade-base" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      {radarUrl && <TileLayer url={radarUrl} opacity={0.7} maxNativeZoom={7} maxZoom={17} zIndex={5} eventHandlers={{ tileerror: onRadarFalhou }}
        attribution='Radar: <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>' />}
      {pontos.map(p => <Marker key={p.lugar.id} position={[p.lugar.coordinates.latitude, p.lugar.coordinates.longitude]} icon={icones[p.tipo]} title={`${p.lugar.name} · ${p.rotulo}`}>
        <Popup minWidth={160} maxWidth={230}><strong>{p.lugar.name}</strong><p>{p.rotulo}{p.lugar.address ? ` · ${p.lugar.address}` : ''}</p></Popup>
      </Marker>)}
      {eventos.map(e => <Marker key={e.evento.id} position={e.posicao} icon={e.cor === CORES.critico ? icones.critico : icones.atencao} zIndexOffset={800} title={e.evento.title}>
        <Popup minWidth={170} maxWidth={240}><strong>{e.evento.title}</strong><p>NASA EONET · {e.evento.categories.map(c => c.title).join(', ')}</p><p>A {Math.round(e.km)} km · observado há {e.dias < 1 ? 'menos de 1 dia' : `${Math.round(e.dias)} dia(s)`}</p></Popup>
      </Marker>)}
    </MapContainer>
  </div>
}
