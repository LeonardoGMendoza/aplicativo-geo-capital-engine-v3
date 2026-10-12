import { useEffect, useMemo, useRef, useState } from 'react'
import { useNasaSession } from '@/features/nasa/NasaSession'
import { getAssets, getProximityForAssets } from '@/features/nasa/proximity'
import type { AssetCatalog, ProximityResult } from '@/features/nasa/proximity'

type Estado = { resultado: ProximityResult | null; carregando: boolean; erro: string | null }

/**
 * Cruza sozinho os eventos NASA com os 11 ativos de referência (raio 600 km), como no painel Streamlit.
 * Se o servidor já tiver eventos mais novos ("blocked"), atualiza a NASA uma vez e consulta de novo.
 * Usado no assistente (Corporativo/Social) e nos painéis B2B/ESG do Centro de Operações.
 */
export function useAlertasAtivos() {
  const nasa = useNasaSession()
  const [catalogo, setCatalogo] = useState<AssetCatalog | null>(null)
  const [estado, setEstado] = useState<Estado>({ resultado: null, carregando: false, erro: null })
  const tentouAtualizar = useRef(false)
  const fetchedAt = nasa.mode === 'nasa' && !nasa.loading && nasa.result?.fetchedAt && ['success', 'empty'].includes(nasa.result.state) ? nasa.result.fetchedAt : null

  useEffect(() => {
    const abort = new AbortController()
    getAssets({ signal: abort.signal }).then(c => !abort.signal.aborted && setCatalogo(c)).catch(() => !abort.signal.aborted && setEstado(e => ({ ...e, erro: 'Cadastro de ativos indisponível agora.' })))
    return () => abort.abort()
  }, [])

  useEffect(() => {
    if (!catalogo || !fetchedAt) return
    const abort = new AbortController()
    setEstado({ resultado: null, carregando: true, erro: null })
    getProximityForAssets(catalogo.assets.map(a => a.id), fetchedAt, { signal: abort.signal })
      .then(r => {
        if (abort.signal.aborted) return
        if (r.state === 'blocked' && !tentouAtualizar.current) { tentouAtualizar.current = true; nasa.refresh(); return }
        setEstado({ resultado: r, carregando: false, erro: r.state === 'unavailable' || r.state === 'blocked' ? 'Eventos NASA indisponíveis agora. Tente "Atualizar eventos NASA".' : null })
      })
      .catch(() => !abort.signal.aborted && setEstado({ resultado: null, carregando: false, erro: 'Não foi possível cruzar os eventos NASA com os ativos agora.' }))
    return () => abort.abort()
  }, [catalogo, fetchedAt]) // nasa.refresh é estável o bastante: chamado no máximo uma vez

  const alertas = useMemo(() => [...(estado.resultado?.matches ?? [])].sort((a, b) => a.distanceKm - b.distanceKm), [estado.resultado])
  return { catalogo, ...estado, alertas, carregando: estado.carregando || nasa.loading, totalEventos: nasa.result?.events.length ?? null }
}
