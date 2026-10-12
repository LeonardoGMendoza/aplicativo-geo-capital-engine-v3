import { useState } from 'react'
import { MapContainer, Rectangle, TileLayer, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { diasAtras, NINO34, urlAnomaliaMar } from './elNino'

/** Satélite da NASA: anomalia da temperatura do mar. Vermelho = mais quente que o normal (o El Niño é a faixa no Pacífico equatorial). */
export default function ElNinoOceanMap({ onData, onFalhou }: { onData: (data: string) => void; onFalhou: () => void }) {
  const [atraso, setAtraso] = useState(2)
  const data = diasAtras(atraso)
  function erro() {
    if (atraso < 5) setAtraso(a => a + 1) // dia ainda não publicado: tenta o anterior
    else onFalhou()
  }
  return <div className="nino-mapa">
    <MapContainer center={[-5, -105]} zoom={2} minZoom={2} maxZoom={7} worldCopyJump scrollWheelZoom={false} className="h-full w-full">
      <TileLayer className="nino-base" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      <TileLayer key={data} url={urlAnomaliaMar(data)} maxNativeZoom={7} maxZoom={7} opacity={0.9}
        attribution='Temperatura do mar: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a> / GHRSST MUR'
        eventHandlers={{ load: () => onData(data), tileerror: erro }} />
      <Rectangle bounds={NINO34} pathOptions={{ color: '#ffffff', weight: 2, dashArray: '6 4', fillOpacity: 0 }}>
        <Tooltip permanent direction="top" className="nino-rotulo">Região Niño 3.4 · onde se mede o El Niño</Tooltip>
      </Rectangle>
    </MapContainer>
  </div>
}
