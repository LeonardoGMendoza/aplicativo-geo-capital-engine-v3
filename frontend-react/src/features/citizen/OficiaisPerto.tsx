// Tela do cidadão: locais OFICIAIS da Defesa Civil perto da pessoa (abrigos e pontos de encontro com status)
// e aviso se ela estiver perto de uma área de risco cadastrada. Aparece antes dos pontos do OpenStreetMap.
import { useEffect, useState } from 'react'
import { formatDistance, routeLinks } from '../shelters/places'
import type { Coordinates } from '../shelters/places'
import { listarOficiais, STATUS_OFICIAL, TIPOS_OFICIAIS } from '../shelters/abrigosOficiais'
import type { LocalOficial } from '../shelters/abrigosOficiais'
import { minutosAPe } from './dicas'

const RAIO_KM = 30

export function OficiaisPerto({ origem }: { origem: Coordinates }) {
  const [itens, setItens] = useState<LocalOficial[] | null>(null)
  useEffect(() => {
    const abort = new AbortController()
    setItens(null)
    listarOficiais(origem, RAIO_KM, { signal: abort.signal }).then(l => { if (!abort.signal.aborted) setItens(l) }).catch(() => { if (!abort.signal.aborted) setItens([]) })
    return () => abort.abort()
  }, [origem.latitude, origem.longitude])

  if (!itens || itens.length === 0) return null
  const riscos = itens.filter(i => i.tipo === 'area_risco' && typeof i.distanciaKm === 'number' && i.distanciaKm * 1000 <= (i.raioM ?? 300) + 500)
  const locais = itens.filter(i => i.tipo !== 'area_risco')
    .sort((a, b) => Number(a.status === 'fechado') - Number(b.status === 'fechado') || (a.distanciaKm ?? 0) - (b.distanciaKm ?? 0)).slice(0, 3)
  if (!riscos.length && !locais.length) return null

  return <section aria-labelledby="citizen-oficiais" className="citizen-card citizen-oficiais">
    <h2 id="citizen-oficiais" className="citizen-title">✅ Locais oficiais da Defesa Civil</h2>
    {riscos.map(r => <p key={r.id} role="alert" className="citizen-risco">{`⚠️ Você está perto de uma área de risco: ${r.nome}. Se puder, saia da área e siga as orientações da Defesa Civil.`}</p>)}
    {locais.map(l => <div key={l.id} className="citizen-oficial">
      <div className="citizen-oficial-topo">
        <p className="citizen-oficial-nome">{TIPOS_OFICIAIS.find(t => t.id === l.tipo)?.emoji} {l.nome}</p>
        <span className="citizen-oficial-status" style={{ color: STATUS_OFICIAL[l.status].cor, background: STATUS_OFICIAL[l.status].fundo }}>{STATUS_OFICIAL[l.status].nome}</span>
      </div>
      <p className="citizen-oficial-tipo">{l.tipoNome}</p>
      {typeof l.distanciaKm === 'number' && <p className="citizen-walk">{`${formatDistance(l.distanciaKm)} · 🚶 cerca de ${minutosAPe(l.distanciaKm)} min a pé`}</p>}
      {l.endereco && <p className="citizen-address">📍 {l.endereco}</p>}
      {l.status !== 'fechado' && <div className="citizen-oficial-rotas">
        <a className="citizen-route citizen-route-waze" href={routeLinks(l).waze} target="_blank" rel="noopener noreferrer">🚗 Ir pelo Waze</a>
        <a className="citizen-route citizen-route-google" href={routeLinks(l).google} target="_blank" rel="noopener noreferrer">🗺️ Ir pelo Google Maps</a>
      </div>}
    </div>)}
    <p className="citizen-small">Cadastrados pela Defesa Civil. O status pode mudar: em caso de dúvida, ligue 199.</p>
  </section>
}
