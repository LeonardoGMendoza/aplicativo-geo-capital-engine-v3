// Bloco extra no modal de um alerta do GDACS: mapa da área afetada, pontuação, países e população exposta,
// buscados pela nossa API. Se o GDACS falhar, o modal continua com as informações que já tinha.
import { lazy, Suspense, useEffect, useState } from 'react'
import { MapErrorBoundary } from '@/components/shared/MapErrorBoundary'
import { buscarDetalhesGdacs, idGdacs } from './gdacsDetalhes'
import type { DetalhesGdacs } from './gdacsDetalhes'
const GdacsMapa = lazy(() => import('./GdacsMapa'))

type Props = { itemId: string; centro?: [number, number] | null }
type Estado = { id: string; dados: DetalhesGdacs | null; erro: boolean }

const hora = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/** Só aparece para alertas do GDACS. Para os demais, devolve apenas o link da fonte (como antes). */
export function GdacsDetalhes({ itemId, centro = null }: Props) {
  const ehGdacs = idGdacs(itemId) !== null
  const [estado, setEstado] = useState<Estado>({ id: '', dados: null, erro: false })

  useEffect(() => {
    if (!ehGdacs) return
    const controle = new AbortController()
    buscarDetalhesGdacs(itemId, { signal: controle.signal })
      .then(dados => setEstado({ id: itemId, dados, erro: false }))
      .catch(() => { if (!controle.signal.aborted) setEstado({ id: itemId, dados: null, erro: true }) })
    return () => controle.abort()
  }, [itemId, ehGdacs])

  if (!ehGdacs) return null
  const atual = estado.id === itemId ? estado : { id: itemId, dados: null, erro: false }
  const d = atual.dados

  return (
    <div className="space-y-2 rounded border bg-white p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalhes do GDACS</p>
      {!d && !atual.erro && <p role="status" className="text-xs text-muted-foreground">Buscando detalhes no GDACS…</p>}
      {atual.erro && <p role="status" className="text-xs text-muted-foreground">Não foi possível buscar os detalhes do GDACS agora. As informações acima continuam válidas.</p>}
      {d && <>
        {d.area && <MapErrorBoundary message="Mapa da área afetada indisponível agora."><Suspense fallback={<p className="text-xs text-muted-foreground">Carregando mapa…</p>}>
          <GdacsMapa area={d.area} centro={centro} />
        </Suspense></MapErrorBoundary>}
        {d.area && <p className="text-xs text-muted-foreground">Vermelho, laranja e verde: áreas de alerta do GDACS. Linha escura: trajetória.</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {d.pontuacao !== null && <><dt className="text-muted-foreground">Pontuação do alerta</dt><dd className="font-semibold">{`${d.pontuacao.toLocaleString()} / 3`}</dd></>}
          {d.paises.length > 0 && <><dt className="text-muted-foreground">Países atingidos</dt><dd className="notranslate" translate="no">{d.paises.join(', ')}</dd></>}
          {d.populacao.map(p => <div key={p.chave} className="contents"><dt className="text-muted-foreground">{p.rotulo}</dt><dd className="font-semibold">{p.valor.toLocaleString()}</dd></div>)}
        </dl>
        {d.populacao.length > 0 && <p className="text-xs text-muted-foreground">População exposta: estimativa de modelo do GDACS, não contagem de atingidos.</p>}
        {d.estado === 'antigo' && <p className="text-xs text-amber-900">O GDACS não respondeu agora; mostrando a última consulta.</p>}
      </>}
      <p className="text-xs text-muted-foreground">
        {d?.obtidoEm && hora(d.obtidoEm) ? `Fonte: GDACS (ONU / Comissão Europeia) · consultado às ${hora(d.obtidoEm)}` : 'Fonte: GDACS (ONU / Comissão Europeia)'}
      </p>
    </div>
  )
}
