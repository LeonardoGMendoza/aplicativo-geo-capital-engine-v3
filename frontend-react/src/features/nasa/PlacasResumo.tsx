import type { PlacasDados } from './placas'
import { corDoSismo, haQuanto, lugarPt, magnitudePt, naCostaDasAmericas } from './placas'

/** Lista dos terremotos reais da semana na costa do Pacífico e do Caribe das Américas (do Alasca ao Chile). */
export function PlacasResumo({ dados }: { dados: PlacasDados }) {
  const americas = dados.sismos.filter(naCostaDasAmericas).sort((a, b) => b.magnitude - a.magnitude)
  const tsunami = americas.filter(s => s.tsunamiSignal).length
  return <section className="light-panel space-y-2 p-3" aria-label="Terremotos da semana na costa do Pacífico das Américas">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold">Costa do Pacífico das Américas · terremotos dos últimos 7 dias</h3>
      <span className="text-xs text-muted-foreground">Fonte: USGS · magnitude 4,5 ou mais · dados reais</span>
    </div>
    {dados.erroSismos ? <p role="status" className="text-sm">Terremotos indisponíveis agora (USGS). Isso não indica ausência de risco.</p>
      : <>
        <p className="text-sm"><b>{americas.length}</b> terremoto(s) do Alasca ao Chile{tsunami ? <> · <b className="text-[#1d5fd6]">{tsunami} com sinal de tsunami</b></> : ''}</p>
        {americas.length > 0 && <ul className="space-y-1">
          {americas.slice(0, 6).map(s => <li key={s.id ?? s.observedAt} className="flex items-start gap-2 text-xs">
            <span className="placa-mag" style={{ background: corDoSismo(s.magnitude) }}>{magnitudePt(s.magnitude)}</span>
            <span className="min-w-0"><span className="block font-semibold">{lugarPt(s.place)}</span><span className="text-muted-foreground">{haQuanto(s.observedAt)}{s.tsunamiSignal ? ' · sinal de tsunami (não confirma tsunami)' : ''}</span></span>
          </li>)}
        </ul>}
      </>}
    <p className="text-xs text-muted-foreground">Mostra o que já aconteceu; não é previsão de novos terremotos. Em caso de tremor forte perto do mar, vá para um lugar alto sem esperar alerta e siga a Defesa Civil local.</p>
  </section>
}
