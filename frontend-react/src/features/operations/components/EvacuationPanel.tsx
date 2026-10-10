import { useState } from 'react'
import { House, Route, ShieldCheck } from 'lucide-react'
import { PanelHeading } from './PanelHeading'
import { MapArtwork } from './MapArtwork'
import { visualDemo } from '../data/visual-demo'
import type { DemoAlert } from '@/types/operations'

export function EvacuationPanel({ alerts, onPreview }: { alerts: DemoAlert[]; onPreview: (title: string, body: string) => void }) {
  const [tab, setTab] = useState('Traçado ilustrativo')
  const [origin, setOrigin] = useState('Vila Nova')
  const [destination, setDestination] = useState<string>(visualDemo.sheltersList[0].name)
  const [routeMessage, setRouteMessage] = useState('')
  return <section className="light-panel" aria-label="Evacuação e abrigos ilustrativos">
    <PanelHeading title="Evacuação e Abrigos" subtitle="Cenário ilustrativo de orientação para a população." icon={Route} />
    <div className="compact-tabs">{['Visão Geral', 'Traçado ilustrativo', 'Abrigos', 'Orientação'].map((item) => <button type="button" key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}</div>
    {tab === 'Orientação' ? <div className="space-y-3 px-4 py-6 text-xs"><ShieldCheck className="size-7 text-primary" /><p>Confirme abrigos e rotas com a Defesa Civil. Este desenho não determina caminhos seguros.</p><p>O checklist e os contatos continuam disponíveis no MVP original.</p><button type="button" className="text-link" onClick={() => onPreview('Revisão demonstrativa de protocolo', 'Revisar água potável, medicamentos, documentos e canais oficiais. Nenhum protocolo ou resgate foi acionado.')}>Revisar orientação</button></div> : tab === 'Abrigos' ? <div className="space-y-3 p-4">{visualDemo.sheltersList.map((item) => <button type="button" key={item.name} className="flex w-full items-center gap-2 rounded border p-3 text-left text-xs" onClick={() => onPreview(item.name, 'Abrigo fictício do mockup. Endereço, ocupação e capacidade são ilustrativos, sem confirmação de disponibilidade.')}><House className="size-4 text-primary" />{item.name}</button>)}</div> : <>
      <div className="flex flex-wrap items-end gap-2 px-3 pb-2"><label className="min-w-0 flex-1 text-xs text-muted-foreground">Origem<select className="mini-select mt-1 w-full" value={origin} onChange={(event) => { setOrigin(event.target.value); setRouteMessage('') }}><option>Vila Nova</option><option>Centro</option><option>Jardim das Flores</option></select></label><label className="min-w-0 flex-1 text-xs text-muted-foreground">Destino (ilustrativo)<select className="mini-select mt-1 w-full" value={destination} onChange={(event) => { setDestination(event.target.value); setRouteMessage('') }}>{visualDemo.sheltersList.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><button type="button" className="rounded bg-primary px-3 py-2 text-xs font-medium text-white" onClick={() => setRouteMessage(`Prévia de ${origin} para ${destination}. Traçado fixo ilustrativo; não calculado nem validado para evacuação.`)}>Ver prévia do traçado</button></div>
      {routeMessage && <p role="status" className="px-3 pb-2 text-xs text-muted-foreground">{routeMessage}</p>}
      <div className="mx-2 h-[172px] overflow-hidden rounded-md"><MapArtwork alerts={alerts} route={tab === 'Traçado ilustrativo'} /></div><p className="px-3 py-2 text-xs text-muted-foreground">Traçados fictícios · nenhuma rota foi validada para uso real.</p>
    </>}
  </section>
}
