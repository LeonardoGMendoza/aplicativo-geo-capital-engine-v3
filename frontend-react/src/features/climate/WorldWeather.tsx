import { lazy, Suspense, useEffect, useState } from 'react'
import { Globe2 } from 'lucide-react'
import { MapErrorBoundary } from '@/components/shared/MapErrorBoundary'
import { buscarAlertasGlobais, buscarRadar, dataCurta, emojiTipo } from './globalWeather'
import type { AlertaGlobal, Radar, RespostaAlertas } from './globalWeather'
import './climate.css'
const WorldWeatherMap = lazy(() => import('./WorldWeatherMap'))

export function WorldWeather() {
  const [radar, setRadar] = useState<Radar | null>(null)
  const [erroRadar, setErroRadar] = useState<string | null>(null)
  const [alertas, setAlertas] = useState<RespostaAlertas | null>(null)
  const [erroAlertas, setErroAlertas] = useState<string | null>(null)
  const [mostrarRadar, setMostrarRadar] = useState(true)
  const [mostrarAlertas, setMostrarAlertas] = useState(true)
  const [aberto, setAberto] = useState<string | null>(null)
  const [foco, setFoco] = useState<AlertaGlobal | null>(null)

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
        <WorldWeatherMap radar={radar} alertas={lista} mostrarRadar={mostrarRadar} mostrarAlertas={mostrarAlertas} onRadarFalhou={() => setErroRadar('O radar de chuva não carregou agora. Os alertas continuam no mapa.')} foco={foco} />
      </Suspense>
    </MapErrorBoundary>
    {lista.length > 0 && <ul className="mundo-lista" aria-label="Alertas mais importantes">
      {lista.slice(0, 8).map(a => <li key={a.id} className={aberto === a.id ? 'aberto' : undefined}>
        <button type="button" className="mundo-item" aria-expanded={aberto === a.id} onClick={() => setAberto(aberto === a.id ? null : a.id)}>
          <span className={`mundo-tag ${a.nivel}`}>{a.nivel}</span><span>{emojiTipo[a.tipo]} <b>{a.tipoNome}</b> · {a.nome}{a.pais ? ` · ${a.pais}` : ''} · desde {dataCurta(a.inicio)}</span><span className="mundo-mais" aria-hidden="true">{aberto === a.id ? '▲' : 'ver detalhes ▼'}</span>
        </button>
        {aberto === a.id && <div className="mundo-detalhe">
          <dl>
            <dt>Tipo</dt><dd>{emojiTipo[a.tipo]} {a.tipoNome}</dd>
            <dt>Nível do alerta</dt><dd><span className={`mundo-tag ${a.nivel}`}>{a.nivel}</span></dd>
            {a.severidade && <><dt>Intensidade</dt><dd>{a.severidade}</dd></>}
            <dt>Onde</dt><dd>{a.paisesAfetados?.length ? a.paisesAfetados.join(', ') : a.pais ?? '—'} · {a.latitude.toFixed(2)}, {a.longitude.toFixed(2)}</dd>
            <dt>Desde</dt><dd>{dataCurta(a.inicio)}{a.fim ? ` · última atualização ${dataCurta(a.fim)}` : ''}</dd>
            {a.descricao && <><dt>Descrição</dt><dd>{a.descricao}</dd></>}
          </dl>
          <div className="mundo-acoes">
            <button type="button" className="cidade-chip" onClick={() => { setMostrarAlertas(true); setFoco(a); document.getElementById('mundo-titulo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>📍 Ver no mapa</button>
            {a.link && <a className="mundo-fonte" href={a.link} target="_blank" rel="noopener noreferrer">fonte oficial (GDACS) ↗</a>}
          </div>
        </div>}
      </li>)}
    </ul>}
    {alertas && lista.length === 0 && <p className="ia-muted">Nenhum alerta laranja ou vermelho ativo no mundo neste momento.</p>}
    <p className="clima-fonte">Fontes: radar <a href="https://www.rainviewer.com/" target="_blank" rel="noopener noreferrer">RainViewer</a> (redes de radar públicas de vários países) · alertas <a href="https://www.gdacs.org/" target="_blank" rel="noopener noreferrer">GDACS</a> (ONU / Comissão Europeia). Mostram a situação, não substituem os avisos da Defesa Civil de cada país.</p>
  </section>
}
