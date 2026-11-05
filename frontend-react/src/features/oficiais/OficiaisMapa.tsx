import { useEffect, useMemo } from 'react'
import { divIcon, latLngBounds } from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polygon, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { AlertaOficial, ResumoLugar } from './oficiais'
import { COR_NIVEL, quandoTexto, ROTULO_NIVEL } from './oficiais'
import { IconeEvento } from './icones'

function Foco({ alerta }: { alerta: AlertaOficial | null }) {
  const map = useMap()
  useEffect(() => {
    if (!alerta) return
    if (alerta.poligono?.length) map.fitBounds(latLngBounds(alerta.poligono), { maxZoom: 9, padding: [20, 20], animate: false })
    else if (alerta.latitude != null && alerta.longitude != null) map.setView([alerta.latitude, alerta.longitude], Math.max(map.getZoom(), 6), { animate: false })
  }, [map, alerta])
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

function Detalhe({ a }: { a: AlertaOficial }) {
  return <div className="space-y-1 text-xs">
    <strong className="flex items-center gap-1.5 text-sm"><IconeEvento evento={a.evento} className="size-4" />{a.evento}</strong>
    <p style={{ color: COR_NIVEL[a.severidade] }} className="font-semibold">● {ROTULO_NIVEL[a.severidade]} · {quandoTexto(a)}</p>
    {a.area && <p>{a.area.length > 220 ? `${a.area.slice(0, 220)}…` : a.area}</p>}
    {a.instrucao && <p><b>O que fazer:</b> {a.instrucao.length > 220 ? `${a.instrucao.slice(0, 220)}…` : a.instrucao}</p>}
    <p className="text-muted-foreground">Fonte oficial: {a.fonte}</p>
  </div>
}

export default function OficiaisMapa({ alertas, lugares, selecionado, onSelect }: { alertas: AlertaOficial[]; lugares: ResumoLugar[]; selecionado: AlertaOficial | null; onSelect: (id: string) => void }) {
  // Etiqueta escura com o nome do lugar (o texto é escapado: vem do aparelho da pessoa)
  const etiqueta = (nome: string) => divIcon({ className: 'ofc-pin-icon', iconSize: [0, 0], iconAnchor: [0, 0],
    html: `<span class="ofc-pin"><b>${nome.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)}</b><i></i></span>` })
  // Os mais graves por cima
  const ordenados = useMemo(() => [...alertas].sort((a, b) => (b.severidade === 'extremo' ? 0 : b.severidade === 'severo' ? 1 : 2) - (a.severidade === 'extremo' ? 0 : a.severidade === 'severo' ? 1 : 2)), [alertas])
  return <div role="region" aria-label="Mapa dos alertas oficiais e dos meus lugares" className="ofc-mapa relative isolate z-0 overflow-hidden rounded border">
    <MapContainer center={[-15, -55]} zoom={3} minZoom={2} maxZoom={16} maxBounds={[[-85.05, -180], [85.05, 180]]} maxBoundsViscosity={1} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" noWrap attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      {ordenados.map(a => {
        const cor = COR_NIVEL[a.severidade]
        const ativo = selecionado?.id === a.id
        if (a.poligono?.length) return <Polygon key={a.id} positions={a.poligono} pathOptions={{ color: cor, weight: ativo ? 4 : 2, fillColor: cor, fillOpacity: ativo ? 0.45 : 0.25 }} eventHandlers={{ click: () => onSelect(a.id) }}>
          <Tooltip sticky>{a.evento} · {ROTULO_NIVEL[a.severidade]}</Tooltip><Popup maxWidth={260}><Detalhe a={a} /></Popup>
        </Polygon>
        if (a.latitude == null || a.longitude == null) return null
        return <CircleMarker key={a.id} center={[a.latitude, a.longitude]} radius={ativo ? 13 : 9} pathOptions={{ color: '#fff', weight: 2, fillColor: cor, fillOpacity: 0.9 }} eventHandlers={{ click: () => onSelect(a.id) }}>
          <Tooltip>{a.evento}{a.pais ? ` · ${a.pais}` : ''} · {ROTULO_NIVEL[a.severidade]}</Tooltip><Popup maxWidth={260}><Detalhe a={a} /></Popup>
        </CircleMarker>
      })}
      {lugares.map(c => <Marker key={c.id} position={[c.latitude, c.longitude]} icon={etiqueta(c.nome)} title={`Meu lugar: ${c.nome}`} />)}
      <Foco alerta={selecionado} />
    </MapContainer>
  </div>
}
