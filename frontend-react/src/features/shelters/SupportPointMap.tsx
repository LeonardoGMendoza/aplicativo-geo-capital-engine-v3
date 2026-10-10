import { useEffect, useMemo, useState } from 'react'
import { divIcon, latLngBounds } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './shelters.css'
import { supportPoints } from './reference'
function View({ selectedId }: { selectedId: string | null }) {
  const map = useMap()
  useEffect(() => { map.fitBounds(latLngBounds(supportPoints.map(p => [p.latitude, p.longitude])), { padding: [24, 24] }) }, [map])
  useEffect(() => { map.closePopup(); const p = supportPoints.find(p => p.id === selectedId); if (p) map.setView([p.latitude, p.longitude], 12) }, [map, selectedId])
  return null
}
export default function SupportPointMap({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const [failed, setFailed] = useState(false)
  const icons = useMemo(() => [false, true].map(selected => divIcon({ className: '', html: `<span style="display:block;width:24px;height:24px;border:3px solid white;border-radius:50%;background:${selected ? '#0f2942' : '#008577'};box-shadow:0 0 0 3px ${selected ? '#25d3b6' : '#0f2942'}"></span>`, iconSize: [24, 24], iconAnchor: [12, 12] })), [])
  return <div className="support-map space-y-2">{failed && <p role="alert" className="text-sm text-amber-900">Base cartográfica indisponível. Lista, coordenadas e detalhes continuam disponíveis.</p>}<div className="h-[340px] overflow-hidden rounded-xl sm:h-[430px]"><MapContainer className="h-full w-full" center={[-26, -48]} zoom={5} scrollWheelZoom={false}><TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' eventHandlers={{ tileerror: () => setFailed(true) }} /><View selectedId={selectedId} />{supportPoints.map(p => <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icons[p.id === selectedId ? 1 : 0]} title={`${p.name} · referência`} eventHandlers={{ click: () => onSelect(p.id) }}><Popup minWidth={140} maxWidth={200}><strong>{p.name}</strong><p>{p.city} · coordenadas aproximadas</p></Popup></Marker>)}</MapContainer></div></div>
}
