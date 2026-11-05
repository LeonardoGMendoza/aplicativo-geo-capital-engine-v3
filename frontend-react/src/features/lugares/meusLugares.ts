// "Meus lugares": as cidades que cada pessoa quer acompanhar (onde mora, onde está a família, para onde vai viajar).
// Ficam guardadas SÓ neste aparelho. O servidor recebe apenas as coordenadas na hora de buscar os alertas
// e não guarda nada. Assim cada pessoa (ou prefeitura) vê só os lugares dela.
import type { Coordinates } from '../shelters/places'

export type Lugar = { id: string; nome: string; pais: string | null; latitude: number; longitude: number }
export const CHAVE_LUGARES = 'omni-meus-lugares'
export const MAX_LUGARES = 12

type Armazem = Pick<Storage, 'getItem' | 'setItem'> | null
const armazemPadrao = (): Armazem => (typeof localStorage === 'undefined' ? null : localStorage)

const valido = (l: unknown): l is Lugar => !!l && typeof (l as Lugar).id === 'string' && typeof (l as Lugar).nome === 'string'
  && Number.isFinite((l as Lugar).latitude) && Number.isFinite((l as Lugar).longitude)
  && Math.abs((l as Lugar).latitude) <= 90 && Math.abs((l as Lugar).longitude) <= 180

export function lerLugares(armazem: Armazem = armazemPadrao()): Lugar[] {
  try {
    const lista = JSON.parse(armazem?.getItem(CHAVE_LUGARES) ?? '[]')
    return Array.isArray(lista) ? lista.filter(valido).slice(0, MAX_LUGARES) : []
  } catch { return [] }
}

export function gravarLugares(lista: Lugar[], armazem: Armazem = armazemPadrao()) {
  try { armazem?.setItem(CHAVE_LUGARES, JSON.stringify(lista.slice(0, MAX_LUGARES))); return true } catch { return false }
}

const mesmoLugar = (a: Coordinates, b: Coordinates) => Math.abs(a.latitude - b.latitude) < 0.05 && Math.abs(a.longitude - b.longitude) < 0.05

/** Adiciona sem repetir (mesmo ponto = mesmo lugar). Devolve a lista nova. */
export function adicionarLugar(lista: Lugar[], novo: Omit<Lugar, 'id'> & { id?: string }): Lugar[] {
  if (lista.length >= MAX_LUGARES || lista.some(l => mesmoLugar(l, novo))) return lista
  const id = novo.id ?? `l-${Math.round(novo.latitude * 100)}_${Math.round(novo.longitude * 100)}`
  return [...lista, { id, nome: novo.nome.trim().slice(0, 80) || 'Meu lugar', pais: novo.pais?.slice(0, 40) ?? null, latitude: +novo.latitude.toFixed(4), longitude: +novo.longitude.toFixed(4) }]
}

export function removerLugar(lista: Lugar[], id: string) { return lista.filter(l => l.id !== id) }

// Nomes de país como os alertas oficiais usam (para cruzar o aviso com o lugar)
const PAISES: Record<string, string> = { 'estados unidos': 'EUA', 'estados unidos da américa': 'EUA', 'united states': 'EUA', 'brazil': 'Brasil', 'paraguay': 'Paraguai', 'perú': 'Peru' }
export function paisDoEndereco(displayName: string | null | undefined) {
  const ultimo = (displayName ?? '').split(',').map(s => s.trim()).filter(Boolean).pop()
  if (!ultimo) return null
  return PAISES[ultimo.toLowerCase()] ?? ultimo
}

/** Quem já guardou cidades na tela "Preparar" (versão anterior) ganha os mesmos lugares aqui, sem digitar de novo. */
export function migrarDeLocaisGuardados(lista: Lugar[], guardados: Record<string, { rotulo: string; origem: Coordinates }>) {
  let saida = lista
  for (const [id, g] of Object.entries(guardados)) {
    if (id === 'perto' || !g?.origem) continue
    const [nome, ...resto] = String(g.rotulo ?? id).split(',').map(s => s.trim())
    saida = adicionarLugar(saida, { id, nome: nome || id, pais: resto.pop() ?? null, latitude: g.origem.latitude, longitude: g.origem.longitude })
  }
  return saida
}
