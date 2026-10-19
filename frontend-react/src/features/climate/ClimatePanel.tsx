import { useEffect, useState } from 'react'
import { CloudRain, RefreshCw, ThermometerSun } from 'lucide-react'
import { buscarPrevisoes, cidadesCalor, cidadesChuva, CALOR_INTENSO_C, CHUVA_FORTE_MM, formatarGraus, formatarMm, nivelCalor, nivelChuva, picoChuva, picoMaxima, rotuloCalor, rotuloChuva, totalChuva } from './climate'
import type { Previsao } from './climate'
import './climate.css'

type Estado = { calor: Previsao[]; chuva: Previsao[]; obtidoEm: Date } | null

export function ClimatePanel() {
  const [dados, setDados] = useState<Estado>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    const abort = new AbortController()
    setCarregando(true); setErro(null)
    Promise.all([buscarPrevisoes(cidadesCalor, { signal: abort.signal }), buscarPrevisoes(cidadesChuva, { signal: abort.signal })])
      .then(([calor, chuva]) => { if (!abort.signal.aborted) setDados({ calor, chuva, obtidoEm: new Date() }) })
      .catch(e => { if (!abort.signal.aborted) setErro(e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'A previsão demorou demais. Tente de novo.') })
      .finally(() => { if (!abort.signal.aborted) setCarregando(false) })
    return () => abort.abort()
  }, [tentativa])

  return <section className="ia-panel clima" aria-labelledby="clima-titulo">
    <div className="clima-topo">
      <div>
        <h2 id="clima-titulo" className="ia-panel-title" style={{ marginBottom: 2 }}>Condições agora: El Niño</h2>
        <p className="ia-muted">O El Niño tende a trazer calor e seca ao Norte e chuva acima do normal ao Sul (<span>CPTEC/INPE, nota de 20/07/2026</span>). Previsão real para os próximos 3 dias:</p>
      </div>
      <button type="button" className="clima-atualizar" onClick={() => setTentativa(n => n + 1)} disabled={carregando} aria-label="Atualizar previsão"><RefreshCw className="size-4" aria-hidden="true" />{carregando ? 'Atualizando…' : 'Atualizar'}</button>
    </div>
    {erro && <p role="alert" className="ia-error">{erro}</p>}
    {carregando && !dados && <p role="status" className="ia-muted">Consultando a previsão…</p>}
    {dados && <div className="clima-grade">
      <div className="clima-bloco clima-calor">
        <h3><ThermometerSun className="size-5" aria-hidden="true" />Calor · Norte e Centro-Oeste</h3>
        <ul>{dados.calor.map(p => { const pico = picoMaxima(p), nivel = nivelCalor(pico)
          return <li key={p.cidade.nome}><span className="clima-cidade">{p.cidade.nome} <small>{p.cidade.uf}</small></span><span className="clima-valor">{formatarGraus(pico)}</span><span className={`clima-nivel ${nivel}`}>{rotuloCalor[nivel]}</span></li> })}</ul>
        <p className="clima-legenda">Máxima prevista em 3 dias · calor intenso a partir de {CALOR_INTENSO_C} °C</p>
      </div>
      <div className="clima-bloco clima-chuva">
        <h3><CloudRain className="size-5" aria-hidden="true" />Chuva · Sul</h3>
        <ul>{dados.chuva.map(p => { const pico = picoChuva(p), nivel = nivelChuva(pico)
          return <li key={p.cidade.nome}><span className="clima-cidade">{p.cidade.nome} <small>{p.cidade.uf}</small></span><span className="clima-valor">{formatarMm(pico)}<small> /dia · {formatarMm(totalChuva(p))} em 3 dias</small></span><span className={`clima-nivel ${nivel}`}>{rotuloChuva[nivel]}</span></li> })}</ul>
        <p className="clima-legenda">Maior chuva prevista em um dia · chuva forte a partir de {CHUVA_FORTE_MM} mm</p>
      </div>
    </div>}
    {dados && <p className="clima-fonte">Fonte: <span>Open-Meteo</span> (previsão de modelos meteorológicos) · consultado às {dados.obtidoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Critérios do protótipo, não são alertas oficiais: siga a Defesa Civil e o INMET.</p>}
  </section>
}
