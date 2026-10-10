import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useNasaSession } from '../nasa/NasaSession'
import { getAssets } from '../nasa/proximity'
import type { AssetCatalog } from '../nasa/proximity'
import { formatObservation } from '../nasa/geography'
import { useCorporateScreening } from '../corporate/useCorporateScreening'
import { CommunityReferenceList } from './components/CommunityReferenceList'
import { CommunityContextPanel } from './components/CommunityContextPanel'
import { PreparationGuidance } from './components/PreparationGuidance'
import { searchReferences, selectReference } from './reference'

const GeographicMap = lazy(() => import('../nasa/NasaGeographicMap'))
const emptyAssets: AssetCatalog['assets'] = []
class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <p role="alert">Mapa indisponível. Consulte as coordenadas e o resultado no contexto textual da referência.</p> : this.props.children }
}

export function CommunityPage() {
  const nasa = useNasaSession()
  const [catalog, setCatalog] = useState<AssetCatalog | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focus, setFocus] = useState<'asset' | 'event'>('asset')
  const mapSection = useRef<HTMLElement>(null)
  const assets = catalog?.assets ?? emptyAssets
  const asset = selectReference(assets, selectedId)
  const usable = nasa.mode === 'nasa' && !nasa.loading && !!nasa.result?.fetchedAt && ['success', 'empty'].includes(nasa.result.state)
  const screening = useCorporateScreening(asset ? [asset.id] : [], usable ? nasa.result!.fetchedAt : null, catalog?.datasetVersion ?? '')
  useEffect(() => {
    const abort = new AbortController()
    setCatalog(null); setCatalogLoading(true); setCatalogError(null)
    getAssets({ signal: abort.signal }).then(data => { if (!abort.signal.aborted) setCatalog(data) }).catch(() => { if (!abort.signal.aborted) setCatalogError('Não foi possível carregar as referências da API. Tente novamente.') }).finally(() => { if (!abort.signal.aborted) setCatalogLoading(false) })
    return () => abort.abort()
  }, [attempt])
  const visible = searchReferences(assets, search)
  const match = screening.result?.matches.find(m => m.asset.id === asset?.id)
  function select(id: string) { screening.invalidate(); setSelectedId(id); setFocus('asset') }
  function focusMap(kind: 'asset' | 'event') { setFocus(kind); mapSection.current?.scrollIntoView({ block: 'start' }); mapSection.current?.focus({ preventScroll: true }) }
  return <div className="min-w-0 space-y-5">
    <header><p className="text-xs font-semibold text-[#25d3b6]">OMNI-ECORESCUE / V3</p><h1 className="mt-1 text-2xl font-semibold">Impacto Social</h1><p className="mt-2 text-sm text-[#b5d2e2]">Contexto comunitário de referência e preparação geral.</p></header>
    <section className="light-panel space-y-3 p-4" aria-labelledby="community-nasa"><h2 id="community-nasa" className="text-base font-semibold">Contexto dos eventos NASA</h2>
      <p className="text-sm">Descrições comunitárias do cadastro de referência · registros reais NASA EONET. Não há avaliação comunitária nesta tela.</p>
      <p role="status" className="text-sm">{nasa.loading ? 'Consultando eventos NASA…' : nasa.mode !== 'nasa' || !nasa.result ? 'Eventos NASA não consultados.' : `Fonte: ${nasa.result.source} · estado: ${nasa.result.state} · qualidade: ${nasa.result.dataQuality} · obtenção: ${formatObservation(nasa.result.fetchedAt)}`}</p>
      {nasa.error && <p role="alert" className="text-sm text-amber-900">{nasa.error}</p>}
      {nasa.mode === 'nasa' && nasa.result && !usable && !nasa.loading && <p role="alert" className="text-sm text-amber-900">Consulta desatualizada ou indisponível. Atualize NASA antes da triagem; as referências continuam acessíveis.</p>}
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={nasa.loading} onClick={() => { screening.invalidate(); nasa.refresh() }}>Atualizar eventos NASA</Button><Button asChild variant="outline"><Link to="/mapa">Explorar eventos NASA</Link></Button></div>
    </section>
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
      <section className="light-panel min-w-0 space-y-3 p-4" aria-labelledby="community-references"><h2 id="community-references" className="text-base font-semibold">Referências comunitárias</h2><label className="block text-sm">Buscar referência ou ativo<input className="mini-select mt-1 w-full" value={search} onChange={e => setSearch(e.target.value)} placeholder="Descrição comunitária ou ativo…" /></label>
        <p className="text-xs text-muted-foreground">{catalog ? `${visible.length} de ${assets.length} descrições associadas a ativos · ${catalog.datasetVersion}` : 'Cadastro não consultado'}. Não representa uma contagem de comunidades verificadas.</p>
        {catalogLoading && <p role="status">Carregando referências…</p>}{catalogError && <div role="alert" className="space-y-2 text-sm"><p>{catalogError}</p><Button variant="outline" onClick={() => setAttempt(n => n + 1)}>Tentar novamente</Button></div>}
        {catalog && <CommunityReferenceList assets={visible} selectedId={asset?.id ?? null} onSelect={select} />}
      </section>
      <div className="min-w-0 space-y-4"><CommunityContextPanel asset={asset} result={screening.result} loading={screening.loading} error={screening.error} />
        <section className="light-panel space-y-3 p-4" aria-label="Consulta do ativo associado"><Button className="h-auto min-h-11 whitespace-normal text-left" disabled={!asset || !usable || screening.loading} onClick={() => void screening.consult()}>{screening.loading ? 'Consultando proximidade do ativo…' : 'Consultar proximidade do ativo associado'}</Button><p className="text-xs text-muted-foreground">Consulta somente o ativo selecionado e considera todo o catálogo NASA. Retorna o evento mais próximo a menos de 600 km; os filtros do explorador não alteram essa regra.</p></section>
      </div>
    </div>
    <section ref={mapSection} tabIndex={-1} className="light-panel min-w-0 space-y-3 p-4" aria-labelledby="community-map"><h2 id="community-map" className="text-base font-semibold">Contexto geográfico do ativo associado</h2><p className="text-xs text-muted-foreground">◆ Ativo de referência · círculo: evento NASA correspondente. Não há marcadores ou zonas comunitárias.</p>
      {!asset ? <p className="text-sm">Selecione uma referência para visualizar as coordenadas de seu ativo associado.</p> : <><MapBoundary key={asset.id}><Suspense fallback={<p role="status">Carregando mapa; coordenadas e resultados permanecem disponíveis no contexto textual.</p>}><GeographicMap assets={[asset]} events={match ? [match.event] : []} selectedAssetId={focus === 'asset' || !match ? asset.id : null} selectedId={focus === 'event' ? match?.event.id ?? null : null} onAssetSelect={() => setFocus('asset')} onSelect={() => setFocus('event')} /></Suspense></MapBoundary><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => focusMap('asset')}>Ver ativo no mapa</Button>{match && <Button variant="outline" onClick={() => focusMap('event')}>Ver evento no mapa</Button>}</div></>}
    </section>
    <PreparationGuidance />
    <section className="light-panel space-y-3 p-4" aria-labelledby="community-limits"><h2 id="community-limits" className="text-base font-semibold">Limites e qualidade dos dados</h2><p className="text-sm">Disponível: descrição comunitária, ativo associado, coordenadas do ativo e registros NASA consultados.</p><p className="text-sm">Não disponível: localização comunitária verificada, população, indicadores de vulnerabilidade, avaliação local, contatos institucionais ou disponibilidade de pontos de apoio.</p><p className="text-xs text-muted-foreground">Descrições repetidas continuam vinculadas a seus próprios ativos. Nenhuma comunicação ou ação operacional é executada. A lista e o contexto textual independem da base cartográfica.</p></section>
  </div>
}
