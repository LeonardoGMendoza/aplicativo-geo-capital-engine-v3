import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useNasaSession } from '../nasa/NasaSession'
import { getAssets } from '../nasa/proximity'
import type { AssetCatalog } from '../nasa/proximity'
import { formatObservation } from '../nasa/geography'
import { CorporateAssetList } from './components/CorporateAssetList'
import { CorporateAssetDetails } from './components/CorporateAssetDetails'
import { completed, visibleAssets } from './screening'
import { useCorporateScreening } from './useCorporateScreening'

const GeographicMap = lazy(() => import('../nasa/NasaGeographicMap'))
const states = { success: 'Triagem concluída', empty: 'Consulta completa sem correspondências', partial: 'Resultado parcial', blocked: 'Consulta bloqueada · atualize os eventos NASA', unavailable: 'Fonte indisponível' }
const emptyAssets: AssetCatalog['assets'] = []

export function CorporatePage() {
  const nasa = useNasaSession()
  const [catalog, setCatalog] = useState<AssetCatalog | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState('name')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focus, setFocus] = useState<'asset' | 'event'>('asset')
  const mapSection = useRef<HTMLElement>(null)
  const assets = catalog?.assets ?? emptyAssets
  const usable = nasa.mode === 'nasa' && !nasa.loading && !!nasa.result?.fetchedAt && (nasa.result.state === 'success' || nasa.result.state === 'empty')
  const ids = useMemo(() => assets.map(a => a.id), [assets])
  const screening = useCorporateScreening(ids, usable ? nasa.result!.fetchedAt : null, catalog?.datasetVersion ?? '')
  useEffect(() => {
    const abort = new AbortController()
    setCatalogLoading(true); setCatalogError(null); setCatalog(null)
    getAssets({ signal: abort.signal }).then(data => { if (!abort.signal.aborted) setCatalog(data) }).catch(() => { if (!abort.signal.aborted) setCatalogError('Cadastro indisponível. Verifique a API e tente novamente.') }).finally(() => { if (!abort.signal.aborted) setCatalogLoading(false) })
    return () => abort.abort()
  }, [attempt])
  const result = screening.result
  const evaluated = completed(result)
  const pendingValue = screening.loading ? 'Consultando' : screening.error || result?.state === 'unavailable' ? 'Indisponível' : result?.state === 'blocked' ? 'Bloqueado' : 'Não consultado'
  const visible = visibleAssets(assets, query, order, result)
  const selected = assets.find(a => a.id === selectedId)
  const match = result?.matches.find(m => m.asset.id === selectedId)
  const events = useMemo(() => [...new Map(result?.matches.map(m => [m.event.id, m.event]) ?? []).values()], [result])
  function selectAsset(id: string) { setSelectedId(id); setFocus('asset') }
  function refreshNasa() { screening.invalidate(); nasa.refresh() }
  return <div className="min-w-0 space-y-5">
    <header><p className="text-xs font-semibold text-[#25d3b6]">OMNI-ECORESCUE / V3</p><h1 className="mt-1 text-2xl font-semibold">Visão Corporativa</h1><p className="mt-2 text-sm text-[#b5d2e2]">Ativos de referência e triagem geográfica com eventos NASA.</p></header>
    <section className="light-panel space-y-3 p-4" aria-labelledby="corporate-context"><h2 id="corporate-context" className="text-base font-semibold">Contexto da consulta NASA</h2>
      <p className="text-sm">Proximidade geográfica não confirma risco ou segurança. Decisões exigem avaliação humana.</p>
      <p className="text-xs text-muted-foreground">Cadastro do MVP sem verificação operacional · eventos reais NASA EONET · sem indicadores simulados nesta tela.</p>
      <p role="status" className="text-sm">{nasa.loading ? 'Consultando eventos NASA…' : nasa.mode !== 'nasa' || !nasa.result ? 'Eventos NASA não consultados nesta tela.' : `Fonte: ${nasa.result.source} · estado: ${nasa.result.state} · qualidade: ${nasa.result.dataQuality} · consulta: ${formatObservation(nasa.result.fetchedAt)}`}</p>
      {nasa.error && <p role="alert" className="text-sm text-amber-900">{nasa.error}</p>}
      {!nasa.loading && nasa.result && nasa.mode === 'nasa' && !usable && <p role="alert" className="text-sm text-amber-900">Consulta NASA indisponível ou desatualizada. O cadastro permanece acessível; atualize antes da triagem.</p>}
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={nasa.loading || screening.loading} onClick={refreshNasa}>Atualizar eventos NASA</Button><Button disabled={!usable || catalogLoading || assets.length !== 11 || screening.loading} onClick={() => void screening.consult()}>{screening.loading ? 'Consultando proximidade…' : 'Consultar proximidade dos 11 ativos'}</Button></div>
      <p className="text-xs text-muted-foreground">Evento mais próximo por ativo, a menos de 600 km. Considera todo o catálogo NASA, independentemente dos filtros do explorador.</p>
    </section>
    <div className="grid min-w-0 gap-3 sm:grid-cols-3">{[{ label: 'Ativos cadastrados', value: catalog ? assets.length : 'Não consultado' }, { label: 'Ativos avaliados', value: evaluated ? assets.length : pendingValue }, { label: 'Ativos com correspondência', value: evaluated ? result!.matches.length : pendingValue }].map(item => <div key={item.label} className="light-panel min-w-0 p-4"><p className="text-sm text-muted-foreground">{item.label}</p><p className="mt-2 break-words text-xl font-semibold">{item.value}</p>{evaluated && result?.state === 'partial' && item.label !== 'Ativos cadastrados' && <p className="mt-1 text-xs text-amber-900">Entre eventos utilizáveis · resultado parcial</p>}</div>)}</div>
    {catalogLoading && <p role="status">Carregando cadastro de referência…</p>}
    {catalogError && <div role="alert" className="light-panel space-y-2 p-4"><p>{catalogError}</p><Button variant="outline" onClick={() => setAttempt(n => n + 1)}>Tentar carregar cadastro</Button></div>}
    {catalog && assets.length !== 11 && <p role="alert">O catálogo retornou {assets.length} ativos; a triagem dos 11 ativos está bloqueada. Atualize o cadastro antes de continuar.</p>}
    {screening.error && <p role="alert" className="light-panel p-4 text-sm text-amber-900">{screening.error}</p>}
    {result && <section className="light-panel space-y-2 p-4 text-sm" aria-label="Resultado e qualidade da triagem"><p role={result.state === 'blocked' || result.state === 'unavailable' ? 'alert' : 'status'} className="font-semibold">{states[result.state]}</p><p>Consulta NASA: {formatObservation(result.eventsFetchedAt)} · análise: {formatObservation(result.analyzedAt)} · pares avaliados: {result.evaluatedPairCount}</p>{result.warnings.map(w => <p key={w} className="text-amber-900">{w}</p>)}{result.skipped.length > 0 && <details><summary className="cursor-pointer py-3">{result.skipped.length} evento(s) omitido(s) por localização inadequada</summary><div className="max-h-48 overflow-y-auto break-words">{result.skipped.map(s => <p key={s.eventId}>{s.eventId}: {s.reason}</p>)}</div></details>}</section>}
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
      <section ref={mapSection} tabIndex={-1} className="light-panel min-w-0 space-y-3 p-4" aria-labelledby="corporate-map"><h2 id="corporate-map" className="text-base font-semibold">Mapa de ativos e correspondências</h2><p className="text-xs text-muted-foreground">◆ Ativo de referência · círculos: eventos correspondentes da NASA. Um evento pode corresponder a vários ativos.</p><Suspense fallback={<p role="status">Carregando mapa…</p>}><GeographicMap assets={assets} events={events} selectedAssetId={focus === 'asset' && selected ? selected.id : null} selectedId={focus === 'event' ? match?.event.id ?? null : null} onAssetSelect={selectAsset} onSelect={id => { const target = result?.matches.find(m => m.event.id === id && m.asset.id === selectedId) ?? result?.matches.find(m => m.event.id === id); if (target) { setSelectedId(target.asset.id); setFocus('event') } }} /></Suspense><p className="text-xs text-muted-foreground">{evaluated ? events.length : pendingValue} · correspondências no mapa · cadastro: {catalog?.datasetVersion ?? 'Não consultado'}.</p></section>
      <section className="light-panel min-w-0 space-y-3 p-4" aria-labelledby="corporate-assets"><h2 id="corporate-assets" className="text-base font-semibold">Ativos de referência</h2><label className="block text-sm">Buscar ativo<input className="mini-select mt-1 w-full" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome do ativo…" /></label><label className="block text-sm">Ordenar<select className="mini-select mt-1 w-full" value={order} onChange={e => setOrder(e.target.value)}><option value="name">Nome</option><option value="distance">Distância · correspondências primeiro</option></select></label><p className="text-xs text-muted-foreground">{visible.length} de {assets.length} ativos · a busca não altera o escopo da triagem.</p><CorporateAssetList assets={visible} selectedId={selectedId} result={result} loading={screening.loading} failed={!!screening.error} onSelect={selectAsset} /></section>
    </div>
    <section className="light-panel min-w-0 space-y-3 p-4" aria-labelledby="corporate-details"><h2 id="corporate-details" className="text-base font-semibold">Detalhes do ativo selecionado</h2><CorporateAssetDetails asset={selected} result={result} loading={screening.loading} failed={!!screening.error} onFocus={kind => { setFocus(kind); mapSection.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); mapSection.current?.focus({ preventScroll: true }) }} /></section>
  </div>
}
