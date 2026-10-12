import { ClimatePanel } from './ClimatePanel'
import { WorldWeather } from './WorldWeather'
import '../intelligence/intelligence.css'

/** Clima ao vivo: só dados reais (Open-Meteo, RainViewer, GDACS). Nenhuma simulação nesta tela. */
export function ClimatePage() {
  return <div className="ia-neon space-y-5">
    <header>
      <p className="ia-kicker">Omni-EcoRescue · dados reais</p>
      <h1 className="ia-title">Clima ao vivo</h1>
      <p className="ia-sub">Calor e chuva previstos no Brasil, radar de chuva e alertas de desastres no mundo, agora. Nenhum dado desta tela é simulado.</p>
    </header>
    <ClimatePanel />
    <WorldWeather />
  </div>
}
