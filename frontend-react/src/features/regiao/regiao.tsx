// Filtro por localização (pedido da Defesa Civil): a central abre focada no estado de São Paulo.
// "Brasil" mostra o Brasil e a América do Sul; "Mundo todo" mostra tudo. A escolha fica salva no navegador.
import { useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { cidadesCalor, cidadesChuva } from '@/features/climate/climate'
import type { Cidade } from '@/features/climate/climate'
import type { ItemReal } from '@/features/operations/data/real'

export type Regiao = 'sp' | 'brasil' | 'mundo'
export const REGIOES: { id: Regiao; nome: string }[] = [
  { id: 'sp', nome: 'Estado de São Paulo' },
  { id: 'brasil', nome: 'Brasil' },
  { id: 'mundo', nome: 'Mundo todo' },
]
const CHAVE = 'omni-regiao'
const PADRAO: Regiao = 'sp'

function lerSalva(): Regiao {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === 'sp' || v === 'brasil' || v === 'mundo' ? v : PADRAO
  } catch { return PADRAO }
}
let atual: Regiao = lerSalva()
const ouvintes = new Set<() => void>()

export function setRegiao(r: Regiao) {
  atual = r
  try { localStorage.setItem(CHAVE, r) } catch { /* navegador sem armazenamento: vale só nesta página */ }
  ouvintes.forEach(f => f())
}
export function getRegiao() { return atual }
export function useRegiao(): Regiao {
  return useSyncExternalStore(f => { ouvintes.add(f); return () => { ouvintes.delete(f) } }, () => atual, () => PADRAO)
}

// Cidades monitoradas na previsão (calor e chuva) de cada região.
const SP_CALOR: Cidade[] = [
  { nome: 'Ribeirão Preto', uf: 'SP', latitude: -21.1775, longitude: -47.8103 },
  { nome: 'Presidente Prudente', uf: 'SP', latitude: -22.1256, longitude: -51.3889 },
  { nome: 'Campinas', uf: 'SP', latitude: -22.9056, longitude: -47.0608 },
  { nome: 'Sorocaba', uf: 'SP', latitude: -23.5015, longitude: -47.4526 },
]
const SP_CHUVA: Cidade[] = [
  { nome: 'São Paulo', uf: 'SP', latitude: -23.5505, longitude: -46.6333 },
  { nome: 'Santos', uf: 'SP', latitude: -23.9608, longitude: -46.3336 },
  { nome: 'São Sebastião', uf: 'SP', latitude: -23.7951, longitude: -45.4143 },
  { nome: 'São José dos Campos', uf: 'SP', latitude: -23.1896, longitude: -45.8841 },
]
export function cidadesDaRegiao(r: Regiao): { calor: Cidade[]; chuva: Cidade[] } {
  return r === 'sp' ? { calor: SP_CALOR, chuva: SP_CHUVA } : { calor: cidadesCalor, chuva: cidadesChuva }
}

// Limites aproximados do estado de São Paulo e distância até a capital (para ciclones e tsunamis que podem chegar).
const SP_CENTRO = { lat: -23.5505, lon: -46.6333 }
export const noEstadoSP = (lat: number, lon: number) => lat >= -25.4 && lat <= -19.7 && lon >= -53.2 && lon <= -44.1
export function kmAteSP(lat: number, lon: number) {
  const r = Math.PI / 180, dLat = (lat - SP_CENTRO.lat) * r, dLon = (lon - SP_CENTRO.lon) * r
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(SP_CENTRO.lat * r) * Math.cos(lat * r) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}
/** Alerta mundial (GDACS) que interessa a SP: dentro do estado, a até 2.000 km (ciclone no Atlântico Sul) ou tsunami. */
export function alertaMundialEmSP(lat: number, lon: number, tipo: string) {
  return noEstadoSP(lat, lon) || tipo === 'TS' || kmAteSP(lat, lon) <= 2000
}
const naAmericaDoSul = (lat: number, lon: number) => lat >= -56 && lat <= 13 && lon >= -82 && lon <= -34
export function alertaMundialNaRegiao(lat: number, lon: number, tipo: string, pais: string | null, r: Regiao) {
  if (r === 'mundo') return true
  if (r === 'brasil') return naAmericaDoSul(lat, lon) || /brazil|brasil/i.test(pais ?? '') || tipo === 'TS'
  return alertaMundialEmSP(lat, lon, tipo)
}

/** Item da lista de alertas dentro da região escolhida. */
export function itemNaRegiao(i: ItemReal, r: Regiao) {
  if (r === 'mundo') return true
  if (r === 'brasil') return i.escopo === 'brasil' || i.tipoGdacs === 'TS'
  if (i.uf) return i.uf === 'SP'
  if (typeof i.lat === 'number' && typeof i.lon === 'number') return i.tipoGdacs ? alertaMundialEmSP(i.lat, i.lon, i.tipoGdacs) : noEstadoSP(i.lat, i.lon)
  return false
}

/** Seletor de região (mesmo visual do seletor de idioma). */
export function RegiaoSelector({ className, style }: { className?: string; style?: CSSProperties }) {
  const r = useRegiao()
  return (
    <select value={r} onChange={e => setRegiao(e.target.value as Regiao)} className={className} style={style} aria-label="Região mostrada">
      {REGIOES.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
    </select>
  )
}
