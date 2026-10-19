import { useEffect, useMemo } from 'react'
import { divIcon } from 'leaflet'
import { CircleMarker, Marker, Polyline, Popup, Tooltip, useMap } from 'react-leaflet'
import type { PlacasDados } from './placas'
import { AMERICAS_PACIFICO, corDoSismo, haQuanto, lugarPt, magnitudePt, raioDoSismo, ROTULOS } from './placas'

/** Bordas das placas (linha), terremotos da semana (círculo do tamanho da magnitude) e nomes de referência. */
export function PlacasCamada({ dados }: { dados: PlacasDados }) {
  const rotulos = useMemo(() => ROTULOS.map(r => ({ ...r, icon: divIcon({ className: 'placa-rotulo-icon', iconSize: [0, 0],
    html: `<span class="placa-rotulo${r.destaque ? ' is-destaque' : ''}">${r.texto}</span>` }) })), [])
  const sismos = useMemo(() => [...dados.sismos].sort((a, b) => a.magnitude - b.magnitude), [dados.sismos]) // os maiores por cima
  return <>
    {dados.bordas.map((b, i) => <Polyline key={`borda-${i}`} positions={b.positions} pathOptions={{ color: '#ff5a1f', weight: 2.2, opacity: 0.9, dashArray: '6 4' }}>
      <Tooltip sticky>{b.nome}</Tooltip>
    </Polyline>)}
    {rotulos.map(r => <Marker key={r.texto} position={[r.lat, r.lon]} icon={r.icon} interactive={false} keyboard={false} />)}
    {sismos.map(s => {
      const cor = corDoSismo(s.magnitude)
      return <CircleMarker key={s.id ?? `${s.coordinates.latitude},${s.coordinates.longitude},${s.observedAt}`} center={[s.coordinates.latitude, s.coordinates.longitude]} radius={raioDoSismo(s.magnitude)}
        pathOptions={{ color: s.tsunamiSignal ? '#2f7bff' : '#ffffff', weight: s.tsunamiSignal ? 3 : 1.2, fillColor: cor, fillOpacity: 0.85 }}>
        <Popup maxWidth={240}><div className="space-y-1 text-xs">
          <strong className="text-sm">Terremoto M {magnitudePt(s.magnitude)}</strong>
          <p>{lugarPt(s.place)}</p>
          <p className="text-muted-foreground">{haQuanto(s.observedAt)}{Number.isFinite(s.depthKm) ? ` · ${Math.round(s.depthKm as number)} km de profundidade` : ''}</p>
          {s.tsunamiSignal && <p className="font-semibold text-[#1d5fd6]">Sinal de tsunami: os centros de alerta foram notificados. Isso não confirma tsunami; siga a Defesa Civil local.</p>}
        </div></Popup>
      </CircleMarker>
    })}
  </>
}

/** Ao mudar o "pedido", enquadra a costa do Pacífico das Américas (Alasca à Patagônia). */
export function FocoPacifico({ pedido }: { pedido: number }) {
  const map = useMap()
  useEffect(() => { if (pedido > 0) map.fitBounds(AMERICAS_PACIFICO, { padding: [8, 8], animate: false }) }, [map, pedido])
  return null
}
