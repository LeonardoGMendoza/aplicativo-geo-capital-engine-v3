import { lazy, Suspense, useEffect, useState } from 'react'
import { Globe2 } from 'lucide-react'
import { MapErrorBoundary } from '@/components/shared/MapErrorBoundary'
import { buscarAlertasGlobais, buscarRadar, dataCurta, emojiTipo } from './globalWeather'
import type { Radar, RespostaAlertas } from './globalWeather'
import './climate.css'
const WorldWeatherMap = lazy(() => import('./WorldWeatherMap'))

export function WorldWeather() {
  const [radar, setRadar] = useState<Radar | null>(null)
  const [erroRadar, setErroRadar] = useState<string | null>(null)
  const [alertas, setAlertas] = useState<RespostaAlertas | null>(null)
  const [erroAlertas, setErroAlertas] = useState<string | null>(null)
  const [mostrarRadar, setMostrarRadar] = useState(true)
  const [mostrarAlertas, setMostrarAlertas] = useState(true)

  useEffect(() => {
    const abort = new AbortController()
    buscarRadar({ signal: abort.signal }).then(r => { if (!abort.signal.aborted) setRadar(r) })
      .catch(e => { if (!abort.signal.aborted) setErroRadar(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Radar de chuva indisponível agora.') })
    buscarAlertasGlobais({ signal: abort.signal }).then(a => { if (!abort.signal.aborted) setAlertas(a) })
      .catch(e => { if (!abort.signal.aborted) setErroAlertas(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Alertas mundiais indisponíveis agora.') })
    return () => abort.abort()
  }, [])

  const lista = alertas?.alertas ?? []
  return <section className="ia-panel mundo" aria-labelledby="mundo-titulo">
    <h2 id="mundo-titulo" className="ia-panel-title"><Globe2 className="size-5" aria-hidden="true" />Chuva e alertas no mundo, agora</h2>
    <p className="ia-muted">Manchas coloridas = radar de chuva (verde fraca → amarelo forte → vermelho muito forte/tempestade), onde houver radar meteorológico. Ícones = alertas laranja e vermelhos de desastres em qualquer país.</p>
    <div className="mundo-controles">
      <label><input type="checkbox" checked={mostrarRadar} onChange={e => setMostrarRadar(e.target.checked)} /> Radar de chuva{radar && <small> · {radar.horario.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>}</label>
      <label><input type="checkbox" checked={mostrarAlertas} onChange={e => setMostrarAlertas(e.target.checked)} /> Alertas de desastre{alertas && <small> · {lista.length}</small>}</label>
    </div>
    {erroRadar && <p role="alert" className="ia-warn">{erroRadar}</p>}
    {erroAlertas && <p role="alert" className="ia-warn">{erroAlertas}</p>}
    {alertas?.estado === 'antigo' && <p className="ia-warn">GDACS fora do ar agora: mostrando a última lista obtida.</p>}
    <MapErrorBoundary message="Mapa indisponível. A lista de alertas abaixo continua valendo.">
      <Suspense fallback={<p role="status" className="ia-muted">Carregando mapa…</p>}>
        <WorldWeatherMap radar={radar} alertas={lista} mostrarRadar={mostrarRadar} mostrarAlertas={mostrarAlertas} onRadarFalhou={() => setErroRadar('O radar de chuva não carregou agora. Os alertas continuam no mapa.')} />
      </Suspense>
    </MapErrorBoundary>
    {lista.length > 0 && <ul className="mundo-lista" aria-label="Alertas mais importantes">
      {lista.slice(0, 8).map(a => <li key={a.id}><span className={`mundo-tag ${a.nivel}`}>{a.nivel}</span><span>{emojiTipo[a.tipo]} <b>{a.tipoNome}</b> · {a.nome}{a.pais ? ` · ${a.pais}` : ''} · desde {dataCurta(a.inicio)}</span>{a.link && <a href={a.link} target="_blank" rel="noopener noreferrer">detalhes ↗</a>}</li>)}
    </ul>}
    {alertas && lista.length === 0 && <p className="ia-muted">Nenhum alerta laranja ou vermelho ativo no mundo neste momento.</p>}
    <p className="clima-fonte">Fontes: radar <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">RainViewer</a> (redes de radar públicas de vários países) · alertas <a href="https://www.gdacs.org/" target="_blank" rel="noopener noreferrer">GDACS</a> (ONU / Comissão Europeia). Mostram a situação, não substituem os avisos da Defesa Civil de cada país.</p>
  </section>
}
