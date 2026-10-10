import { useState } from 'react'
import { BellRing, Search } from 'lucide-react'
import { PanelHeading } from './PanelHeading'
import { RiskBadge } from '@/components/shared/RiskBadge'
import type { DemoAlert } from '@/types/operations'

export function AlertCenter({ alerts, onSelect }: { alerts: DemoAlert[]; onSelect: (alert: DemoAlert) => void }) {
  const [tab, setTab] = useState('Alertas ativos')
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState('all')
  const filtered = alerts.filter((item) => (risk === 'all' || item.risk === risk) && `${item.title} ${item.location}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
  return <section className="light-panel" id="central-alertas" tabIndex={-1} aria-label="Central de alertas simulados">
    <PanelHeading title="Central de Alertas" subtitle={`${alerts.length} alertas fictícios no cenário; ${alerts.filter(item => item.isPriority).length} prioritários.`} icon={BellRing}><span className="rounded bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800">Simulação ativa</span></PanelHeading>
    <div className="compact-tabs">{['Alertas ativos', 'Histórico', 'Previsões', 'Simulações'].map((item) => <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}</div>
    {tab === 'Alertas ativos' || tab === 'Simulações' ? <>
      <div className="flex flex-wrap gap-2 px-3 pb-2"><select aria-label="Filtrar por risco" value={risk} onChange={(event) => setRisk(event.target.value)} className="mini-select"><option value="all">Todos os status</option><option value="critical">Crítico</option><option value="high">Alto</option><option value="attention">Atenção</option></select><label className="flex min-w-0 flex-1 items-center gap-1 rounded border px-2"><Search className="size-3 text-muted-foreground" /><input aria-label="Buscar alerta na central" placeholder="Buscar alerta…" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 w-full py-1.5 text-xs outline-none" /></label></div>
      <div className="overflow-x-auto px-2 pb-2"><table className="data-table"><caption className="sr-only">Alertas fictícios do cenário, sem dados reais</caption><thead><tr><th>Tipo</th><th>Região</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td className="max-w-44 font-medium">{item.title}</td><td>{item.location.split(' · ')[0]}</td><td><RiskBadge level={item.risk} /></td><td><button type="button" className="rounded border bg-white px-2 py-0.5 text-xs" onClick={() => onSelect(item)} aria-label={`Ver detalhes simulados: ${item.title}`}>Ver</button></td></tr>)}</tbody></table>{filtered.length === 0 && <p role="status" className="p-5 text-center text-xs text-muted-foreground">Nenhum exemplo corresponde aos filtros.</p>}</div>
    </> : <div className="flex min-h-52 items-center justify-center p-6 text-center"><p className="max-w-80 text-xs leading-relaxed text-muted-foreground">{tab === 'Histórico' ? 'Histórico reservado. Esta interface não registra decisões ou eventos reais.' : 'Previsões reservadas. A série do nível do rio é apenas um exemplo visual, sem dados meteorológicos.'}</p></div>}
  </section>
}
