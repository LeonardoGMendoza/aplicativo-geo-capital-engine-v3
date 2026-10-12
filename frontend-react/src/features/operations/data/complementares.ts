// "Informações complementares" com DADOS REAIS (no lugar da câmera, rio e fotos fictícias da demonstração).
// Satélite: NASA GIBS (imagem do dia, sem chave). Tempo agora e próximas 24 h: Open-Meteo (sem chave).
export type Coordenadas = { latitude: number; longitude: number }
export type Agora = {
  temperatura: number | null; umidade: number | null; chuva: number | null; vento: number | null; codigo: number | null
  horas: { hora: string; temperatura: number | null; chuva: number | null }[]
}

/** Imagem real de satélite (cor verdadeira) de um dia, ~2° ao redor da cidade. WMS 1.3.0 em EPSG:4326 usa lat,lon na BBOX. */
export function urlSatelite(c: Coordenadas, data: string, camada = 'MODIS_Terra_CorrectedReflectance_TrueColor') {
  const lat = c.latitude, lon = c.longitude
  const bbox = [lat - 1, lon - 1.3, lat + 1, lon + 1.3].map(v => v.toFixed(4)).join(',')
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${camada}&STYLES=&CRS=EPSG:4326&BBOX=${bbox}&WIDTH=640&HEIGHT=492&FORMAT=image/jpeg&TIME=${data}`
}
export const urlWorldview = (c: Coordenadas, data: string) =>
  `https://worldview.earthdata.nasa.gov/?v=${(c.longitude - 2).toFixed(2)},${(c.latitude - 1.5).toFixed(2)},${(c.longitude + 2).toFixed(2)},${(c.latitude + 1.5).toFixed(2)}&t=${data}`

/** Data AAAA-MM-DD de alguns dias atrás (o satélite publica o dia de ontem completo). */
export function diaAtras(dias: number, agora = new Date()) {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() - dias)).toISOString().slice(0, 10)
}

/** Ladrilho (tile) do mapa que contém o ponto, e a posição do ponto dentro dele (0 a 1). */
export function ladrilho(c: Coordenadas, z: number) {
  const n = 2 ** z, rad = (c.latitude * Math.PI) / 180
  const fx = ((c.longitude + 180) / 360) * n
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n
  return { x: Math.floor(fx), y: Math.floor(fy), px: fx - Math.floor(fx), py: fy - Math.floor(fy) }
}
export const preencherLadrilho = (modelo: string, z: number, x: number, y: number) => modelo.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))

const CODIGOS: [number[], string][] = [
  [[0], 'Céu limpo'], [[1, 2], 'Poucas nuvens'], [[3], 'Nublado'], [[45, 48], 'Neblina'], [[51, 53, 55, 56, 57], 'Garoa'],
  [[61, 63, 66], 'Chuva'], [[65, 67], 'Chuva forte'], [[71, 73, 75, 77, 85, 86], 'Neve'], [[80, 81], 'Pancadas de chuva'], [[82], 'Pancadas fortes'], [[95, 96, 99], 'Trovoada'],
]
export function descreverTempo(codigo: number | null) {
  if (codigo === null) return 'Sem dado'
  return CODIGOS.find(([lista]) => lista.includes(codigo))?.[1] ?? 'Tempo variável'
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export async function buscarAgora(c: Coordenadas, options: { signal?: AbortSignal; fetcher?: typeof fetch } = {}): Promise<Agora> {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${c.latitude.toFixed(4)}&longitude=${c.longitude.toFixed(4)}`
    + '&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code'
    + '&hourly=temperature_2m,precipitation&forecast_hours=24&timezone=America%2FSao_Paulo&wind_speed_unit=kmh'
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000)
  const r = await (options.fetcher ?? fetch)(url, { signal, cache: 'no-store', headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error('Tempo agora indisponível.')
  const d = await r.json()
  const atual = d?.current ?? {}, h = d?.hourly ?? {}
  const horas = Array.isArray(h.time) ? h.time.slice(0, 24).map((t: string, i: number) => ({ hora: String(t).slice(11, 16), temperatura: num(h.temperature_2m?.[i]), chuva: num(h.precipitation?.[i]) })) : []
  return { temperatura: num(atual.temperature_2m), umidade: num(atual.relative_humidity_2m), chuva: num(atual.precipitation), vento: num(atual.wind_speed_10m), codigo: num(atual.weather_code), horas }
}
