// Mapa pequeno da área afetada de um alerta do GDACS (dentro do modal). Carregado só quando precisa (lazy).
import { useEffect } from 'react'
import { circleMarker, geoJSON } from 'leaflet'
import type { GeoJsonObject } from 'geojson'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { corDaClasse } from './gdacsDetalhes'
import type { DetalhesGdacs } from './gdacsDetalhes'

type Props = { area: NonNullable<DetalhesGdacs['area']>; centro: [number, number] | null }
type Feat = { properties?: { classe?: string } }

function Enquadrar({ area }: { area: Props['area'] }) {
  const map = useMap()
  useEffect(() => {
    // O modal abre com animação: espera o tamanho final antes de enquadrar a área.
    const enquadrar = () => {
      map.invalidateSize()
      const limites = geoJSON(area as unknown as GeoJsonObject).getBounds()
      if (limites.isValid()) map.fitBounds(limites, { padding: [16, 16], maxZoom: 9 })
    }
    enquadrar()
    const t = setTimeout(enquadrar, 300)
    return () => clearTimeout(t)
  }, [map, area])
  return null
}

export default function GdacsMapa({ area, centro }: Props) {
  return (
    <MapContainer center={centro ?? [0, 0]} zoom={4} scrollWheelZoom={false} style={{ height: 220, width: '100%' }} className="rounded border" aria-label="Mapa da área afetada">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · GDACS' />
      <GeoJSON data={area as unknown as GeoJsonObject}
        style={f => { const cor = corDaClasse((f as Feat | undefined)?.properties?.classe ?? ''); return { color: cor, weight: 2, fillColor: cor, fillOpacity: 0.2 } }}
        pointToLayer={(f, latlng) => circleMarker(latlng, { radius: 3, color: corDaClasse((f as Feat).properties?.classe ?? ''), weight: 1, fillOpacity: 0.8 })} />
      <Enquadrar area={area} />
    </MapContainer>
  )
}
