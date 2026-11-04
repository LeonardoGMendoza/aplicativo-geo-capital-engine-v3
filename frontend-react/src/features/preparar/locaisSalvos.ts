// Locais guardados no aparelho para usar SEM INTERNET.
// Com internet: busca no OpenStreetMap (API do projeto) e guarda os mais próximos de cada tipo.
// Sem internet: o GPS do celular continua funcionando, então mostramos distância e direção até cada local.
import type { Coordinates, Place, PlaceCategory } from '../shelters/places'

export const CHAVE_LOCAIS = 'omni-locais-offline'
export const CATEGORIAS_OFFLINE: PlaceCategory[] = ['shelter', 'hospital', 'clinic', 'pharmacy', 'worship', 'police', 'food']
const POR_CATEGORIA = 5

export interface LocaisSalvos { salvoEm: string; origem: Coordinates; rotulo: string; itens: Place[] }

export function escolherParaGuardar(items: Place[], origem: Coordinates, rotulo: string, agora = new Date()): LocaisSalvos {
  const itens = CATEGORIAS_OFFLINE.flatMap(c => items.filter(p => p.category === c).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, POR_CATEGORIA))
  return { salvoEm: agora.toISOString(), origem, rotulo, itens }
}

export function lerLocais(armazenamento: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): LocaisSalvos | null {
  try {
    const dados = JSON.parse(armazenamento?.getItem(CHAVE_LOCAIS) ?? 'null') as LocaisSalvos | null
    return dados && Array.isArray(dados.itens) && dados.origem ? dados : null
  } catch { return null }
}

export function guardarLocais(dados: LocaisSalvos, armazenamento: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage) {
  try { armazenamento?.setItem(CHAVE_LOCAIS, JSON.stringify(dados)); return true } catch { return false }
}

const rad = (g: number) => (g * Math.PI) / 180

export function distanciaKm(a: Coordinates, b: Coordinates) {
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)))
}

/** Direção de A para B em graus (0 = norte, 90 = leste). */
export function rumo(a: Coordinates, b: Coordinates) {
  const y = Math.sin(rad(b.longitude - a.longitude)) * Math.cos(rad(b.latitude))
  const x = Math.cos(rad(a.latitude)) * Math.sin(rad(b.latitude)) - Math.sin(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.cos(rad(b.longitude - a.longitude))
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

const PONTOS = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste']
const SETAS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️']
export function direcao(graus: number) {
  const i = Math.round(((graus % 360) + 360) % 360 / 45) % 8
  return { texto: PONTOS[i], seta: SETAS[i] }
}

/** Ordena os locais guardados pela distância a partir de onde a pessoa está agora (ou do ponto salvo). */
export function locaisAPartirDe(dados: LocaisSalvos, aqui: Coordinates | null) {
  const base = aqui ?? dados.origem
  return dados.itens.map(p => {
    const km = distanciaKm(base, p.coordinates)
    return { ...p, kmAgora: km, minutosAPe: Math.max(1, Math.round((km / 4.5) * 60)), direcao: direcao(rumo(base, p.coordinates)) }
  }).sort((a, b) => a.kmAgora - b.kmAgora)
}
