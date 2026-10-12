import { useEffect, useMemo } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { CORES, marcadorHtml } from './cityMap'
import type { EventoPerto, PontoMapa } from './cityMap'
import type { Coordinates } from '../shelters/places'

function Centralizar({ centro }: { centro: Coordinates }) {
  const map = useMap()
  useEffect(() => { map.setView([centro.latitude, centro.longitude], 11) }, [map, centro.latitude, centro.longitude])
  return null
}

/** Mapa real com a cara do desenho do Felipe: fundo escuro esverdeado, casinhas verdes, alertas vermelho/laranja. */
export default function CityRealMap({ centro, pontos, eventos, radarUrl, onRadarFalhou }: { centro: Coordinates; pontos: PontoMapa[]; eventos: EventoPerto[]; radarUrl: string | null; onRadarFalhou: () => void }) {
  const icones = useMemo(() => ({
    casa: divIcon({ className: '', html: marcadorHtml('casa', CORES.abrigo), iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] }),
    cruz: divIcon({ className: '', html: marcadorHtml('cruz', CORES.saude), iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] }),
    critico: divIcon({ className: '', html: marcadorHtml('alerta', CORES.critico), iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] }),
    atencao: divIcon({ className: '', html: marcadorHtml('alerta', CORES.atencao), iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] }),
  }), [])
  return <div className="cidade-mapa">
    <MapContainer center={[centro.latitude, centro.longitude]} zoom={11} minZoom={4} maxZoom={17} scrollWheelZoom className="h-full w-full">
      <Centralizar centro={centro} />
      <TileLayer className="cidade-base" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' />
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
