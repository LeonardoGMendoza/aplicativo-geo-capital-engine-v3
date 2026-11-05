import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { geocode } from '../shelters/places'
import type { GeocodeResult } from '../shelters/places'
import { lerTodos } from '../preparar/locaisSalvos'
import type { Lugar } from './meusLugares'
import { adicionarLugar, gravarLugares, lerLugares, MAX_LUGARES, migrarDeLocaisGuardados, paisDoEndereco, removerLugar } from './meusLugares'
import './lugares.css'

const EVENTO = 'omni-lugares-mudaram'

/** Lista "Meus lugares" compartilhada entre as telas (Mapa de Riscos e Preparar), sempre do aparelho. */
export function useMeusLugares() {
  const [lugares, setLugares] = useState<Lugar[]>(() => {
    const atuais = lerLugares()
    if (atuais.length) return atuais
    const migrados = migrarDeLocaisGuardados([], lerTodos())
    if (migrados.length) gravarLugares(migrados)
    return migrados
  })
  useEffect(() => {
    const recarregar = () => setLugares(lerLugares())
    window.addEventListener(EVENTO, recarregar); window.addEventListener('storage', recarregar)
    return () => { window.removeEventListener(EVENTO, recarregar); window.removeEventListener('storage', recarregar) }
  }, [])
  const atualizar = useCallback((lista: Lugar[]) => { gravarLugares(lista); setLugares(lista); window.dispatchEvent(new Event(EVENTO)) }, [])
  return [lugares, atualizar] as const
}

export function MeusLugaresEditor({ lugares, onChange, aberto = false }: { lugares: Lugar[]; onChange: (l: Lugar[]) => void; aberto?: boolean }) {
  const [texto, setTexto] = useState('')
  const [achados, setAchados] = useState<GeocodeResult[]>([])
  const [msg, setMsg] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const cheio = lugares.length >= MAX_LUGARES

  async function buscar(e: FormEvent) {
    e.preventDefault()
    setOcupado(true); setMsg(''); setAchados([])
    try {
      const r = await geocode(texto)
      setAchados(r)
      if (!r.length) setMsg('Nenhuma cidade encontrada com esse nome.')
    } catch (erro) { setMsg(erro instanceof Error ? erro.message : 'Busca indisponível agora.') } finally { setOcupado(false) }
  }
  function escolher(r: GeocodeResult) {
    onChange(adicionarLugar(lugares, { nome: r.name, pais: paisDoEndereco(r.displayName), latitude: r.coordinates.latitude, longitude: r.coordinates.longitude }))
    setAchados([]); setTexto('')
  }
  function ondeEstou() {
    if (!('geolocation' in navigator)) { setMsg('Este aparelho não informa a localização.'); return }
    setMsg('Procurando sua posição…')
    navigator.geolocation.getCurrentPosition(p => {
      onChange(adicionarLugar(lugares, { nome: 'Onde eu moro', pais: null, latitude: p.coords.latitude, longitude: p.coords.longitude }))
      setMsg('')
    }, () => setMsg('Não deu para pegar a localização. Busque a cidade pelo nome.'), { enableHighAccuracy: false, timeout: 30_000, maximumAge: 10 * 60_000 })
  }

  return <details className="lug-editor" open={aberto || lugares.length === 0}>
    <summary>✏️ {lugares.length ? `Editar meus lugares (${lugares.length}/${MAX_LUGARES})` : 'Adicionar meus lugares'}</summary>
    <p className="lug-nota">Onde você mora, onde está a sua família, para onde vai viajar. Fica guardado <b>só neste aparelho</b>: ninguém mais vê.</p>
    {lugares.length > 0 && <ul className="lug-lista">{lugares.map(l => <li key={l.id}>
      <span>📍 {l.nome}{l.pais ? <small> · {l.pais}</small> : null}</span>
      <button type="button" aria-label={`Remover ${l.nome}`} onClick={() => onChange(removerLugar(lugares, l.id))}>✕</button>
    </li>)}</ul>}
    {!cheio && <>
      <form className="lug-busca" onSubmit={buscar}>
        <label className="sr-only" htmlFor="lug-cidade">Cidade</label>
        <input id="lug-cidade" name="cidade" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Cidade (ex.: Curitiba, Asunción, Lima, Miami)" autoComplete="off" />
        <button type="submit" disabled={ocupado || texto.trim().length < 2}>{ocupado ? '…' : 'Buscar'}</button>
      </form>
      {achados.length > 0 && <div className="lug-achados">{achados.map(r => <button key={`${r.coordinates.latitude},${r.coordinates.longitude}`} type="button" onClick={() => escolher(r)}>
        <b>{r.name}</b><small>{r.displayName}</small></button>)}</div>}
      <button type="button" className="lug-gps" onClick={ondeEstou}>📍 Adicionar onde estou agora</button>
    </>}
    {cheio && <p className="lug-nota">Limite de {MAX_LUGARES} lugares. Remova um para adicionar outro.</p>}
    {msg && <p role="status" className="lug-nota">{msg}</p>}
  </details>
}
