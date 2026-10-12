import { useEffect, useMemo, useRef, useState } from 'react'
import { divIcon } from 'leaflet'
import type { Marker as LeafletMarker } from 'leaflet'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { FiltroMapaFelipe } from '@/features/climate/mapaFelipe'
import 'leaflet/dist/leaflet.css'
import type { NasaEvent } from './contracts'
import type { Asset } from './proximity'
import { createClusterIndex, formatObservation, mapPosition } from './geography'
import { categoriaPt, corDoEvento, ondeFica, tituloPt, vistoHa } from './leitura'
import { marcadorHtml } from '@/features/climate/cityMap'

function EventMarker({ event, selected, onSelect }: { event: NasaEvent; selected: boolean; onSelect: (id: string) => void }) {
  const marker = useRef<LeafletMarker>(null)
  const map = useMap()
  const popupWidth = Math.min(260, Math.max(140, map.getSize().x - 70))
  const position = mapPosition(event)
  const cor = corDoEvento(event)
  // Igual ao desenho do Felipe: bolinha com o triângulo de alerta, vermelha (visto nos últimos dias) ou laranja (visto há mais tempo).
  const icon = useMemo(() => divIcon({ className: 'nasa-event-icon', iconSize: [44, 44], iconAnchor: [22, 22],
    html: `<span class="nasa-felipe ${selected ? 'is-selected' : ''}">${marcadorHtml('alerta', cor)}</span>` }), [cor, selected])
  useEffect(() => {
    marker.current?.getElement()?.setAttribute('aria-label', `${tituloPt(event.title)} · ${categoriaPt(event)} · ${vistoHa(event)}`)
    if (selected) marker.current?.openPopup()
  }, [selected, event, popupWidth])
  if (!position) return null
  return <>
    <CircleMarker center={position} radius={26} pathOptions={{ color: cor, weight: 2, fillColor: cor, fillOpacity: 0.28 }} interactive={false} />
    <Marker ref={marker} position={position} icon={icon} title={`${tituloPt(event.title)} · ${categoriaPt(event)} · ${vistoHa(event)}`} eventHandlers={{ click: () => onSelect(event.id) }}>
      <Popup key={popupWidth} minWidth={140} maxWidth={popupWidth} maxHeight={200} autoPanPaddingTopLeft={[10, 70]} autoPanPaddingBottomRight={[10, 10]}><div className="space-y-1 text-xs">
        <strong className="text-sm">{tituloPt(event.title)}</strong>
        <p style={{ color: cor }} className="font-semibold">● {categoriaPt(event)} · {vistoHa(event)}</p>
        <p>{ondeFica(event)}</p>
        <p className="text-muted-foreground">Satélite NASA · {formatObservation(event.observedAt)}</p>
        <p className="text-muted-foreground">Não confirma risco local: a decisão é humana.</p>
      </div></Popup>
    </Marker>
  </>
}

function GeographicLayers({ events, selectedId, onSelect }: { events: NasaEvent[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const map = useMap()
  function currentView() {
    const bounds = map.getBounds()
    return { zoom: map.getZoom(), bounds: [Math.max(-180, bounds.getWest()), Math.max(-85.0511287798, bounds.getSouth()), Math.min(180, bounds.getEast()), Math.min(85.0511287798, bounds.getNorth())] as [number, number, number, number] }
  }
  const [view, setView] = useState(currentView)
  useMapEvents({ moveend: () => setView(currentView()), zoomend: () => setView(currentView()) })
  const selected = events.find(event => event.id === selectedId)
  const index = useMemo(() => createClusterIndex(events.filter(event => event.id !== selectedId)), [events, selectedId])
  const features = index.getClusters(view.bounds, Math.floor(view.zoom))
  useEffect(() => {
    const position = selected ? mapPosition(selected) : null
    if (position) map.setView(position, Math.max(map.getZoom(), 6), { animate: false })
    else map.closePopup()
  }, [map, selected])
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return <>
    {features.map(feature => {
      const props = feature.properties
      if ('cluster' in props && props.cluster) {
        const count = props.point_count
        return <Marker key={`cluster-${props.cluster_id}`} position={[feature.geometry.coordinates[1], feature.geometry.coordinates[0]]}
          title={`Grupo de ${count} eventos. Ativar para ampliar.`} icon={divIcon({ className: 'nasa-cluster-icon', html: `<span>${count}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] })}
          eventHandlers={{ add: event => event.target.getElement()?.setAttribute('aria-label', `Grupo de ${count} eventos. Ativar para ampliar.`), click: () => map.setView([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], Math.min(index.getClusterExpansionZoom(props.cluster_id), 18), { animate: false }) }} />
      }
      const event = 'event' in props ? props.event : null
      return event ? <EventMarker key={event.id} event={event} selected={false} onSelect={onSelect} /> : null
    })}
    {selected && <EventMarker key={`selected-${selected.id}`} event={selected} selected onSelect={onSelect} />}
  </>
}

function AssetLayers({ assets, selectedId, onSelect }: { assets: Asset[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const map = useMap()
  const [popupWidth, setPopupWidth] = useState(() => Math.min(260, Math.max(140, map.getSize().x - 70)))
  useMapEvents({ resize: () => setPopupWidth(Math.min(260, Math.max(140, map.getSize().x - 70))) })
  const selected = assets.find(a => a.id === selectedId)
  useEffect(() => { if (selected) map.setView([selected.coordinates.latitude, selected.coordinates.longitude], 6, { animate: false }) }, [map, selected])
  const icon = useMemo(() => divIcon({ className: 'mvp-asset-icon', iconSize: [44, 44], iconAnchor: [22, 22], html: '<span style="display:block;background:#16364c;color:white;border:3px solid #2dd4bf;border-radius:4px;text-align:center;font-size:18px;line-height:38px">◆</span>' }), [])
  return <>{assets.map(a => <Marker key={a.id} position={[a.coordinates.latitude, a.coordinates.longitude]} icon={icon} title={`Ativo MVP: ${a.name} · referência`} eventHandlers={{ add: e => e.target.getElement()?.setAttribute('aria-label', `Ativo MVP: ${a.name} · referência`), click: () => onSelect(a.id) }}><Popup key={popupWidth} minWidth={140} maxWidth={popupWidth} maxHeight={180} autoPanPaddingTopLeft={[10, 70]} autoPanPaddingBottomRight={[10, 10]}><strong>{a.name}</strong><p>Ativo do MVP · referência não verificada</p><p>{a.id} · {a.sourceFile}</p><p>Lat/Lon: {a.coordinates.latitude}, {a.coordinates.longitude}</p><p>Não confirma segurança ou operação.</p></Popup></Marker>)}</>
}

export default function NasaGeographicMap({ events, selectedId, onSelect, assets, selectedAssetId, onAssetSelect }: { events: NasaEvent[]; selectedId: string | null; onSelect: (id: string) => void; assets: Asset[]; selectedAssetId: string | null; onAssetSelect: (id: string) => void }) {
  const [tileError, setTileError] = useState(false)
  return <div className="min-w-0">
    {tileError && <p role="status" className="mb-1 text-amber-900">Base OpenStreetMap parcialmente indisponível. Marcadores e lista continuam disponíveis.</p>}
    <div role="region" aria-label="Mapa geográfico de eventos NASA, sem avaliação de risco" className="nasa-map relative isolate z-0 h-[340px] overflow-hidden rounded border sm:h-[420px]">
      <MapContainer center={[-15, -55]} zoom={3} minZoom={2} maxZoom={18} maxBounds={[[-85.0511287798, -180], [85.0511287798, 180]]} maxBoundsViscosity={1} scrollWheelZoom={false} className="h-full w-full">
        <FiltroMapaFelipe />
        <TileLayer className="mapa-felipe" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" noWrap attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' eventHandlers={{ loading: () => setTileError(false), tileerror: () => setTileError(true) }} />
        <GeographicLayers events={events} selectedId={selectedId} onSelect={onSelect} />
        <AssetLayers assets={assets} selectedId={selectedAssetId} onSelect={onAssetSelect} />
      </MapContainer>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">Arraste ou use +/− para ver o mundo · número = grupo de eventos (clique para abrir).</p>
  </div>
}
