// El Niño: da causa (Pacífico quente) ao efeito (calor no Norte, chuva no Sul). Só fontes públicas e reais.
// Temperatura do mar: NASA GIBS, camada GHRSST MUR "anomalia" (quanto o mar está acima/abaixo do normal), diária, sem chave.
export const GIBS_CAMADA = 'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies'
export function urlAnomaliaMar(data: string) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_CAMADA}/default/${data}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`
}
/** Data no formato AAAA-MM-DD, alguns dias atrás (o satélite publica com 1–2 dias de atraso). */
export function diasAtras(dias: number, agora = new Date()) {
  const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() - dias))
  return d.toISOString().slice(0, 10)
}
// Região Niño 3.4 (5°N–5°S, 170°O–120°O): é onde os cientistas medem o El Niño.
export const NINO34: [[number, number], [number, number]] = [[-5, -170], [5, -120]]

export type CamadaVento = 'wind' | 'temp' | 'rain'
export const camadasVento: { id: CamadaVento; rotulo: string }[] = [
  { id: 'wind', rotulo: 'Ventos' }, { id: 'temp', rotulo: 'Temperatura' }, { id: 'rain', rotulo: 'Chuva' },
]
/** Mapa animado do Windy (embed público), centrado na América do Sul. */
export function urlWindy(camada: CamadaVento) {
  const p = new URLSearchParams({ lat: '-12', lon: '-62', detailLat: '-12', detailLon: '-62', zoom: '3', level: 'surface', overlay: camada,
    product: 'ecmwf', menu: '', message: 'true', marker: '', calendar: 'now', pressure: '', type: 'map', location: 'coordinates', detail: '',
    metricWind: 'km/h', metricTemp: '°C', radarRange: '-1' })
  return `https://embed.windy.com/embed2.html?${p.toString()}`
}
export const NOTA_CPTEC = 'https://granizo1.cptec.inpe.br/clima/nota_tecnica/2026/Nota_Tecnica_ASO2026.pdf'
