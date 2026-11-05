// Locais guardados no aparelho para usar SEM INTERNET.
// Com internet: busca no OpenStreetMap (API do projeto) e guarda os mais próximos de cada tipo.
// Sem internet: o GPS do celular continua funcionando, então mostramos distância e direção até cada local.
import type { Coordinates, Place, PlaceCategory } from '../shelters/places'

export const CHAVE_LOCAIS = 'omni-locais-offline'          // versão antiga: um só lugar
export const CHAVE_CIDADES = 'omni-locais-offline-cidades'  // vários lugares: perto de mim + "Meus lugares" (ids da lista do aparelho)

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

type Armazem = Pick<Storage, 'getItem' | 'setItem'> | null
const armazemPadrao = (): Armazem => typeof localStorage === 'undefined' ? null : localStorage

/** Todos os lugares guardados, por id ('perto' = perto de mim; ou o id da cidade). Migra a versão antiga. */
export function lerTodos(armazenamento: Armazem = armazemPadrao()): Record<string, LocaisSalvos> {
  try {
    const todos = JSON.parse(armazenamento?.getItem(CHAVE_CIDADES) ?? 'null') as Record<string, LocaisSalvos> | null
    if (todos && typeof todos === 'object') return Object.fromEntries(Object.entries(todos).filter(([, d]) => d && Array.isArray(d.itens) && d.origem))
  } catch { /* corrompido: começa vazio */ }
  const antigo = lerLocais(armazenamento)
  return antigo ? { perto: antigo } : {}
}

export function guardarLugar(id: string, dados: LocaisSalvos, armazenamento: Armazem = armazemPadrao()) {
  const todos = { ...lerTodos(armazenamento), [id]: dados }
  try { armazenamento?.setItem(CHAVE_CIDADES, JSON.stringify(todos)); return todos } catch { return null }
}

/** Qual lugar guardado está mais perto de onde a pessoa está agora. */
export function lugarMaisPerto(todos: Record<string, LocaisSalvos>, aqui: Coordinates) {
  let melhor: string | null = null, menor = Infinity
  for (const [id, d] of Object.entries(todos)) {
    const km = distanciaKm(aqui, d.origem)
    if (km < menor) { menor = km; melhor = id }
  }
  return melhor
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

/** Links que abrem apps de mapa capazes de funcionar SEM INTERNET (com o mapa da cidade baixado antes). */
export function rotasOffline(destino: Coordinates, nome: string) {
  const c = `${destino.latitude},${destino.longitude}`
  return {
    // Apple Mapas (iPhone): rota a pé; funciona offline com "Mapas off-line" baixados (iOS 17+).
    apple: `maps://?daddr=${encodeURIComponent(c)}&dirflg=w`,
    // Organic Maps (grátis, OpenStreetMap, 100% offline no iPhone e no Android).
    organic: `om://map?v=1&ll=${encodeURIComponent(c)}&n=${encodeURIComponent(nome)}`,
    // Android: abre o app de mapa padrão (Google Maps com mapa off-line baixado).
    geo: `geo:${c}?q=${encodeURIComponent(c + '(' + nome + ')')}`,
  }
}
