import { useMemo, useState } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { dataCurta, emojiTipo, RADAR_COR_RESERVA, RADAR_COR_TV } from './globalWeather'
import type { AlertaGlobal, Radar } from './globalWeather'

/** Mapa mundial (Leaflet): base OpenStreetMap, camada de radar de chuva e marcadores dos alertas GDACS. */
export default function WorldWeatherMap({ radar, alertas, mostrarRadar, mostrarAlertas, onRadarFalhou }: { radar: Radar | null; alertas: AlertaGlobal[]; mostrarRadar: boolean; mostrarAlertas: boolean; onRadarFalhou: () => void }) {
  const [cor, setCor] = useState(RADAR_COR_TV)
  const icones = useMemo(() => Object.fromEntries(alertas.map(a => [a.id, divIcon({
    className: '', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14],
    html: `<span class="mundo-marcador ${a.nivel}" aria-hidden="true">${emojiTipo[a.tipo] ?? '⚠️'}</span>`,
  })])), [alertas])
  function erroRadar() {
    if (cor === RADAR_COR_TV) setCor(RADAR_COR_RESERVA) // tenta a paleta padrão antes de desistir
    else onRadarFalhou()
  }
  return <div className="mundo-mapa">
    <MapContainer center={[15, -20]} zoom={2} minZoom={2} maxZoom={10} worldCopyJump scrollWheelZoom className="h-full w-full">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      {mostrarRadar && radar && <TileLayer key={cor} url={radar.tileUrl(cor)} opacity={0.75} maxNativeZoom={7} maxZoom={10} zIndex={5}
        attribution='Radar: <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>' eventHandlers={{ tileerror: erroRadar }} />}
      {mostrarAlertas && alertas.map(a => <Marker key={a.id} position={[a.latitude, a.longitude]} icon={icones[a.id]} title={`${a.tipoNome} · alerta ${a.nivel}`}>
        <Popup minWidth={180} maxWidth={240}>
          <strong>{emojiTipo[a.tipo]} {a.nome}</strong>
          <p>{a.tipoNome} · alerta <b>{a.nivel}</b>{a.pais ? ` · ${a.pais}` : ''}</p>
          <p>Desde {dataCurta(a.inicio)}</p>
          {a.link && <p><a href={a.link} target="_blank" rel="noopener noreferrer">Relatório no GDACS ↗</a></p>}
        </Popup>
      </Marker>)}
    </MapContainer>
  </div>
}
