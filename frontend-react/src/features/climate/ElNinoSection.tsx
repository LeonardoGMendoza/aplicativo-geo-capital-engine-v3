import { lazy, Suspense, useState } from 'react'
import { Waves } from 'lucide-react'
import { MapErrorBoundary } from '@/components/shared/MapErrorBoundary'
import { camadasVento, dataBR, NOTA_CPTEC, urlWindy } from './elNino'
import type { CamadaVento } from './elNino'
import './climate.css'
const ElNinoOceanMap = lazy(() => import('./ElNinoOceanMap'))

export function ElNinoSection() {
  const [dataMar, setDataMar] = useState<string | null>(null)
  const [marFalhou, setMarFalhou] = useState(false)
  const [camada, setCamada] = useState<CamadaVento>('wind')
  return <section className="ia-panel nino" aria-labelledby="nino-titulo">
    <h2 id="nino-titulo" className="ia-panel-title"><Waves className="size-5" aria-hidden="true" />El Niño: da causa ao efeito</h2>
    <p className="ia-muted">O El Niño começa no oceano Pacífico e muda os ventos que chegam ao Brasil. Segundo o <a href={NOTA_CPTEC} target="_blank" rel="noopener noreferrer">CPTEC/INPE</a>, isso tende a trazer calor e seca ao Norte e chuva acima do normal ao Sul.</p>

    <ol className="nino-passos">
      <li>
        <h3><span>1</span> O Pacífico esquenta</h3>
        <p className="ia-muted">Satélite da NASA, animado nos últimos 60 dias: quanto o mar está <b className="quente">mais quente</b> ou <b className="frio">mais frio</b> que o normal. A faixa vermelha no Pacífico, perto do Equador, é o El Niño.{dataMar && <> Imagem de {dataBR(dataMar)}.</>}</p>
        {marFalhou ? <p role="alert" className="ia-warn">A imagem do satélite não carregou agora. Tente de novo mais tarde.</p>
          : <MapErrorBoundary message="Mapa indisponível agora."><Suspense fallback={<p role="status" className="ia-muted">Carregando satélite…</p>}><ElNinoOceanMap onData={setDataMar} onFalhou={() => setMarFalhou(true)} /></Suspense></MapErrorBoundary>}
        <div className="nino-legenda" aria-hidden="true"><span>mais frio</span><i /><span>mais quente que o normal</span></div>
      </li>
      <li>
        <h3><span>2</span> Os ventos mudam e trazem o efeito ao Brasil</h3>
        <p className="ia-muted">Previsão animada (modelo europeu ECMWF, via Windy). Troque entre ventos, temperatura e chuva.</p>
        <div className="cidade-escolha" role="group" aria-label="Camada do mapa animado">
          {camadasVento.map(c => <button key={c.id} type="button" className="cidade-chip" aria-pressed={camada === c.id} onClick={() => setCamada(c.id)}>{c.rotulo}</button>)}
        </div>
        <iframe className="nino-windy" title={`Mapa animado de ${camadasVento.find(c => c.id === camada)?.rotulo.toLowerCase()} sobre a América do Sul (Windy)`} src={urlWindy(camada)} loading="lazy" referrerPolicy="no-referrer" />
      </li>
      <li>
        <h3><span>3</span> O efeito no Brasil</h3>
        <svg className="nino-desenho" viewBox="0 0 640 270" role="img" aria-labelledby="nino-desenho-titulo">
          <title id="nino-desenho-titulo">Como o El Niño afeta o Brasil: Pacífico mais quente muda os ventos; Norte fica mais quente e seco; Sul recebe mais chuva.</title>
          <defs>
            <marker id="nino-seta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#475569" /></marker>
            <clipPath id="nino-clip-mar"><rect x="12" y="72" width="186" height="106" rx="12" /></clipPath>
          </defs>
          {/* Pacífico: caixa "respira" em vermelho e as ondas correm */}
          <rect className="nino-calor" x="10" y="70" width="190" height="110" rx="14" fill="#fee2e2" stroke="#dc2626" strokeWidth="2" />
          <g clipPath="url(#nino-clip-mar)">
            <path className="nino-onda" d="M-60 166 q15 -8 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="none" stroke="#f87171" strokeWidth="2.5" />
            <path className="nino-onda lenta" d="M-60 174 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="none" stroke="#fca5a5" strokeWidth="2" />
          </g>
          <text x="105" y="108" textAnchor="middle" fontSize="15" fontWeight="700" fill="#991b1b">Pacífico</text>
          <text x="105" y="130" textAnchor="middle" fontSize="13" fill="#7f1d1d">água mais quente</text>
          <text x="105" y="149" textAnchor="middle" fontSize="13" fill="#7f1d1d">que o normal</text>
          {/* Setas com o ar "andando" */}
          <path id="nino-c1" className="nino-fluxo" d="M205 110 C 280 60, 330 60, 395 70" fill="none" stroke="#475569" strokeWidth="3" markerEnd="url(#nino-seta)" />
          <text x="300" y="50" textAnchor="middle" fontSize="12" fill="#334155">ar descendente: menos chuva</text>
          <path id="nino-c2" className="nino-fluxo" d="M205 150 C 280 210, 330 210, 395 200" fill="none" stroke="#475569" strokeWidth="3" markerEnd="url(#nino-seta)" />
          <text x="290" y="236" textAnchor="middle" fontSize="12" fill="#334155">corrente de jato mais forte</text>
          <text x="290" y="252" textAnchor="middle" fontSize="12" fill="#334155">segura as frentes frias no Sul</text>
          {[0, 1, 2].map(i => <g key={i} className="nino-particula">
            <circle r="5" fill="#f97316"><animateMotion dur="3s" begin={`${-i}s`} repeatCount="indefinite"><mpath href="#nino-c1" /></animateMotion></circle>
            <circle r="5" fill="#0ea5e9"><animateMotion dur="3s" begin={`${-i - 0.5}s`} repeatCount="indefinite"><mpath href="#nino-c2" /></animateMotion></circle>
          </g>)}
          {/* Norte e Nordeste: sol girando */}
          <rect x="400" y="20" width="230" height="100" rx="14" fill="#ffedd5" stroke="#ea580c" strokeWidth="2" />
          <g className="nino-sol">
            <circle cx="430" cy="48" r="9" fill="#f59e0b" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map(g => <line key={g} x1="430" y1="34" x2="430" y2="29" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${g} 430 48)`} />)}
          </g>
          <text x="525" y="58" textAnchor="middle" fontSize="15" fontWeight="700" fill="#9a3412">Norte e Nordeste</text>
          <text x="525" y="82" textAnchor="middle" fontSize="13" fill="#7c2d12">mais calor e seca,</text>
          <text x="525" y="100" textAnchor="middle" fontSize="13" fill="#7c2d12">mais risco de queimadas</text>
          {/* Sul: nuvem com chuva caindo */}
          <rect x="400" y="140" width="230" height="100" rx="14" fill="#e0f2fe" stroke="#0284c7" strokeWidth="2" />
          <path d="M418 172 a8 8 0 0 1 8 -9 a10 10 0 0 1 19 3 a7 7 0 0 1 0 14 h-27 a7 7 0 0 1 0 -8z" fill="#64748b" />
          {[421, 430, 439].map((x, i) => <line key={x} className="nino-gota" style={{ animationDelay: `${i * 0.25}s` }} x1={x} y1="184" x2={x - 2} y2="192" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />)}
          <text x="525" y="178" textAnchor="middle" fontSize="15" fontWeight="700" fill="#075985">Sul</text>
          <text x="525" y="202" textAnchor="middle" fontSize="13" fill="#0c4a6e">chuva acima do normal,</text>
          <text x="525" y="220" textAnchor="middle" fontSize="13" fill="#0c4a6e">risco de enchentes</text>
        </svg>
        <p className="ia-muted">Abaixo, a previsão real dos próximos dias nessas regiões.</p>
      </li>
    </ol>
  </section>
}
