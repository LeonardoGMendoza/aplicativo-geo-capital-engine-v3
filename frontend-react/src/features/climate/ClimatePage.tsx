import { ClimatePanel } from './ClimatePanel'
import { ElNinoSection } from './ElNinoSection'
import { CityLiveMap } from './CityLiveMap'
import { WorldWeather } from './WorldWeather'
import '../intelligence/intelligence.css'

/** Clima ao vivo: só dados reais (Open-Meteo, RainViewer, GDACS). Nenhuma simulação nesta tela. */
export function ClimatePage() {
  return <div className="ia-neon space-y-5">
    <header>
      <p className="ia-kicker">Omni-EcoRescue · dados reais</p>
      <h1 className="ia-title">Clima ao vivo</h1>
      <p className="ia-sub">O El Niño do oceano até o Brasil, calor e chuva previstos, sua cidade no mapa e alertas de desastres no mundo, agora. Nenhum dado desta tela é simulado.</p>
    </header>
    <ElNinoSection />
    <ClimatePanel />
    <CityLiveMap />
    <WorldWeather />
  </div>
}
