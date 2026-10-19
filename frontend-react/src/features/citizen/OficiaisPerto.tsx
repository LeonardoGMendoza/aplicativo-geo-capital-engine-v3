// Tela do cidadão: locais OFICIAIS da Defesa Civil perto da pessoa (abrigos e pontos de encontro com status)
// e aviso se ela estiver perto de uma área de risco cadastrada. Aparece antes dos pontos do OpenStreetMap.
import { useEffect, useState } from 'react'
import { formatDistance, routeLinks } from '../shelters/places'
import type { Coordinates } from '../shelters/places'
import { listarOficiais, STATUS_OFICIAL, TIPOS_OFICIAIS } from '../shelters/abrigosOficiais'
import type { LocalOficial } from '../shelters/abrigosOficiais'
import { minutosAPe } from './dicas'
import { areasEmVolta, areasNoCaminho } from '../operations/data/rota'
import type { AreaRisco } from '../operations/data/rota'

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
  // Como o guia de Hiroshima: primeiro o local aberto mais perto cujo caminho não atravessa área de risco.
  const areas: AreaRisco[] = itens.filter(i => i.tipo === 'area_risco').map(i => ({ id: i.id, nome: i.nome, latitude: i.latitude, longitude: i.longitude, raioM: i.raioM ?? 300 }))
  const ondeEstou = new Set(areasEmVolta(origem, areas).map(a => a.id))
  const evitar = areas.filter(a => !ondeEstou.has(a.id))
  const riscoNoCaminho = (l: LocalOficial) => areasNoCaminho([[origem.latitude, origem.longitude], [l.latitude, l.longitude]], evitar.filter(a => !areasEmVolta(l, [a]).length))
  const locais = itens.filter(i => i.tipo !== 'area_risco').map(l => ({ l, cruza: riscoNoCaminho(l) }))
    .sort((a, b) => Number(a.l.status === 'fechado') - Number(b.l.status === 'fechado') || Number(a.cruza.length > 0) - Number(b.cruza.length > 0) || (a.l.distanciaKm ?? 0) - (b.l.distanciaKm ?? 0)).slice(0, 3)
  if (!riscos.length && !locais.length) return null

  return <section aria-labelledby="citizen-oficiais" className="citizen-card citizen-oficiais">
    <h2 id="citizen-oficiais" className="citizen-title">✅ Locais oficiais da Defesa Civil</h2>
    {riscos.map(r => <p key={r.id} role="alert" className="citizen-risco">{`⚠️ Você está perto de uma área de risco: ${r.nome}. Se puder, saia da área e siga as orientações da Defesa Civil.`}</p>)}
    {locais.map(({ l, cruza }) => <div key={l.id} className="citizen-oficial">
      <div className="citizen-oficial-topo">
        <p className="citizen-oficial-nome">{TIPOS_OFICIAIS.find(t => t.id === l.tipo)?.emoji} {l.nome}</p>
        <span className="citizen-oficial-status" style={{ color: STATUS_OFICIAL[l.status].cor, background: STATUS_OFICIAL[l.status].fundo }}>{STATUS_OFICIAL[l.status].nome}</span>
      </div>
      <p className="citizen-oficial-tipo">{l.tipoNome}</p>
      {typeof l.distanciaKm === 'number' && <p className="citizen-walk">{`${formatDistance(l.distanciaKm)} · 🚶 cerca de ${minutosAPe(l.distanciaKm)} min a pé`}</p>}
      {l.endereco && <p className="citizen-address">📍 {l.endereco}</p>}
      {cruza.length > 0 && <p className="citizen-risco">{`⚠️ O caminho até aqui pode passar pela área de risco ${cruza.map(a => a.nome).join(', ')}. Prefira outro local ou confirme no 199.`}</p>}
      {l.status !== 'fechado' && <div className="citizen-oficial-rotas">
        <a className="citizen-route citizen-route-waze" href={routeLinks(l).waze} target="_blank" rel="noopener noreferrer">🚗 Ir pelo Waze</a>
        <a className="citizen-route citizen-route-google" href={routeLinks(l).google} target="_blank" rel="noopener noreferrer">🗺️ Ir pelo Google Maps</a>
      </div>}
    </div>)}
    <p className="citizen-small">Cadastrados pela Defesa Civil. O status pode mudar: em caso de dúvida, ligue 199.</p>
  </section>
}
