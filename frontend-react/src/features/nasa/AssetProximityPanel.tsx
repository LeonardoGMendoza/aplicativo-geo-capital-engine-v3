import { useEffect, useState } from 'react'
import type { Asset, ProximityResult } from './proximity'
import { getAssets, getProximity } from './proximity'
import { formatObservation, observationLabel } from './geography'
const stateLabels = { success: 'Triagem concluída', empty: 'Sem correspondências na consulta válida', partial: 'Triagem parcial', blocked: 'Triagem bloqueada', unavailable: 'Triagem indisponível' }
export function AssetProximityPanel({ fetchedAt, usable, selectedId, onAssets, onSelected }: { fetchedAt: string | null; usable: boolean; selectedId: string | null; onAssets: (assets: Asset[]) => void; onSelected: (id: string | null) => void }) {
  const [show, setShow] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const selected = selectedId ?? ''
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [requested, setRequested] = useState(false)
  const [result, setResult] = useState<ProximityResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!show) { onAssets([]); onSelected(null); return }
    const controller = new AbortController()
    setCatalogLoading(true); setError(null)
    getAssets({ signal: controller.signal }).then(data => { if (!controller.signal.aborted) { setAssets(data.assets); onAssets(data.assets) } }).catch(() => { if (!controller.signal.aborted) setError('Não foi possível carregar os ativos do MVP. Verifique a API.') }).finally(() => { if (!controller.signal.aborted) setCatalogLoading(false) })
    return () => controller.abort()
  }, [show, onAssets, onSelected])
  useEffect(() => {
    setResult(null); setError(null)
    if (!requested || !show || !selected || !fetchedAt || !usable) { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    getProximity(selected, fetchedAt, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setResult(data) }).catch(() => { if (!controller.signal.aborted) setError('Triagem indisponível. Falha de consulta não significa ausência de proximidade ou risco.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt, selected, fetchedAt, usable, show, requested])
  return <section className="mt-3 space-y-2 rounded border border-primary/30 p-3" aria-label="Triagem geográfica de ativos do MVP">
    <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={show} onChange={e => { setShow(e.target.checked); setRequested(false) }} />Visualizar ativos cadastrados no MVP · símbolo ◆</label>
    <p>Cadastro de referência, sem verificação operacional. Triagem geográfica não é avaliação de segurança e não define rotas de evacuação.</p>
    {show && <><label className="block">Ativo do MVP<select aria-label="Ativo do MVP" className="mini-select mt-1 w-full" value={selected} onChange={e => { onSelected(e.target.value || null); setRequested(false) }}><option value="">Selecione um ativo</option>{assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      {selected && <p>Origem: frontend/painel_ceo.py · coordenadas de referência do ativo. A descrição da comunidade não fornece sua localização.</p>}
      <button className="mini-select" disabled={loading || catalogLoading || !selected || !usable || !fetchedAt} onClick={() => { setRequested(true); setAttempt(n => n + 1) }}>Consultar proximidade</button>
      <p>Regra do painel: evento mais próximo por ativo, distância estritamente menor que 600 km. A consulta considera todo o catálogo NASA, independentemente dos filtros visuais.</p>
      {!usable && <p role="alert">Atualize uma consulta NASA válida antes da triagem.</p>}
      {(loading || catalogLoading) && <p role="status">Consultando cadastro ou triagem…</p>}{error && <p role="alert" className="text-amber-900">{error}</p>}
      {result && <div role={result.state === 'blocked' || result.state === 'unavailable' ? 'alert' : 'status'} className="space-y-1"><p>{stateLabels[result.state]} · pares avaliados: {result.evaluatedPairCount} · consulta NASA: {formatObservation(result.eventsFetchedAt)} · análise: {formatObservation(result.analyzedAt)}</p>
        {result.matches.map(m => <div key={m.event.id} className="rounded border bg-white p-2"><strong>{m.event.title} · {m.distanceKm.toFixed(2)} km</strong><p>{m.event.id} · {m.event.categories.map(c => c.title).join(', ') || 'Categoria ausente'} · {m.event.source}</p><p>{observationLabel(m.event)} · {formatObservation(m.event.observedAt)}</p><p>Lat/Lon: {m.event.coordinates?.latitude.toFixed(4)}, {m.event.coordinates?.longitude.toFixed(4)}</p>{m.geometryApproximate && <p>Geometria aproximada: primeiro vértice do polígono, sem cálculo de centroide ou borda.</p>}</div>)}
        {result.state === 'empty' && <p>Nenhum evento selecionado pela regra nesta consulta válida. Isso não significa ausência de risco.</p>}
        {result.state === 'partial' && !result.matches.length && <p>Nenhuma correspondência entre os eventos utilizáveis; análise parcial.</p>}
        <p>Regra aplicada: {result.policy.id}. Decisões futuras exigem confirmação humana.</p>{result.warnings.map(w => <p key={w} className="text-amber-900">{w}</p>)}
        {result.skipped.length > 0 && <details><summary>{result.skipped.length} evento(s) ignorado(s) por localização ausente/inadequada</summary>{result.skipped.map(e => <p key={e.eventId}>{e.eventId}: {e.reason}</p>)}</details>}
      </div>}
    </>}
  </section>
}
