import { useMemo } from 'react'
import type { PlacasDados, Periodo } from './placas'
import { corDoSismo, ehMes, haQuanto, lugarPt, magnitudePt, mesesAnteriores, naCostaDasAmericas, nomeMes, nomePeriodo } from './placas'

const AO_VIVO: [Periodo, string][] = [['dia', 'Agora · 24 h'], ['semana', '7 dias'], ['mes', '30 dias']]

/** Terremotos reais na costa do Pacífico e do Caribe das Américas (do Alasca ao Chile): agora, 7 dias, 30 dias ou um mês anterior. */
export function PlacasResumo({ dados, periodo, onPeriodo, carregando }: { dados: PlacasDados; periodo: Periodo; onPeriodo: (p: Periodo) => void; carregando: boolean }) {
  const meses = useMemo(() => mesesAnteriores(), [])
  const historico = ehMes(periodo)
  const americas = dados.sismos.filter(naCostaDasAmericas).sort((a, b) => b.magnitude - a.magnitude)
  const tsunami = americas.filter(s => s.tsunamiSignal).length
  return <section className="light-panel space-y-2 p-3" aria-label="Terremotos na costa do Pacífico das Américas">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold">Costa do Pacífico das Américas · terremotos {nomePeriodo(periodo)}</h3>
      <span className="text-xs text-muted-foreground">Fonte: USGS · magnitude 4,5 ou mais · dados reais</span>
    </div>
    <div className="placa-periodos" role="group" aria-label="Período dos terremotos">
      {AO_VIVO.map(([p, t]) => <button type="button" key={p} aria-pressed={periodo === p} onClick={() => onPeriodo(p)}>{t}</button>)}
    </div>
    <details className="placa-historico" open={historico}>
      <summary>Meses anteriores{historico ? ` · ${nomeMes(periodo)}` : ''}</summary>
      <div className="placa-meses" role="group" aria-label="Escolha um mês">
        {meses.map(m => <button type="button" key={m.valor} aria-pressed={periodo === m.valor} onClick={() => onPeriodo(m.valor)}>{m.nome}</button>)}
      </div>
    </details>
    {carregando ? <p role="status" className="text-sm">Carregando terremotos {nomePeriodo(periodo)}…</p>
      : dados.erroSismos ? <p role="status" className="text-sm">Terremotos indisponíveis agora (USGS). Isso não indica ausência de risco.</p>
      : <>
        <p className="text-sm"><b>{americas.length}</b> terremoto(s) do Alasca ao Chile · {dados.sismos.length} no mundo{tsunami ? <> · <b className="text-[#1d5fd6]">{tsunami} com sinal de tsunami</b></> : ''}</p>
        {americas.length === 0 && periodo === 'dia' && <p className="placa-vazio">Nenhum terremoto de magnitude 4,5 ou mais nas Américas nas últimas 24 horas. <button type="button" onClick={() => onPeriodo('mes')}>Ver os últimos 30 dias</button></p>}
        {americas.length > 0 && <ul className="space-y-1">
          {americas.slice(0, 8).map(s => <li key={s.id ?? s.observedAt} className="flex items-start gap-2 text-xs">
            <span className="placa-mag" style={{ background: corDoSismo(s.magnitude) }}>{magnitudePt(s.magnitude)}</span>
            <span className="min-w-0"><span className="block font-semibold">{lugarPt(s.place)}</span><span className="text-muted-foreground">{haQuanto(s.observedAt)}{s.tsunamiSignal ? ' · sinal de tsunami (não confirma tsunami)' : ''}</span></span>
          </li>)}
        </ul>}
        {americas.length > 8 && <p className="text-xs text-muted-foreground">Mostrando os 8 mais fortes. Todos aparecem no mapa.</p>}
      </>}
    <p className="text-xs text-muted-foreground">Mostra o que já aconteceu; não é previsão de novos terremotos. Em caso de tremor forte perto do mar, vá para um lugar alto sem esperar alerta e siga a Defesa Civil local.</p>
  </section>
}
