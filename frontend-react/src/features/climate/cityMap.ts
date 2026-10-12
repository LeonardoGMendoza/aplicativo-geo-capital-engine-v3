// Mapa real da cidade no estilo do desenho do Felipe: só dados reais (OpenStreetMap, NASA EONET, RainViewer).
import type { NasaEvent } from '../nasa/contracts'
import { mapPosition } from '../nasa/geography'
import type { Coordinates, Place } from '../shelters/places'

export const cidadesMapa: { nome: string; coordenadas: Coordinates }[] = [
  { nome: 'Porto Alegre/RS', coordenadas: { latitude: -30.0346, longitude: -51.2177 } },
  { nome: 'Lajeado/RS', coordenadas: { latitude: -29.4661, longitude: -51.9615 } },
  { nome: 'São Paulo/SP', coordenadas: { latitude: -23.5505, longitude: -46.6333 } },
  { nome: 'São Sebastião/SP', coordenadas: { latitude: -23.8077, longitude: -45.4075 } },
  { nome: 'Petrópolis/RJ', coordenadas: { latitude: -22.5112, longitude: -43.1779 } },
]
// Cores e ícones do desenho do Felipe (MapArtwork): abrigo verde, alerta vermelho/laranja, rota azul.
export const CORES = { abrigo: '#0dac8c', saude: '#087bef', critico: '#fa284c', atencao: '#f4a024' }
export const RAIO_EVENTOS_KM = 300
export const DIAS_EVENTO_RECENTE = 30
const ICONES = {
  casa: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  alerta: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  cruz: '<path d="M5 12h14"/><path d="M12 5v14"/>',
}
export function marcadorHtml(tipo: keyof typeof ICONES, cor: string) {
  return `<span class="cidade-marcador" style="background:${cor}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[tipo]}</svg></span>`
}

export function distanciaKm(a: Coordinates, b: Coordinates) {
  const r = (x: number) => (x * Math.PI) / 180
  const dLat = r(b.latitude - a.latitude), dLon = r(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export type EventoPerto = { evento: NasaEvent; posicao: [number, number]; km: number; dias: number; cor: string }
/** Eventos NASA a até 300 km do centro e observados nos últimos 30 dias. Vermelho se dos últimos 3 dias. */
export function eventosPerto(eventos: NasaEvent[], centro: Coordinates, agora = Date.now()): EventoPerto[] {
  const lista: EventoPerto[] = []
  for (const evento of eventos) {
    const posicao = mapPosition(evento)
    if (!posicao || !evento.observedAt) continue
    const quando = Date.parse(evento.observedAt)
    if (!Number.isFinite(quando)) continue
    const dias = (agora - quando) / 86_400_000
    if (dias < 0 || dias > DIAS_EVENTO_RECENTE) continue
    const km = distanciaKm(centro, { latitude: posicao[0], longitude: posicao[1] })
    if (km > RAIO_EVENTOS_KM) continue
    lista.push({ evento, posicao, km, dias, cor: dias <= 3 ? CORES.critico : CORES.atencao })
  }
  return lista.sort((a, b) => a.km - b.km).slice(0, 40)
}

export type PontoMapa = { lugar: Place; tipo: 'casa' | 'cruz'; cor: string; rotulo: string }
/** Abrigos/pontos de apoio (casinha verde) e saúde (cruz azul) reais do OpenStreetMap. */
export function pontosDoMapa(lugares: Place[]): PontoMapa[] {
  const pontos: PontoMapa[] = []
  for (const lugar of lugares) {
    if (lugar.category === 'shelter') pontos.push({ lugar, tipo: 'casa', cor: CORES.abrigo, rotulo: lugar.shelterKind === 'possible' ? 'Possível ponto de apoio' : 'Abrigo / ponto de encontro' })
    else if (lugar.category === 'hospital' || lugar.category === 'clinic') pontos.push({ lugar, tipo: 'cruz', cor: CORES.saude, rotulo: lugar.category === 'hospital' ? 'Hospital' : 'UBS / UPA / clínica' })
  }
  return pontos.slice(0, 80)
}
