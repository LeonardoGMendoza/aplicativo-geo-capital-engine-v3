import { useRef, useState } from 'react'
import { BellRing, BrainCircuit, Building2, Clock3, FlaskConical, HeartHandshake, House, ShieldCheck, TriangleAlert, Users, FileText, MessageSquare, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RiskBadge } from '@/components/shared/RiskBadge'
import { MetricCard } from './components/MetricCard'
import { MapPlaceholder } from './components/MapPlaceholder'
import { PanelHeading } from './components/PanelHeading'
import { MonitoringPanel } from './components/MonitoringPanel'
import { AlertCenter } from './components/AlertCenter'
import { EvacuationPanel } from './components/EvacuationPanel'
import { ShelterList } from './components/ShelterList'
import { DEFAULT_ALERT_ID, demoIndicators, demoSnapshot, formatSnapshotTime, getDemoAlert, priorityAlerts, recommendationTitle } from './data/demo'
import { visualDemo } from './data/visual-demo'
import type { DemoAlert } from '@/types/operations'
import { NasaSummary } from '@/features/nasa/NasaSummary'

type Preview = { title: string; body: string; alert?: DemoAlert }

export function OperationsPage() {
  const [selectedId, setSelectedId] = useState(DEFAULT_ALERT_ID)
  const [preview, setPreview] = useState<Preview | null>(null)
  const previewTrigger = useRef<HTMLElement | null>(null)
  const alert = getDemoAlert(selectedId)
  function openPreview(title: string, body: string, detail?: DemoAlert) {
    previewTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPreview({ title, body, alert: detail })
  }
  function openAlert(item: DemoAlert) {
    setSelectedId(getDemoAlert(item.id).id)
    openPreview('Detalhes do alerta simulado', item.description, item)
  }

  return <>
    <header className="dashboard-heading"><div><h1 className="text-2xl font-semibold text-white">Situação atual</h1><p className="mt-1 text-sm text-[#b5d2e2]">Centro de Operações · cenário demonstrativo</p></div><span className="rounded border border-[#25617c] px-3 py-2 text-xs text-[#b5d2e2]">Referência fixa · {formatSnapshotTime(demoSnapshot.timestamp)}</span></header>
    <NasaSummary />
    <div className="demo-strip" role="note"><span className="flex items-center gap-2"><FlaskConical className="size-3.5 shrink-0" /><strong>Cenário abaixo · SIMULAÇÃO</strong><span className="hidden sm:inline">Indicadores e alertas ilustrativos, independentes da consulta NASA.</span></span><span className="flex items-center gap-1"><Clock3 className="size-3" />Referência fixa: {formatSnapshotTime(demoSnapshot.timestamp)}</span><span className="sm:hidden">Dados e imagens abaixo são ilustrativos. Nenhuma ação real.</span></div>

    <div className="overview-layout">
      <div className="min-w-0">
        <section aria-label="Indicadores resumidos, todos fictícios" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <MetricCard title="Alertas críticos" value={visualDemo.criticalAreas} note="Risco fictício · simulação" icon={TriangleAlert} tone="red" />
          <MetricCard title="Alertas em atenção" value={visualDemo.attentionAreas} note="Alto ou atenção · simulação" icon={BellRing} tone="orange" />
          <MetricCard title="Abrigos no cenário" value={visualDemo.shelters} note="Sem disponibilidade real" icon={House} tone="blue" />
          <MetricCard title="Pessoas no cenário" value={visualDemo.people} note="População total fictícia" icon={Users} tone="green" />
        </section>
        <div className="primary-layout">
          <MapPlaceholder alerts={demoSnapshot.alerts} selectedId={selectedId} onSelect={setSelectedId} onDetails={() => openAlert(alert)} />
          <div className="flex min-w-0 flex-col gap-2">
            <section className="light-panel shrink-0" aria-label="Ações prioritárias simuladas">
              <PanelHeading title="Ações Prioritárias"><button type="button" className="text-link" onClick={() => openPreview('Resumo demonstrativo do cenário', `${priorityAlerts.length} de ${demoIndicators.totalAlerts} alertas prioritários fictícios e ${demoSnapshot.assets} ativos no cadastro demonstrativo. Nenhuma operação executada.`)}>Ver todas ({priorityAlerts.length})</button></PanelHeading>
              <div className="space-y-1 px-2 pb-2">{priorityAlerts.map((item) => <div key={item.id} className="rounded-md border border-transparent p-2" style={{ background: selectedId === item.id ? '#ecf4fb' : '#f7fafc', borderColor: selectedId === item.id ? '#aed3ef' : 'transparent' }}><div className="flex items-start gap-2"><span className="flex size-7 shrink-0 items-center justify-center rounded-full" style={{ background: item.risk === 'critical' ? '#ffe6ed' : '#fff1d7', color: item.risk === 'critical' ? '#ed2450' : '#df8c12' }}><TriangleAlert className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold leading-tight">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.location}</p></div><span className="text-xs text-muted-foreground">{item.displayTime}</span></div><div className="mt-1 flex items-center justify-between pl-9"><span className="text-xs text-muted-foreground">Alerta e horário fictícios</span><button type="button" className="rounded bg-[#e4f0fb] px-2 py-1 text-xs font-medium text-[#075fb3]" onClick={() => openAlert(item)}>Ver detalhes</button></div></div>)}</div>
            </section>
            <section className="light-panel flex-1" aria-label="Orientações demonstrativas"><PanelHeading title="Orientações do cenário" /><div className="space-y-2 px-3 pb-3">{priorityAlerts.map((item) => <button type="button" className="flex w-full items-start gap-2 text-left" key={item.id} onClick={() => { setSelectedId(item.id); openPreview('Recomendação demonstrativa', item.recommendation, item) }}><TriangleAlert className="mt-0.5 size-4 shrink-0 text-risk-critical" /><div className="flex-1"><p className="text-xs font-semibold leading-snug">{recommendationTitle(item)}</p><p className="mt-1 text-xs leading-snug text-muted-foreground">Orientação local para revisão.</p></div><span className="rounded bg-rose-50 px-1.5 py-1 text-xs text-rose-700">Revisar</span></button>)}<p className="border-t pt-2 text-xs text-muted-foreground">Conteúdo local, sem consulta a um modelo de IA.</p></div></section>
          </div>
        </div>
      </div>
    </div>

    <div className="middle-layout"><AlertCenter alerts={demoSnapshot.alerts} onSelect={openAlert} /><EvacuationPanel alerts={demoSnapshot.alerts} onPreview={openPreview} /><ShelterList onPreview={openPreview} /></div>

    <div className="bottom-layout">
      <section className="light-panel" aria-label="Visão corporativa demonstrativa"><PanelHeading title="Visão Corporativa (B2B)" subtitle={`Escopo corporativo fictício · ${demoSnapshot.assets} ativos de referência`} icon={Building2}><button type="button" className="text-link" onClick={() => openPreview('Visão corporativa demonstrativa', `O MVP possui ${demoSnapshot.assets} ativos ilustrativos. Este resumo visual não calcula perdas ou exposição financeira. O motor Python original permanece preservado.`)}>Ver análise</button></PanelHeading><div className="grid grid-cols-2 gap-3 px-3 pb-3 sm:grid-cols-4">{[{ value: demoIndicators.corporate.assetsAtRisk, text: 'Ativos em risco', color: '#cf2442', bg: '#fff0f3' }, { value: demoIndicators.corporate.affectedOperations, text: 'Operação afetada', color: '#ba7909', bg: '#fff7e8' }, { value: demoIndicators.corporate.interruptions, text: 'Interrupções', color: '#056cd7', bg: '#edf5ff' }, { value: demoIndicators.corporate.recommendations, text: 'Recomendações', color: '#087f65', bg: '#e9f9f2' }].map((item) => <div key={item.text} className="rounded px-2 py-2" style={{ background: item.bg, color: item.color }}><p className="text-xl font-bold">{item.value}</p><p className="mt-1 text-xs leading-tight">{item.text}</p><p className="mt-1 text-xs">Fictício</p></div>)}</div></section>
      <section className="light-panel" aria-label="Indicadores ilustrativos de impacto social"><PanelHeading title="Impacto Social (ESG)" subtitle="Mesmo cenário dos indicadores superiores · simulação" icon={HeartHandshake} /><div className="grid grid-cols-2 gap-3 px-3 pb-3 sm:grid-cols-4">{[{ value: visualDemo.people, text: 'Pessoas no cenário', color: '#cf2442', bg: '#fff0f3' }, { value: demoSnapshot.communities, text: 'Comunidades', color: '#ba7909', bg: '#fff7e8' }, { value: demoIndicators.shelters, text: 'Abrigos no cenário', color: '#056cd7', bg: '#edf5ff' }, { value: demoIndicators.realActions, text: 'Ações reais', color: '#087f65', bg: '#e9f9f2' }].map((item) => <div key={item.text} className="rounded px-2 py-2" style={{ background: item.bg, color: item.color }}><p className="text-lg font-bold">{item.value}</p><p className="mt-1 text-xs leading-tight">{item.text}</p><p className="mt-1 text-xs">{item.text === 'Ações reais' ? 'Nenhum envio' : 'Ilustrativo'}</p></div>)}</div></section>
      <section className="light-panel" aria-label="Inteligência e ações rápidas locais"><PanelHeading title="Orientação e revisão humana" subtitle="Apoio à decisão humana · exemplo local" icon={BrainCircuit} /><div className="px-3 pb-3"><p className="flex items-center gap-2 text-[12px] font-bold text-[#0866d0]"><ShieldCheck className="size-6 shrink-0" />Revise o contexto antes de decidir.</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{alert.recommendation}</p><p className="mt-1 text-xs text-muted-foreground">Contexto selecionado: {alert.title} · {alert.location}</p><div className="mt-3 flex flex-wrap gap-1.5"><button type="button" className="mini-select flex items-center gap-1" onClick={() => openPreview('Prévia demonstrativa de aviso', `[SIMULAÇÃO] ${alert.location}: ${alert.recommendation} Consulte canais oficiais.`, alert)}><MessageSquare className="size-3" />Prévia de aviso</button><button type="button" className="mini-select flex items-center gap-1" onClick={() => openPreview('Prévia de orientação local', alert.recommendation, alert)}><Workflow className="size-3" />Revisar orientação</button><button type="button" className="mini-select flex items-center gap-1" onClick={() => openPreview('Resumo demonstrativo do cenário', `${demoSnapshot.assets} ativos ilustrativos; ${priorityAlerts.length} de ${demoIndicators.totalAlerts} alertas prioritários fictícios. Referência fixa ${formatSnapshotTime(demoSnapshot.timestamp)}.`)}><FileText className="size-3" />Ver resumo</button></div></div></section>
    </div>

    <section className="complementary-section" aria-label="Informações complementares ilustrativas"><h2 className="mb-3 text-lg font-semibold text-white">Informações complementares</h2><MonitoringPanel onPreview={openPreview} /></section>

    <Dialog open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null) }}><DialogContent className="max-h-[85dvh] overflow-y-auto text-foreground" onCloseAutoFocus={(event) => { event.preventDefault(); previewTrigger.current?.focus() }}><DialogHeader><DialogTitle>{preview?.title}</DialogTitle><DialogDescription>Prévia local com conteúdo ilustrativo. Nenhum dado ou serviço externo consultado.</DialogDescription></DialogHeader><Badge variant="outline" className="w-fit border-violet-200 bg-violet-50 text-violet-800">SIMULAÇÃO · PRÉVIA LOCAL</Badge>{preview?.alert && <div className="flex flex-wrap items-center justify-between gap-2 rounded border bg-secondary p-3"><div><p className="text-sm font-semibold">{preview.alert.title}</p><p className="mt-1 text-xs text-muted-foreground">{preview.alert.location}</p></div><RiskBadge level={preview.alert.risk} /></div>}<p className="text-sm leading-relaxed">{preview?.body}</p><p className="text-xs leading-relaxed text-muted-foreground">Nenhuma operação foi executada. Esta prévia não envia mensagens, registra decisões nem aciona serviços externos.</p><DialogFooter><DialogClose asChild><Button>Fechar prévia</Button></DialogClose></DialogFooter></DialogContent></Dialog>
  </>
}
