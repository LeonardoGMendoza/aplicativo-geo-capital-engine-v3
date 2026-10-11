import { useEffect, useMemo, useState } from 'react'
import { divIcon, latLngBounds } from 'leaflet'
import type { DivIcon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './shelters.css'
import { categoryMeta, categoryOrder, formatDistance } from './places'
import type { Coordinates, Place, PlaceCategory } from './places'
import { createPlaceClusterIndex } from './placesCluster'

function useIcons() {
  return useMemo(() => {
    const make = (category: PlaceCategory, selected: boolean) => divIcon({
      className: '',
      html: `<span class="place-marker${selected ? ' is-selected' : ''}" style="--place-color:${categoryMeta[category].color}">${categoryMeta[category].emoji}</span>`,
      iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18],
    })
    return Object.fromEntries(categoryOrder.map(c => [c, [make(c, false), make(c, true)]])) as Record<PlaceCategory, [DivIcon, DivIcon]>
  }, [])
}

function PlaceMarker({ place, selected, icons, onSelect }: { place: Place; selected: boolean; icons: Record<PlaceCategory, [DivIcon, DivIcon]>; onSelect: (id: string) => void }) {
  return <Marker position={[place.coordinates.latitude, place.coordinates.longitude]} icon={icons[place.category][selected ? 1 : 0]} zIndexOffset={selected ? 900 : 0}
    title={`${place.name} · ${categoryMeta[place.category].label}`} eventHandlers={{ click: () => onSelect(place.id) }}>
    <Popup minWidth={150} maxWidth={220}><strong>{place.name}</strong><p>{place.shelterKind === 'possible' ? 'Possível ponto de apoio' : categoryMeta[place.category].label} · {formatDistance(place.distanceKm)}</p></Popup>
  </Marker>
}

function Layers({ origin, items, selectedId, onSelect }: { origin: Coordinates; items: Place[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const map = useMap()
  const icons = useIcons()
  function currentView() {
    const b = map.getBounds()
    return { zoom: map.getZoom(), bounds: [Math.max(-180, b.getWest()), Math.max(-85.0511287798, b.getSouth()), Math.min(180, b.getEast()), Math.min(85.0511287798, b.getNorth())] as [number, number, number, number] }
  }
  const [view, setView] = useState(currentView)
  useMapEvents({ moveend: () => setView(currentView()), zoomend: () => setView(currentView()) })
  const selected = items.find(p => p.id === selectedId)
  // o selecionado fica fora do agrupamento para continuar visível
  const index = useMemo(() => createPlaceClusterIndex(items.filter(p => p.id !== selectedId)), [items, selectedId])
  const features = index.getClusters(view.bounds, Math.floor(view.zoom))

  const fitKey = `${origin.latitude},${origin.longitude}|${items.length}`
  useEffect(() => {
    // enquadra todos os locais (raio da busca) para os grupos ficarem grandes e legíveis; o clique no grupo aproxima
    const points: [number, number][] = [[origin.latitude, origin.longitude], ...items.map(p => [p.coordinates.latitude, p.coordinates.longitude] as [number, number])]
    if (points.length === 1) map.setView(points[0], 14)
    else map.fitBounds(latLngBounds(points), { padding: [28, 28], maxZoom: 15 })
    setView(currentView())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey])
  useEffect(() => { if (selected) map.setView([selected.coordinates.latitude, selected.coordinates.longitude], Math.max(map.getZoom(), 16)) }, [map, selected])

  return <>
    {features.map(feature => {
      const props = feature.properties
      const [lon, lat] = feature.geometry.coordinates
      if ('cluster' in props && props.cluster) {
        const count = props.point_count
        return <Marker key={`cluster-${props.cluster_id}`} position={[lat, lon]} title={`Grupo de ${count} locais. Clique para ampliar.`}
          icon={divIcon({ className: 'nasa-cluster-icon', html: `<span>${count}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] })}
          eventHandlers={{ add: e => e.target.getElement()?.setAttribute('aria-label', `Grupo de ${count} locais. Clique para ampliar.`), click: () => map.setView([lat, lon], Math.min(index.getClusterExpansionZoom(props.cluster_id), 18)) }} />
      }
      const place = 'place' in props ? props.place : null
      return place ? <PlaceMarker key={place.id} place={place} selected={false} icons={icons} onSelect={onSelect} /> : null
    })}
    {selected && <PlaceMarker key={`selected-${selected.id}`} place={selected} selected icons={icons} onSelect={onSelect} />}
  </>
}

export default function NearbyPlacesMap({ origin, items, selectedId, onSelect, onMoveOrigin }: { origin: Coordinates; items: Place[]; selectedId: string | null; onSelect: (id: string) => void; onMoveOrigin: (coordinates: Coordinates) => void }) {
  const [failed, setFailed] = useState(false)
  const originIcon = useMemo(() => divIcon({ className: '', html: '<span class="place-origin"></span>', iconSize: [20, 20], iconAnchor: [10, 10] }), [])
  return <div className="support-map space-y-2">
    {failed && <p role="alert" className="text-sm text-amber-900">Base cartográfica parcialmente indisponível. A lista e os botões de rota continuam funcionando.</p>}
    <div className="h-[360px] overflow-hidden rounded-xl sm:h-[460px]">
      <MapContainer className="h-full w-full" center={[origin.latitude, origin.longitude]} zoom={14} maxZoom={19} scrollWheelZoom>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' eventHandlers={{ tileerror: () => setFailed(true) }} />
        <Marker position={[origin.latitude, origin.longitude]} icon={originIcon} draggable title="Ponto de busca: arraste para corrigir" zIndexOffset={1000}
          eventHandlers={{ dragend: e => { const p = e.target.getLatLng(); onMoveOrigin({ latitude: p.lat, longitude: p.lng }) } }}><Popup>Ponto de busca. Arraste para o lugar certo e a busca é refeita.</Popup></Marker>
        <Layers origin={origin} items={items} selectedId={selectedId} onSelect={onSelect} />
      </MapContainer>
    </div>
    <p className="text-xs text-muted-foreground">Ponto azul = ponto de busca: arraste para corrigir a posição. Círculos escuros agrupam locais próximos: clique para ampliar. O número é a quantidade de locais, não nível de risco.</p>
  </div>
}
