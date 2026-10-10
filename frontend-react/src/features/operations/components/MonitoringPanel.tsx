import { lazy, Suspense } from 'react'
import { CloudRain, TriangleAlert, Wind, Camera, Expand, Waves } from 'lucide-react'
import { ReferenceScene } from '@/components/shared/ReferenceScene'
import { demoWater } from '../data/demo'
import { visualDemo } from '../data/visual-demo'

const WaterTimeline = lazy(() => import('./WaterTimeline'))
export function MonitoringPanel({ onPreview }: { onPreview: (title: string, body: string) => void }) {
  return <div className="monitoring-layout">
    <section className="dark-panel relative min-h-[280px] overflow-hidden" aria-label="Câmera ilustrativa">
      <ReferenceScene className="absolute inset-0 size-full" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#00172cf5] via-[#001e3540] to-[#00395e50]" />
      <div className="relative flex items-center justify-between gap-2 p-3 text-xs"><span className="rounded bg-[#0c5b7be6] px-2 py-1">CÂMERA 01 · CENÁRIO FICTÍCIO</span><span className="rounded border border-[#6ed2e8] bg-[#032b40] px-2 py-1 text-[#8ee8ed]">IMAGEM ESTÁTICA</span></div>
      <div className="absolute right-3 top-14 flex items-end gap-2"><div className="h-28 w-5 overflow-hidden border border-[#60daf6] bg-[#072f43]"><div className="mt-auto h-[88%] translate-y-4 bg-gradient-to-t from-[#0890dc] to-[#53d7f4]" /></div><div className="text-xs"><Waves className="mb-2 size-4" /><p>{demoWater.location} · Agora</p><p className="text-lg font-bold">{visualDemo.waterLevel.toLocaleString('pt-BR')} m</p><p>Sem sensor conectado</p></div></div>
      <div className="absolute bottom-4 left-4 right-4"><h2 className="max-w-64 text-base font-bold leading-tight tracking-tight">Imagem de referência</h2><p className="mt-2 text-xs">Fotografia estática, sem câmera conectada.</p><button type="button" className="mt-3 flex items-center gap-1 rounded bg-[#0d5072] px-2 py-1 text-xs" onClick={() => onPreview('Imagem ilustrativa da câmera', 'Fotografia estática presente no mockup oficial. Não há drone, câmera, sensor ou transmissão conectada. O nível de água é fictício.')}><Expand className="size-3" />Sobre esta imagem</button></div>
    </section>
    <div className="space-y-2">
      <div className="grid grid-cols-[1.7fr_1fr] gap-2">
        <section className="dark-panel p-3"><h2 className="mb-3 text-xs font-semibold">Condições do cenário</h2><div className="flex flex-wrap justify-between gap-2 text-xs"><span><CloudRain className="mb-1 size-5 text-[#23cde5]" />Chuvas intensas</span><span><TriangleAlert className="mb-1 size-5 text-[#ff5971]" />Inundação</span><span><Wind className="mb-1 size-5 text-white" />Ventos fortes</span></div><p className="mt-2 text-xs text-[#9cc3d7]">Condições fictícias, sem consulta meteorológica</p></section>
        <section className="dark-panel p-3"><h2 className="mb-2 text-xs font-semibold">Regiões ilustrativas</h2><ul className="space-y-1.5 text-xs text-[#cee5ef]"><li>○ Sul do Brasil</li><li>○ Região Sudeste</li><li>○ Centro-Oeste</li></ul></section>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr]">
        <section className="dark-panel min-w-0 p-3"><h2 className="text-xs font-semibold">Linha do tempo <span className="font-normal">({demoWater.location})</span></h2><p className="mt-1 text-xs text-[#9cc3d7]">Série fictícia · não é previsão</p><div className="mt-2 h-[120px] min-w-0"><Suspense fallback={<p className="text-xs">Carregando gráfico local…</p>}><WaterTimeline /></Suspense></div></section>
        <section className="dark-panel p-3"><div className="mb-3 flex justify-between gap-2"><h2 className="text-xs font-semibold">Imagens de referência</h2><span className="text-xs text-[#a1d6e9]">Simulação</span></div><div className="grid grid-cols-3 gap-2">{visualDemo.cameras.map((name, index) => <button key={name} type="button" className="min-w-0 text-left" onClick={() => onPreview(name, 'Imagem estática ilustrativa reutilizada da referência oficial. Não existe transmissão nem vínculo com uma câmera real.')}><div className="relative h-16 overflow-hidden rounded"><ReferenceScene variant={(['bridge', 'river', 'district'] as const)[index]} className="size-full" /><Camera className="absolute right-1 top-1 size-3 text-white" /></div><p className="mt-2 text-xs font-semibold">{name}</p><p className="mt-1 text-xs text-[#f3cc8a]">● Ilustrativa</p></button>)}</div></section>
      </div>
    </div>
  </div>
}
