import { Link } from 'react-router-dom'
import { NasaEventsPanel } from './NasaEventsPanel'
import { useNasaSession } from './NasaSession'
import { MapArtwork } from '@/features/operations/components/MapArtwork'
import { demoSnapshot } from '@/features/operations/data/demo'
export function RiskMapPage() {
  const { mode } = useNasaSession()
  return <div className="space-y-3"><header className="flex flex-wrap items-center justify-between gap-2 text-white"><div><h1 className="text-2xl font-semibold">Mapa de Riscos</h1><p className="mt-1 text-xs text-[#b5d2e2]">Explorador geográfico · eventos catalogados não confirmam risco local.</p></div><Link className="rounded border border-[#25617c] px-3 py-2 text-xs hover:bg-white/10" to="/">Voltar ao Centro de Operações</Link></header><NasaEventsPanel />{mode === 'simulation' && <section className="light-panel space-y-2 p-3 text-xs" aria-label="Prévia do mapa ilustrativo, simulação"><h2 className="font-semibold">SIMULAÇÃO · desenho sem escala</h2><p>Regiões, alertas e abrigos fictícios. Não representam risco confirmado, disponibilidade de abrigo ou rotas seguras.</p><div className="h-[300px] overflow-hidden rounded sm:h-[340px]"><MapArtwork alerts={demoSnapshot.alerts} /></div></section>}</div>
}
