// "Ouvir alerta": lê o aviso em voz alta com a voz do próprio aparelho (speechSynthesis).
// As vozes do sistema funcionam SEM internet (iPhone, Android, Windows), o que serve num apagão.
import type { AlertaOficial, Nivel, ResumoLugar } from './oficiais'

export type IdiomaVoz = 'pt' | 'es' | 'en'
export const CHAVE_IDIOMA_VOZ = 'omni-voz-idioma'
export const IDIOMAS_VOZ: { id: IdiomaVoz; nome: string; bcp: string }[] = [
  { id: 'pt', nome: 'Português', bcp: 'pt-BR' }, { id: 'es', nome: 'Español', bcp: 'es-419' }, { id: 'en', nome: 'English', bcp: 'en-US' },
]

const NIVEIS: Record<IdiomaVoz, Record<Nivel, string>> = {
  pt: { extremo: 'grande perigo', severo: 'perigo', moderado: 'atenção' },
  es: { extremo: 'peligro extremo', severo: 'peligro', moderado: 'atención' },
  en: { extremo: 'extreme danger', severo: 'danger', moderado: 'caution' },
}
// Nomes de evento mais comuns (o resto é lido como veio da fonte)
const EVENTOS: { re: RegExp; es: string; en: string }[] = [
  { re: /tornado/i, es: 'tornado', en: 'tornado' },
  { re: /tempestade de neve|nevasca/i, es: 'tormenta de nieve', en: 'winter storm' },
  { re: /tempestade|trovoada/i, es: 'tormenta', en: 'thunderstorm' },
  { re: /acumulado de chuva|chuva/i, es: 'lluvias intensas', en: 'heavy rain' },
  { re: /enxurrada/i, es: 'inundación repentina', en: 'flash flood' },
  { re: /enchente|inunda/i, es: 'inundación', en: 'flood' },
  { re: /vendaval|vento/i, es: 'vientos fuertes', en: 'high winds' },
  { re: /declínio de temperatura|frio|geada/i, es: 'descenso de temperatura', en: 'cold' },
  { re: /calor|temperatura alta/i, es: 'calor extremo', en: 'extreme heat' },
  { re: /baixa umidade/i, es: 'baja humedad', en: 'low humidity' },
  { re: /terremoto/i, es: 'sismo', en: 'earthquake' },
  { re: /tsunami/i, es: 'tsunami', en: 'tsunami' },
  { re: /furac|ciclone/i, es: 'ciclón', en: 'cyclone' },
  { re: /neve/i, es: 'nieve', en: 'snow' },
  { re: /incêndio/i, es: 'incendio', en: 'fire' },
]
const CONSELHO: Record<IdiomaVoz, string> = {
  pt: 'Em perigo, ligue para a Defesa Civil.',
  es: 'En caso de peligro, llame a Defensa Civil.',
  en: 'If you are in danger, call emergency services.',
}

/** Idioma do site -> idioma da voz (as frases existem em pt, es e en; os outros idiomas ouvem em inglês). */
export function idiomaDoSite(lang: string): IdiomaVoz {
  return lang === 'pt' ? 'pt' : lang === 'es' ? 'es' : 'en'
}

// Conselho curto por tipo de aviso, para quem ouve em espanhol ou inglês (a instrução oficial vem em português)
const DICAS: { re: RegExp; es: string; en: string }[] = [
  { re: /tornado/i, es: 'Busque abrigo en un lugar cerrado, lejos de ventanas.', en: 'Take shelter indoors, away from windows.' },
  { re: /tempestade de neve|nevasca|neve|frio|geada/i, es: 'Abríguese, evite viajar y protéjase del frío.', en: 'Stay indoors, avoid travel and keep warm.' },
  { re: /tempestade|trovoada/i, es: 'No se refugie debajo de árboles y desconecte los aparatos eléctricos.', en: 'Do not shelter under trees and unplug electrical devices.' },
  { re: /chuva|enchente|enxurrada|inunda/i, es: 'No cruce calles inundadas y aléjese de ríos y laderas.', en: 'Do not cross flooded roads and stay away from rivers and slopes.' },
  { re: /vento|vendaval/i, es: 'Aléjese de árboles, postes y carteles.', en: 'Stay away from trees, poles and billboards.' },
  { re: /calor|umidade/i, es: 'Beba agua y evite el sol en las horas más calientes.', en: 'Drink water and avoid the sun at the hottest hours.' },
  { re: /terremoto/i, es: 'Agáchese, cúbrase y sujétese. Después, salga con cuidado.', en: 'Drop, cover and hold on. Then leave carefully.' },
  { re: /tsunami/i, es: 'Si está en la costa, vaya a un lugar alto ahora.', en: 'If you are on the coast, move to high ground now.' },
]
function dica(evento: string, idioma: 'es' | 'en') { return DICAS.find(d => d.re.test(evento))?.[idioma] ?? '' }

export function eventoNoIdioma(evento: string, idioma: IdiomaVoz) {
  if (idioma === 'pt') return evento
  const achado = EVENTOS.find(e => e.re.test(evento))
  return achado ? achado[idioma] : evento
}

function hora(iso: string | null, idioma: IdiomaVoz, agora: Date) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const bcp = IDIOMAS_VOZ.find(i => i.id === idioma)!.bcp
  const h = d.toLocaleTimeString(bcp, { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === agora.toDateString()) return h
  return `${d.toLocaleDateString(bcp, { weekday: 'long' })}, ${h}`
}

/** Texto curto e claro para ouvir: evento, nível, onde, até quando e o que fazer. */
export function fraseDoAlerta(a: Pick<AlertaOficial, 'evento' | 'severidade' | 'quando' | 'inicio' | 'fim' | 'area' | 'instrucao' | 'pais'>, idioma: IdiomaVoz = 'pt', onde?: string, agora = new Date()) {
  const ev = eventoNoIdioma(a.evento, idioma), nivel = NIVEIS[idioma][a.severidade]
  const lugar = onde ?? (a.area ? a.area.split(/[;:]/)[0].split(',').slice(0, 2).join(',').trim() : a.pais ?? '')
  const ini = hora(a.inicio, idioma, agora), fim = hora(a.fim, idioma, agora)
  const partes: string[] = []
  if (idioma === 'pt') {
    partes.push(`Aviso de ${ev.toLowerCase()}, nível ${nivel}${lugar ? `, em ${lugar}` : ''}.`)
    if (a.quando === 'vem' && ini) partes.push(`Começa ${ini}.`)
    else if (fim) partes.push(`Vale até ${fim}.`)
    if (a.instrucao) partes.push(a.instrucao.split('. ').slice(0, 2).join('. ').replace(/\.?$/, '.'))
  } else if (idioma === 'es') {
    partes.push(`Alerta de ${ev.toLowerCase()}, nivel ${nivel}${lugar ? `, en ${lugar}` : ''}.`)
    if (a.quando === 'vem' && ini) partes.push(`Comienza ${ini}.`)
    else if (fim) partes.push(`Vigente hasta ${fim}.`)
    if (dica(a.evento, 'es')) partes.push(dica(a.evento, 'es'))
  } else {
    partes.push(`${ev.charAt(0).toUpperCase() + ev.slice(1)} alert, ${nivel} level${lugar ? `, in ${lugar}` : ''}.`)
    if (a.quando === 'vem' && ini) partes.push(`Starts ${ini}.`)
    else if (fim) partes.push(`Valid until ${fim}.`)
    if (dica(a.evento, 'en')) partes.push(dica(a.evento, 'en'))
  }
  partes.push(CONSELHO[idioma])
  return partes.join(' ')
}

/** Resumo de um lugar: o aviso oficial mais grave ou o pior dia da previsão. */
export function fraseDoLugar(c: ResumoLugar, idioma: IdiomaVoz = 'pt', agora = new Date()) {
  const a = c.alertas[0]
  if (a) return fraseDoAlerta({ ...a, pais: c.pais, area: null, instrucao: idioma === 'pt' ? a.instrucao : null }, idioma, c.nome, agora)
  const pior = c.previsao.find(d => d.nivel)
  const nada = { pt: `${c.nome}: sem alertas oficiais e sem perigo previsto para os próximos sete dias.`, es: `${c.nome}: sin alertas oficiales ni peligro previsto para los próximos siete días.`, en: `${c.nome}: no official alerts and no danger expected in the next seven days.` }
  if (!pior) return nada[idioma]
  const dia = new Date(`${pior.data}T12:00:00`).toLocaleDateString(IDIOMAS_VOZ.find(i => i.id === idioma)!.bcp, { weekday: 'long' })
  if (idioma === 'pt') return `${c.nome}: sem aviso oficial agora. A previsão indica ${pior.motivos[0]?.toLowerCase() ?? 'tempo perigoso'} na ${dia}.`
  if (idioma === 'es') return `${c.nome}: sin alerta oficial ahora. El pronóstico indica mal tiempo el ${dia}.`
  return `${c.nome}: no official alert now. The forecast shows bad weather on ${dia}.`
}

export function vozDisponivel() { return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined' }

export function lerIdiomaVoz(): IdiomaVoz {
  try { const v = localStorage.getItem(CHAVE_IDIOMA_VOZ); return v === 'es' || v === 'en' ? v : 'pt' } catch { return 'pt' }
}
export function gravarIdiomaVoz(v: IdiomaVoz) { try { localStorage.setItem(CHAVE_IDIOMA_VOZ, v) } catch { /* sem armazenamento */ } }

/** Fala o texto. Devolve uma função para parar. Escolhe a voz do aparelho no idioma pedido. */
export function falar(texto: string, idioma: IdiomaVoz = 'pt', aoTerminar?: () => void) {
  if (!vozDisponivel()) { aoTerminar?.(); return () => {} }
  const bcp = IDIOMAS_VOZ.find(i => i.id === idioma)!.bcp
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(texto)
  u.lang = bcp
  const vozes = window.speechSynthesis.getVoices()
  u.voice = vozes.find(v => v.lang === bcp) ?? vozes.find(v => v.lang.toLowerCase().startsWith(idioma)) ?? null
  u.rate = 0.95
  u.onend = () => aoTerminar?.()
  u.onerror = () => aoTerminar?.()
  window.speechSynthesis.speak(u)
  return () => { window.speechSynthesis.cancel(); aoTerminar?.() }
}
