import { useEffect, useMemo } from 'react'
import { divIcon, latLngBounds } from 'leaflet'
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { CORES, marcadorHtml } from '@/features/climate/cityMap'
import type { EventoPerto } from '@/features/climate/cityMap'
import { FiltroMapaFelipe } from '@/features/climate/mapaFelipe'
import type { Coordinates } from '@/features/shelters/places'
import type { Rota } from '../data/rota'

function Enquadrar({ pontos }: { pontos: [number, number][] }) {
  const map = useMap()
  const chave = pontos.length ? `${pontos[0]}|${pontos[pontos.length - 1]}|${pontos.length}` : ''
  useEffect(() => {
    if (!pontos.length) return
    const enquadrar = () => { map.invalidateSize(); map.fitBounds(latLngBounds(pontos), { padding: [30, 30], maxZoom: 16 }) }
    enquadrar()
    const t = setTimeout(enquadrar, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, chave])
  return null
}

/** Mapa da rota dentro do site (cara do desenho do Felipe): origem azul, destino verde, áreas NASA em volta. */
export default function RotaMapa({ origem, destino, tipo, rota, eventos }: { origem: Coordinates; destino: Coordinates; tipo: 'casa' | 'cruz'; rota: Rota | null; eventos: EventoPerto[] }) {
  const icones = useMemo(() => ({
    origem: divIcon({ className: '', html: '<span class="rota-origem"></span>', iconSize: [30, 30], iconAnchor: [15, 15] }),
    destino: divIcon({ className: '', html: marcadorHtml(tipo, tipo === 'casa' ? CORES.abrigo : CORES.saude), iconSize: [38, 38], iconAnchor: [19, 19] }),
  }), [tipo])
  const linha = rota?.pontos ?? [[origem.latitude, origem.longitude], [destino.latitude, destino.longitude]] as [number, number][]
  return <div className="rota-mapa">
    <MapContainer center={[destino.latitude, destino.longitude]} zoom={14} minZoom={4} maxZoom={18} scrollWheelZoom={false} className="h-full w-full">
      <FiltroMapaFelipe />
      <Enquadrar pontos={linha} />
      <TileLayer className="mapa-felipe" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · rota OSRM' />
      {eventos.map(e => <Circle key={e.evento.id} center={e.posicao} radius={4000} pathOptions={{ color: e.cor, weight: 2, fillColor: e.cor, fillOpacity: 0.3 }} interactive={false} />)}
      {rota && <Polyline positions={linha} pathOptions={rota.calculada ? { color: '#0ce5af', weight: 6, opacity: 0.95 } : { color: '#f2cb28', weight: 4, dashArray: '8 6' }} />}
      <Marker position={[origem.latitude, origem.longitude]} icon={icones.origem} title="Origem" zIndexOffset={500} />
      <Marker position={[destino.latitude, destino.longitude]} icon={icones.destino} title="Destino" zIndexOffset={600} />
    </MapContainer>
  </div>
}
