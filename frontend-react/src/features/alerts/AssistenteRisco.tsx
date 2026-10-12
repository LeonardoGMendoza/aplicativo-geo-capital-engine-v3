import { useEffect, useState } from 'react'
import { Bot } from 'lucide-react'
import type { ProximityResult } from '@/features/nasa/proximity'
import { formatObservation } from '@/features/nasa/geography'
import { AlertActions } from './AlertActions'
import { useAlertasAtivos } from './useAlertasAtivos'

type Perfil = 'empresa' | 'comunidade'

/** Rótulo do alerta na lista, como no painel Streamlit: "Evento → Ativo (km)" ou "Evento → Comunidade (km)". */
export function rotuloAlerta(m: ProximityResult['matches'][number], perfil: Perfil) {
  const alvo = perfil === 'empresa' ? m.asset.name : `${m.asset.communityDescription || m.asset.name}`
  return `${m.event.title} → ${alvo} (${Math.round(m.distanceKm)} km)`
}

/**
 * Assistente no topo da Visão Corporativa e do Impacto Social, igual ao do Streamlit:
 * consulta sozinho os 11 ativos de referência, lista os alertas (evento NASA → ativo/comunidade, do mais perto ao mais longe)
 * e, para o alerta escolhido, mostra a IA (Oracle) e o envio por WhatsApp.
 */
export function AssistenteRisco({ perfil }: { perfil: Perfil }) {
  const { catalogo, resultado, carregando, erro, alertas, totalEventos } = useAlertasAtivos()
  const [escolhido, setEscolhido] = useState(0)
  useEffect(() => { setEscolhido(0) }, [resultado])
  const atual = alertas[Math.min(escolhido, alertas.length - 1)]
  const titulo = perfil === 'empresa' ? 'Assistente de Risco Operacional' : 'Assistente Humanitário (RAG)'

  return <section className="light-panel space-y-3 p-4" aria-labelledby={`assistente-${perfil}`}>
    <h2 id={`assistente-${perfil}`} className="flex items-center gap-2 text-base font-semibold"><Bot className="size-5 text-primary" aria-hidden="true" />{titulo}</h2>
    {(carregando || (!resultado && !erro)) && <p role="status" className="text-sm">Cruzando os eventos da NASA com {catalogo ? `os ${catalogo.assets.length} ativos de referência` : 'os ativos de referência'}…</p>}
    {erro && <p role="alert" className="text-sm text-amber-900">{erro}</p>}
    {resultado && !carregando && <>
      <p className="text-sm">{alertas.length ? <><b>{alertas.length} ativo(s)</b> com evento NASA a menos de 600 km</> : 'Nenhum ativo com evento NASA a menos de 600 km agora'} (de {totalEventos?.toLocaleString('pt-BR') ?? '—'} eventos abertos no planeta). Isso não confirma risco: a decisão é humana.</p>
      {alertas.length > 0 && <label className="block text-sm font-semibold">Alerta exibido
        <select className="mini-select mt-1 w-full text-sm" value={Math.min(escolhido, alertas.length - 1)} onChange={e => setEscolhido(Number(e.target.value))}>
          {alertas.map((m, i) => <option key={`${m.asset.id}-${m.event.id}`} value={i}>{rotuloAlerta(m, perfil)}</option>)}
        </select>
      </label>}
      {atual && <>
        <p className="text-xs text-muted-foreground">{atual.event.categories.map(c => c.title).join(', ') || 'Evento'} · {perfil === 'empresa' ? `comunidade vizinha: ${atual.asset.communityDescription || 'não informada'}` : `ativo associado: ${atual.asset.name}`} · última observação NASA: {formatObservation(atual.event.observedAt)}</p>
        <AlertActions key={`${atual.asset.id}-${atual.event.id}`} perfil={perfil} ativo={atual.asset.name} comunidade={atual.asset.communityDescription} evento={atual.event.title}
          categoria={atual.event.categories.map(c => c.title).join(', ')} km={atual.distanceKm} observadoEm={atual.event.observedAt} />
      </>}
    </>}
  </section>
}
