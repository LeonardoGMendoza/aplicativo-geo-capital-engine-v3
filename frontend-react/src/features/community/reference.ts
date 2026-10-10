import type { Asset } from '../nasa/proximity'

export function communityDescription(asset: Asset) {
  return typeof asset.communityDescription === 'string' && asset.communityDescription.trim() ? asset.communityDescription : 'Descrição comunitária não informada'
}
function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}
export function searchReferences(assets: Asset[], query: string) {
  const term = normalize(query)
  return assets.filter(asset => normalize(`${communityDescription(asset)} ${asset.name}`).includes(term))
}
export function selectReference(assets: Asset[], id: string | null) {
  return assets.find(asset => asset.id === id)
}
export const communityLimits = 'A distância apresentada refere-se ao ativo associado. A localização e a situação da comunidade não foram verificadas. Proximidade geográfica não confirma risco ou segurança.'
