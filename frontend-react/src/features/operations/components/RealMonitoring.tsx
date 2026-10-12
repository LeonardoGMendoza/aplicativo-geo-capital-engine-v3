import { useEffect, useState } from 'react'
import { CloudRain, Droplets, ExternalLink, Satellite, Thermometer, Wind } from 'lucide-react'
import { buscarAgora, descreverTempo, diaAtras, ladrilho, preencherLadrilho, urlSatelite, urlWorldview } from '../data/complementares'
import type { Agora, Coordenadas } from '../data/complementares'
import { nivelCalor, nivelChuva, picoChuva, picoMaxima } from '@/features/climate/climate'
import type { Nivel, Previsao } from '@/features/climate/climate'
import { FiltroMapaFelipe } from '@/features/climate/mapaFelipe'

const COR: Record<Nivel, string> = { alto: '#ff5971', atencao: '#f5a016', normal: '#2ee59d' }
const pior = (a: Nivel, b: Nivel): Nivel => (a === 'alto' || b === 'alto' ? 'alto' : a === 'atencao' || b === 'atencao' ? 'atencao' : 'normal')
const dataBR = (d: string) => d.split('-').reverse().join('/')
const fmt = (v: number | null, un: string, casas = 0) => (v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: casas })} ${un}`)

/** Gráfico simples: barras de chuva (mm) e linha de temperatura (°C) nas próximas 24 h. */
function Grafico24h({ horas }: { horas: Agora['horas'] }) {
  if (!horas.length) return <p className="text-xs text-[#9cc3d7]">Sem previsão horária agora.</p>
  const W = 480, H = 120, base = 100, larg = W / horas.length
  const chuvas = horas.map(h => h.chuva ?? 0), temps = horas.map(h => h.temperatura).filter((t): t is number => t !== null)
  const maxChuva = Math.max(5, ...chuvas), tMin = Math.min(...temps), tMax = Math.max(...temps), faixa = Math.max(1, tMax - tMin)
  const pontos = horas.map((h, i) => h.temperatura === null ? null : `${(i + 0.5) * larg},${base - 10 - ((h.temperatura - tMin) / faixa) * 70}`).filter(Boolean).join(' ')
  return <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={`Próximas 24 horas: chuva até ${Math.max(...chuvas).toLocaleString('pt-BR')} mm por hora, temperatura de ${Math.round(tMin)} a ${Math.round(tMax)} °C`}>
    {horas.map((h, i) => { const alt = ((h.chuva ?? 0) / maxChuva) * 80
      return <rect key={i} x={i * larg + 2} y={base - alt} width={larg - 4} height={alt} rx="2" fill="#23cde5" opacity="0.8"><title>{`${h.hora}: ${fmt(h.chuva, 'mm', 1)}, ${fmt(h.temperatura, '°C')}`}</title></rect> })}
    <polyline points={pontos} fill="none" stroke="#f5a016" strokeWidth="2.5" strokeLinejoin="round" />
    <line x1="0" x2={W} y1={base} y2={base} stroke="#3d7896" />
    {horas.map((h, i) => i % 6 === 0 && <text key={i} x={(i + 0.5) * larg} y={H - 4} textAnchor="middle" fontSize="11" fill="#9cc3d7">{h.hora}</text>)}
    <text x={W - 4} y="12" textAnchor="end" fontSize="11" fill="#f5a016">{`${Math.round(tMin)}–${Math.round(tMax)} °C`}</text>
  </svg>
}

/**
 * Linha "Informações complementares" do Centro de Operações com dados reais, no mesmo desenho da demonstração:
 * satélite de hoje (NASA), condições agora, cidades monitoradas, próximas 24 h e radar de chuva.
 */
export function RealMonitoring({ cidade, previsoes, radarUrl }: { cidade: { nome: string; coordenadas: Coordenadas }; previsoes: Previsao[] | null; radarUrl: string | null }) {
  const [agora, setAgora] = useState<Agora | null>(null)
  const [erroAgora, setErroAgora] = useState(false)
  const [diasAtras, setDiasAtras] = useState(1)
  const dataSat = diaAtras(diasAtras)
  const c = cidade.coordenadas

  useEffect(() => {
    const abort = new AbortController()
    setAgora(null); setErroAgora(false); setDiasAtras(1)
    buscarAgora(c, { signal: abort.signal }).then(a => !abort.signal.aborted && setAgora(a)).catch(() => !abort.signal.aborted && setErroAgora(true))
    return () => abort.abort()
  }, [c.latitude, c.longitude])

  const cidades = (previsoes ?? []).map(p => {
    const nivel = pior(nivelCalor(picoMaxima(p)), nivelChuva(picoChuva(p)))
    return { nome: `${p.cidade.nome}/${p.cidade.uf}`, nivel, maxima: picoMaxima(p), chuva: picoChuva(p), coord: { latitude: p.cidade.latitude, longitude: p.cidade.longitude } }
  })
  const chuvosas = [...cidades].sort((a, b) => (b.chuva ?? 0) - (a.chuva ?? 0)).slice(0, 3)
  const Z = 7

  return <div className="monitoring-layout">
    <section className="dark-panel relative min-h-[280px] overflow-hidden" aria-label="Satélite de hoje">
      <img src={urlSatelite(c, dataSat)} alt={`Imagem de satélite da NASA sobre ${cidade.nome} em ${dataBR(dataSat)}`} className="absolute inset-0 size-full object-cover" onError={() => setDiasAtras(d => (d < 4 ? d + 1 : d))} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#00172cf5] via-[#001e3530] to-[#00395e40]" />
      <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#ff5971]" aria-hidden="true" />
      <div className="relative flex items-center justify-between gap-2 p-3 text-xs"><span className="rounded bg-[#0c5b7be6] px-2 py-1">SATÉLITE · NASA</span><span className="rounded border border-[#6ed2e8] bg-[#032b40] px-2 py-1 text-[#8ee8ed]">IMAGEM DE {dataBR(dataSat)}</span></div>
      <div className="absolute bottom-4 left-4 right-4"><h2 className="max-w-64 text-base font-bold leading-tight tracking-tight">{cidade.nome} vista do espaço</h2><p className="mt-2 text-xs">Imagem real (MODIS/Terra, cor verdadeira). Nuvens brancas; rios e áreas alagadas aparecem escuros.</p>
        <a className="mt-3 inline-flex items-center gap-1 rounded bg-[#0d5072] px-2 py-1 text-xs" href={urlWorldview(c, dataSat)} target="_blank" rel="noopener noreferrer"><Satellite className="size-3" />Abrir no NASA Worldview<ExternalLink className="size-3" /></a></div>
    </section>
    <div className="space-y-2">
      <div className="grid grid-cols-[1.7fr_1fr] gap-2">
        <section className="dark-panel p-3"><h2 className="mb-3 text-xs font-semibold">Condições agora · {cidade.nome}</h2>
          {agora ? <div className="flex flex-wrap justify-between gap-2 text-xs">
            <span><Thermometer className="mb-1 size-5 text-[#f5a016]" />{fmt(agora.temperatura, '°C')}</span>
            <span><CloudRain className="mb-1 size-5 text-[#23cde5]" />{fmt(agora.chuva, 'mm', 1)}</span>
            <span><Wind className="mb-1 size-5 text-white" />{fmt(agora.vento, 'km/h')}</span>
            <span><Droplets className="mb-1 size-5 text-[#7fd3ff]" />{fmt(agora.umidade, '%')}</span>
          </div> : <p role="status" className="text-xs">{erroAgora ? 'Tempo agora indisponível.' : 'Consultando…'}</p>}
          <p className="mt-2 text-xs text-[#9cc3d7]">{agora ? `${descreverTempo(agora.codigo)} · ` : ''}Medição/modelo Open-Meteo, atualizado agora</p></section>
        <section className="dark-panel p-3"><h2 className="mb-2 text-xs font-semibold">Cidades monitoradas</h2>
          {cidades.length ? <ul className="space-y-1 text-xs text-[#cee5ef]">{cidades.map(x => <li key={x.nome} className="flex items-center gap-1.5" title={`Máx. ${fmt(x.maxima, '°C')} · chuva ${fmt(x.chuva, 'mm')} (3 dias)`}><span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: COR[x.nivel] }} />{x.nome}</li>)}</ul>
            : <p className="text-xs text-[#9cc3d7]">Consultando…</p>}</section>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr]">
        <section className="dark-panel min-w-0 p-3"><h2 className="text-xs font-semibold">Próximas 24 h <span className="font-normal">({cidade.nome})</span></h2><p className="mt-1 text-xs text-[#9cc3d7]">Barras: chuva (mm/h) · linha: temperatura · previsão real</p>
          <div className="mt-2 h-[120px] min-w-0">{agora ? <Grafico24h horas={agora.horas} /> : <p className="text-xs">{erroAgora ? 'Previsão indisponível.' : 'Carregando…'}</p>}</div></section>
        <section className="dark-panel p-3"><div className="mb-3 flex justify-between gap-2"><h2 className="text-xs font-semibold">Radar de chuva agora</h2><span className="text-xs text-[#2ee59d]">● Real</span></div>
          <FiltroMapaFelipe />
          <div className="grid grid-cols-3 gap-2">{chuvosas.map(x => { const t = ladrilho(x.coord, Z)
            return <div key={x.nome} className="min-w-0">
              <div className="relative h-16 overflow-hidden rounded bg-[#1c372d]">
                <img src={preencherLadrilho('https://tile.openstreetmap.org/{z}/{x}/{y}.png', Z, t.x, t.y)} alt="" className="mapa-felipe absolute left-1/2 top-1/2 w-[256px] max-w-none" style={{ transform: `translate(-${t.px * 256}px, -${t.py * 256}px)` }} />
                {radarUrl && <img src={preencherLadrilho(radarUrl, Z, t.x, t.y)} alt="" className="absolute left-1/2 top-1/2 w-[256px] max-w-none opacity-90" style={{ transform: `translate(-${t.px * 256}px, -${t.py * 256}px)` }} />}
                <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[#ff5971]" aria-hidden="true" />
              </div>
              <p className="mt-2 truncate text-xs font-semibold">{x.nome}</p><p className="mt-1 text-xs" style={{ color: COR[x.nivel] }}>● {fmt(x.chuva, 'mm')} em 3 dias</p></div> })}
            {!chuvosas.length && <p className="col-span-3 text-xs text-[#9cc3d7]">Consultando…</p>}</div>
          <p className="mt-2 text-xs text-[#9cc3d7]">Radar RainViewer · mapa © OpenStreetMap</p></section>
      </div>
    </div>
  </div>
}
