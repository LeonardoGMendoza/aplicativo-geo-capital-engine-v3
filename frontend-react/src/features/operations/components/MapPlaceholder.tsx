import { useEffect, useState } from 'react'
import { Layers, Map, Search } from 'lucide-react'
import { PanelHeading } from './PanelHeading'
import { MapArtwork } from './MapArtwork'
import type { DemoAlert } from '@/types/operations'
import { demoMapShelters, demoShelters } from '../data/demo'

export function MapPlaceholder({ alerts, selectedId, onSelect, onDetails }: { alerts: DemoAlert[]; selectedId: string; onSelect: (id: string) => void; onDetails: () => void }) {
  const [layer, setLayer] = useState('Risco')
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResult, setSearchResult] = useState('')
  const selected = alerts.find(alert => alert.id === selectedId)
  useEffect(() => { if (selected?.risk !== 'critical') setCriticalOnly(false) }, [selectedId, selected?.risk])
  function toggleCriticalFilter() {
    if (!criticalOnly) {
      const critical = alerts.find(alert => alert.risk === 'critical' && alert.mapPosition)
      if (critical) onSelect(critical.id)
    }
    setCriticalOnly(!criticalOnly)
  }
  function searchLocal() {
    const match = alerts.find((alert) => `${alert.title} ${alert.location}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')))
    if (search.trim() && match) { onSelect(match.id); setSearchResult('Alerta fictício selecionado.') }
    else setSearchResult('Busque pelo nome de um alerta ou região deste cenário fictício.')
  }
  return <section className="light-panel flex flex-col" id="mapa" aria-label="Mapa da situação atual, simulação">
    <PanelHeading title="Mapa da Situação Atual" icon={Map} />
    <div className="flex gap-1 overflow-x-auto px-2 pb-2">{['Risco', 'Chuvas', 'Nível dos rios', 'Deslizamentos', 'Infraestrutura'].map((item) => <button key={item} type="button" aria-pressed={layer === item} onClick={() => setLayer(item)} className="whitespace-nowrap rounded px-2 py-1.5 text-xs text-white" style={{ background: layer === item ? '#0873f5' : '#075271' }}>{item}</button>)}</div>
    <form onSubmit={(event) => { event.preventDefault(); searchLocal() }} className="flex gap-1 px-2 pb-2"><label className="flex min-w-0 flex-1 items-center gap-1 rounded border bg-white px-2"><Search className="size-3 shrink-0 text-muted-foreground" /><input aria-label="Buscar alerta ou região do cenário" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alerta ou região fictícia…" className="min-w-0 flex-1 py-1.5 text-xs outline-none" /></label><button type="submit" className="mini-select">Buscar</button><button type="button" aria-pressed={criticalOnly} onClick={toggleCriticalFilter} className="mini-select" aria-label={criticalOnly ? 'Mostrar todos' : 'Filtrar críticos'}><Layers className="size-3" /></button></form>
    {searchResult && <p role="status" className="px-3 pb-2 text-xs text-muted-foreground">{searchResult}</p>}
    <div className="mx-2 min-h-[310px] flex-1 overflow-hidden rounded-md"><MapArtwork alerts={alerts} selectedId={selectedId} onSelect={onSelect} layer={layer} criticalOnly={criticalOnly} /></div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"><span>🔴 Crítico · 🟠 Alto · 🟡 Atenção · 🟢 Abrigo ilustrativo</span><button type="button" onClick={onDetails} className="text-link">Ver alerta selecionado</button></div>
    <p className="px-3 pb-2 text-xs text-muted-foreground">{selected?.location}{selected && !selected.mapPosition ? ' · sem marcador neste desenho' : ''} · {demoMapShelters.length} de {demoShelters.length} pontos de apoio ilustrados; lista completa no painel Abrigos.</p>
  </section>
}
