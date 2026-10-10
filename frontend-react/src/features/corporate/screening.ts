import type { Asset, ProximityResult } from '../nasa/proximity'

// Each generation belongs to one NASA/catalog context. An old promise cannot commit.
export function createScreeningGate() {
  let generation = 0
  return { invalidate: () => { generation += 1 }, begin: () => ++generation, accepts: (ticket: number) => ticket === generation }
}

export function completed(result: ProximityResult | null) {
  return !!result && ['success', 'empty', 'partial'].includes(result.state)
}

export function assetStatus(result: ProximityResult | null, id: string, loading = false, failed = false) {
  if (loading) return 'Consultando'
  if (failed) return 'Triagem indisponível'
  if (!result) return 'Não consultado'
  if (result.state === 'blocked') return 'Consulta bloqueada'
  if (result.state === 'unavailable') return 'Fonte indisponível'
  const match = result.matches.some(m => m.asset.id === id)
  if (match) return result.state === 'partial' ? 'Correspondência encontrada · resultado parcial' : 'Correspondência encontrada'
  return result.state === 'partial' ? 'Sem correspondência entre eventos utilizáveis · resultado parcial' : 'Sem correspondência nesta consulta completa'
}

export function visibleAssets(assets: Asset[], query: string, order: string, result: ProximityResult | null) {
  const distances = new Map(result?.matches.map(m => [m.asset.id, m.distanceKm]) ?? [])
  return assets.filter(a => a.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR').trim())).sort((a, b) => {
    if (order === 'distance') {
      const difference = (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity)
      if (difference && Number.isFinite(difference)) return difference
      if (distances.has(a.id) !== distances.has(b.id)) return distances.has(a.id) ? -1 : 1
    }
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}
