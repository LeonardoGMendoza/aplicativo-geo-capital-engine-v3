import { useEffect, useState } from 'react'
import { MapContainer, Rectangle, TileLayer, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { dataBR, datasAnimacao, NINO34, urlAnomaliaMar } from './elNino'

const semMovimento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Satélite da NASA: anomalia da temperatura do mar, animada nos últimos ~60 dias (imagens reais, uma a cada 5 dias).
 * Vermelho = mais quente que o normal (o El Niño é a faixa no Pacífico equatorial).
 */
export default function ElNinoOceanMap({ onData, onFalhou }: { onData: (data: string) => void; onFalhou: () => void }) {
  const [atraso, setAtraso] = useState(2)
  const datas = datasAnimacao(atraso)
  const ultimo = datas.length - 1
  const [indice, setIndice] = useState(ultimo)
  const [tocando, setTocando] = useState(() => !semMovimento())
  const [prontas, setProntas] = useState<Set<string>>(() => new Set())

  // Avança só por imagens já carregadas (sem piscar em branco); para um pouco na imagem mais nova.
  useEffect(() => {
    if (!tocando) return
    const id = setInterval(() => setIndice(i => {
      for (let passo = 1; passo <= datas.length; passo++) {
        const proximo = (i + passo) % datas.length
        if (prontas.has(datas[proximo])) return proximo
      }
      return i
    }), indice === ultimo ? 1800 : 650)
    return () => clearInterval(id)
  }, [tocando, indice, prontas, atraso])

  const atual = datas[Math.min(indice, ultimo)]
  useEffect(() => { if (prontas.has(atual)) onData(atual) }, [atual, prontas, onData])

  function carregou(data: string) { setProntas(p => (p.has(data) ? p : new Set(p).add(data))) }
  function erroNaMaisNova() {
    if (atraso < 5) setAtraso(a => a + 1) // dia ainda não publicado: tenta o anterior
    else onFalhou()
  }

  return <div className="nino-mapa">
    <MapContainer center={[-5, -105]} zoom={2} minZoom={2} maxZoom={7} worldCopyJump scrollWheelZoom={false} className="h-full w-full">
      <TileLayer className="nino-base" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
      {datas.map((data, i) => <TileLayer key={data} url={urlAnomaliaMar(data)} maxNativeZoom={7} maxZoom={7}
        opacity={data === atual ? 0.9 : 0} zIndex={data === atual ? 3 : 2}
        attribution={i === ultimo ? 'Temperatura do mar: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a> / GHRSST MUR' : undefined}
        eventHandlers={{ load: () => carregou(data), ...(i === ultimo ? { tileerror: erroNaMaisNova } : {}) }} />)}
      <Rectangle bounds={NINO34} pathOptions={{ color: '#ffffff', weight: 2, dashArray: '6 4', fillOpacity: 0, className: 'nino-pulso' }}>
        <Tooltip permanent direction="top" className="nino-rotulo">Região Niño 3.4 · onde se mede o El Niño</Tooltip>
      </Rectangle>
    </MapContainer>
    <div className="nino-filme">
      <button type="button" className="nino-play" onClick={() => setTocando(t => !t)} aria-pressed={tocando}>{tocando ? '❚❚ Pausar' : '▶ Animar'}</button>
      <input type="range" min={0} max={ultimo} value={indice} aria-label="Data da imagem do satélite"
        aria-valuetext={dataBR(atual)} onChange={e => { setTocando(false); setIndice(Number(e.target.value)) }} />
      <output className="nino-data" aria-live="off">{dataBR(atual)}{indice === ultimo && <span className="nino-recente"> · mais recente</span>}</output>
    </div>
  </div>
}
