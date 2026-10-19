// Gestão (Defesa Civil): cadastra abrigos, pontos de encontro/rotas de fuga e áreas de risco do plano de contingência,
// e atualiza o status (aberto, lotado, fechado). O cidadão vê esses locais primeiro, marcados como oficiais.
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { geocode } from './places'
import { criarOficial, listarOficiais, mudarStatusOficial, removerOficial, STATUS_OFICIAL, TIPOS_OFICIAIS } from './abrigosOficiais'
import type { LocalOficial, StatusOficial, TipoOficial } from './abrigosOficiais'

const campo = 'mt-1 w-full rounded border border-[#d6e4ee] bg-[#f8fbfd] px-2 py-2 text-sm text-[#0b2235]'

export function AbrigosOficiaisGestao() {
  const [itens, setItens] = useState<LocalOficial[] | null>(null)
  const [erroLista, setErroLista] = useState('')
  const [tipo, setTipo] = useState<TipoOficial>('abrigo')
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [achado, setAchado] = useState<{ label: string; latitude: number; longitude: number } | null>(null)
  const [capacidade, setCapacidade] = useState('')
  const [raio, setRaio] = useState('300')
  const [status, setStatus] = useState<StatusOficial>('aberto')
  const [codigo, setCodigo] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function carregar() {
    listarOficiais().then(l => { setItens(l); setErroLista('') }).catch(e => setErroLista(e instanceof Error ? e.message : 'Lista indisponível agora.'))
  }
  useEffect(carregar, [])

  async function buscarEndereco() {
    setMsg(null); setAchado(null)
    try {
      const r = (await geocode(endereco))[0]
      if (!r) { setMsg({ ok: false, texto: 'Endereço não encontrado. Tente com rua, número e cidade.' }); return }
      setAchado({ label: r.displayName ?? r.name, latitude: r.coordinates.latitude, longitude: r.coordinates.longitude })
    } catch (e) { setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Busca indisponível agora.' }) }
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault()
    if (!achado) { setMsg({ ok: false, texto: 'Busque o endereço antes de salvar.' }); return }
    setOcupado(true); setMsg(null)
    try {
      await criarOficial({
        tipo, nome, endereco: achado.label, latitude: achado.latitude, longitude: achado.longitude, status,
        capacidade: tipo === 'abrigo' && capacidade ? Number(capacidade) : null, raioM: tipo === 'area_risco' && raio ? Number(raio) : null,
      }, codigo)
      setMsg({ ok: true, texto: 'Local salvo. O cidadão já vê este local na tela dele.' })
      setNome(''); setEndereco(''); setAchado(null); setCapacidade('')
      carregar()
    } catch (e) { setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível salvar agora.' }) }
    finally { setOcupado(false) }
  }

  async function trocarStatus(item: LocalOficial, novo: StatusOficial) {
    if (!codigo) { setMsg({ ok: false, texto: 'Digite o código do operador no formulário para mudar o status.' }); return }
    try { await mudarStatusOficial(item.id, novo, codigo); carregar() } catch (e) { setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível mudar agora.' }) }
  }
  async function remover(item: LocalOficial) {
    if (!codigo) { setMsg({ ok: false, texto: 'Digite o código do operador no formulário para remover.' }); return }
    if (!window.confirm(`Remover "${item.nome}"?`)) return
    try { await removerOficial(item.id, codigo); carregar() } catch (e) { setMsg({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível remover agora.' }) }
  }

  return <section className="light-panel space-y-4 p-4" aria-labelledby="oficiais-titulo">
    <div>
      <h2 id="oficiais-titulo" className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="size-5 text-[#087f65]" aria-hidden="true" />Locais oficiais da Defesa Civil</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cadastre os abrigos com acordo firmado, os pontos de encontro e rotas de fuga e as áreas de risco do plano de contingência. O cidadão vê estes locais primeiro, marcados como oficiais.</p>
    </div>

    <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Tipo<select className={campo} value={tipo} onChange={e => setTipo(e.target.value as TipoOficial)}>{TIPOS_OFICIAIS.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.nome}</option>)}</select></label>
      <label className="text-sm">Nome do local<input className={campo} value={nome} onChange={e => setNome(e.target.value)} maxLength={80} placeholder="Ex.: EE Escola Estadual Centro" required /></label>
      <div className="text-sm sm:col-span-2">
        <label htmlFor="oficial-endereco">Endereço</label>
        <div className="mt-1 flex gap-2">
          <input id="oficial-endereco" className={`${campo} mt-0`} value={endereco} onChange={e => { setEndereco(e.target.value); setAchado(null) }} maxLength={120} placeholder="Rua, número e cidade" />
          <button type="button" className="rounded bg-[#075778] px-3 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void buscarEndereco()} disabled={endereco.trim().length < 3}>Buscar</button>
        </div>
        {achado && <p className="mt-1 text-xs text-[#087f65]">{`📍 Encontrado: ${achado.label}`}</p>}
      </div>
      {tipo === 'abrigo' && <label className="text-sm">Capacidade (pessoas)<input className={campo} type="number" min={0} max={100000} value={capacidade} onChange={e => setCapacidade(e.target.value)} /></label>}
      {tipo === 'area_risco' && <label className="text-sm">Raio da área (metros)<input className={campo} type="number" min={10} max={20000} value={raio} onChange={e => setRaio(e.target.value)} /></label>}
      <label className="text-sm">Status<select className={campo} value={status} onChange={e => setStatus(e.target.value as StatusOficial)}>{(Object.keys(STATUS_OFICIAL) as StatusOficial[]).map(s => <option key={s} value={s}>{STATUS_OFICIAL[s].nome}</option>)}</select></label>
      <label className="text-sm">Código do operador<input className={campo} type="password" value={codigo} onChange={e => setCodigo(e.target.value)} autoComplete="off" required /></label>
      <div className="sm:col-span-2"><button type="submit" className="rounded bg-[#087f65] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar local oficial'}</button></div>
      {msg && <p role="status" className={`text-sm sm:col-span-2 ${msg.ok ? 'text-[#087f65]' : 'text-[#b42318]'}`}>{msg.texto}</p>}
    </form>

    <div>
      <h3 className="text-sm font-semibold">Locais cadastrados</h3>
      {erroLista && <p className="text-sm text-[#b42318]">{erroLista}</p>}
      {itens && itens.length === 0 && <p className="text-sm text-muted-foreground">Nenhum local oficial cadastrado ainda.</p>}
      <ul className="mt-2 space-y-2">
        {itens?.map(i => <li key={i.id} className="rounded border border-[#d6e4ee] bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{TIPOS_OFICIAIS.find(t => t.id === i.tipo)?.emoji} {i.nome}</p>
            <span className="rounded px-2 py-0.5 text-xs font-semibold" style={{ color: STATUS_OFICIAL[i.status].cor, background: STATUS_OFICIAL[i.status].fundo }}>{STATUS_OFICIAL[i.status].nome}</span>
          </div>
          <p className="text-xs text-muted-foreground">{i.tipoNome}{i.capacidade ? ` · ${i.capacidade} pessoas` : ''}{i.raioM ? ` · raio ${i.raioM} m` : ''}</p>
          {i.endereco && <p className="text-xs text-muted-foreground">{i.endereco}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {(Object.keys(STATUS_OFICIAL) as StatusOficial[]).filter(s => s !== i.status).map(s => <button key={s} type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void trocarStatus(i, s)}>{`Marcar ${STATUS_OFICIAL[s].nome.toLowerCase()}`}</button>)}
            <button type="button" className="rounded border border-[#f3c4c4] px-2 py-1 text-xs text-[#b42318]" onClick={() => void remover(i)}>Remover</button>
          </div>
        </li>)}
      </ul>
    </div>
  </section>
}
