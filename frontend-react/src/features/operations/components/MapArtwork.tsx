import { useId } from 'react'
import { TriangleAlert, House, MapPin } from 'lucide-react'
import type { DemoAlert } from '@/types/operations'
import { demoMapShelters } from '../data/demo'

const colors = { critical: '#fa284c', high: '#f4a024', attention: '#f4a024' }
export function MapArtwork({ alerts, selectedId, onSelect, layer = 'Risco', route = false, criticalOnly = false }: { alerts: DemoAlert[]; selectedId?: string; onSelect?: (id: string) => void; layer?: string; route?: boolean; criticalOnly?: boolean }) {
  const id = useId().replaceAll(':', '')
  return <div className="map-surface h-full min-h-40">
    <svg className="absolute inset-0 size-full" viewBox="0 0 600 400" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id={`terrain-${id}`} width="90" height="70" patternUnits="userSpaceOnUse"><rect width="90" height="70" fill="#183d32" /><path d="M0 15L28 0 48 30 90 9M-5 47L22 65 65 38 95 60" fill="none" stroke="#335740" strokeWidth="12" opacity=".6" /><path d="M0 15L28 0 48 30 90 9M-5 47L22 65 65 38 95 60" fill="none" stroke="#75917a" strokeWidth=".6" /></pattern>
      </defs>
      <rect width="600" height="400" fill={`url(#terrain-${id})`} />
      {Array.from({ length: 90 }, (_, i) => <rect key={i} x={(i * 53) % 595} y={(i * 41) % 390} width={10 + i % 14} height={4 + i % 7} rx="1" fill={i % 3 === 0 ? '#8b947a' : '#56776b'} opacity=".45" transform={`rotate(${i % 2 ? 24 : -12} ${(i * 53) % 595} ${(i * 41) % 390})`} />)}
      <path d="M305 -10C320 80 440 60 410 135S260 200 320 275 415 320 380 410" fill="none" stroke="#123a61" strokeWidth="24" /><path d="M305 -10C320 80 440 60 410 135S260 200 320 275 415 320 380 410" fill="none" stroke="#207dbe" strokeWidth="9" opacity=".6" />
      {['M-10 265L92 240 161 310 320 278 455 330 610 295','M50 -10L140 100 105 172 237 215 297 139 410 95 600 160','M-10 95L130 123 218 82 304 109 390 27 600 49','M80 400L195 280 252 173 432 211 580 400'].map((d) => <g key={d}><path d={d} fill="none" stroke="#153c45" strokeWidth="5" /><path d={d} fill="none" stroke="#bac9bb" strokeWidth="1.5" opacity=".8" /></g>)}
      {(layer === 'Risco' || route) && <><path d="M80 80L182 67 250 135 223 200 112 207 55 147Z" fill="#f52744" fillOpacity=".48" stroke="#ff6b75" strokeWidth="2" /><path d="M30 183L113 170 211 219 188 272 81 282 22 240Z" fill="#ffa424" fillOpacity=".35" stroke="#dca449" strokeWidth="1.3" /></>}
      {layer === 'Chuvas' && <rect width="600" height="400" fill="#047bcd" opacity=".35" />}
      {layer === 'Nível dos rios' && <path d="M305 -10C320 80 440 60 410 135S260 200 320 275 415 320 380 410" fill="none" stroke="#48c7ff" strokeWidth="45" opacity=".3" />}
      {layer === 'Deslizamentos' && <path d="M70 30L230 15 310 90 240 140Z" fill="#f99a22" opacity=".45" />}
      {route && <><path d="M165 130L190 270 285 315 417 280 500 180" fill="none" stroke="#0ce5af" strokeWidth="5" /><path d="M165 130L270 75 475 100 500 180" fill="none" stroke="#f2cb28" strokeDasharray="7 5" strokeWidth="3" /></>}
      <g fill="#f2f7f1" fontFamily="Segoe UI, sans-serif" fontWeight="600" fontSize="14" stroke="#17352d" strokeWidth="3" paintOrder="stroke">{alerts.filter(alert => alert.mapPosition).map(alert => <text key={alert.id} x={alert.mapPosition!.labelX} y={alert.mapPosition!.labelY}>{alert.location.split(' · ')[0]}</text>)}<text x="200" y="365">Jardim das Flores</text></g>
    </svg>
    {alerts.filter(alert => alert.mapPosition).map(alert => (!criticalOnly || alert.risk === 'critical') && <button key={alert.id} type="button" className="map-marker" style={{ left: alert.mapPosition!.left, top: alert.mapPosition!.top, background: colors[alert.risk] }} aria-label={`Selecionar alerta simulado: ${alert.title}, ${alert.location}`} aria-pressed={selectedId === alert.id} onClick={() => onSelect?.(alert.id)} disabled={!onSelect}><TriangleAlert className="size-4" aria-hidden="true" /></button>)}
    {demoMapShelters.map(shelter => <span key={shelter.id} className="map-marker" style={{ ...shelter.mapPosition, background: '#0dac8c' }} aria-hidden="true"><House className="size-4" /></span>)}
    {route && <span className="map-marker" style={{ left: '83%', top: '45%', background: '#087bef' }} aria-hidden="true"><MapPin className="size-4" /></span>}
    <span className="map-caption">SIMULAÇÃO · desenho sem escala · regiões fictícias</span>
  </div>
}
