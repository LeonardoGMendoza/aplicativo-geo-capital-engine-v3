// "Preparar e usar sem internet": guias, kit da família, plano e locais guardados no aparelho.
// Tudo aqui funciona offline depois da primeira visita (o service worker guarda o app).
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { BrandSymbol } from '@/components/shared/Brand'
import { categoryMeta, formatDistance } from '../shelters/places'
import type { Coordinates } from '../shelters/places'
import { useNearbySearch } from '../citizen/useNearbySearch'
import { guias, numerosPorPais } from './conteudo'
import { DURACOES, itensDoKit, progresso } from './kit'
import { escolherParaGuardar, guardarLocais, lerLocais, locaisAPartirDe, rotasOffline } from './locaisSalvos'
import type { LocaisSalvos } from './locaisSalvos'
import '../citizen/citizen.css'
import './preparar.css'

const ler = <T,>(chave: string, padrao: T): T => { try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) as T : padrao } catch { return padrao } }
const gravar = (chave: string, valor: unknown) => { try { localStorage.setItem(chave, JSON.stringify(valor)) } catch { /* sem armazenamento */ } }

interface Plano { encontro: string; encontro2: string; contatoFora: string; contatos: string; criancas: string; remedios: string; observacoes: string }
const PLANO_VAZIO: Plano = { encontro: '', encontro2: '', contatoFora: '', contatos: '', criancas: '', remedios: '', observacoes: '' }

const ehIOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

export function PrepararPage() {
  const online = useOnline()
  const [guia, setGuia] = useState<string | null>(null)
  const [pessoas, setPessoas] = useState(() => ler('omni-kit-pessoas', 2))
  const [dias, setDias] = useState<number>(() => ler('omni-kit-dias', 3))
  const [extras, setExtras] = useState(() => ler('omni-kit-extras', { bebe: false, idoso: false, pet: false }))
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(ler<string[]>('omni-kit-marcados', [])))
  const [plano, setPlano] = useState<Plano>(() => ({ ...PLANO_VAZIO, ...ler<Partial<Plano>>('omni-plano', {}) }))
  const [planoSalvo, setPlanoSalvo] = useState(false)
  const [locais, setLocais] = useState<LocaisSalvos | null>(() => lerLocais())
  const [aqui, setAqui] = useState<Coordinates | null>(null)
  const [gpsMsg, setGpsMsg] = useState('')
  const busca = useNearbySearch()

  useEffect(() => { gravar('omni-kit-pessoas', pessoas); gravar('omni-kit-dias', dias); gravar('omni-kit-extras', extras) }, [pessoas, dias, extras])
  useEffect(() => { gravar('omni-kit-marcados', [...marcados]) }, [marcados])

  // Quando a busca termina com internet, guarda os locais mais próximos no aparelho.
  useEffect(() => {
    if (busca.status === 'done' && busca.data && busca.origin) {
      const dados = escolherParaGuardar(busca.data.items, busca.origin.coordinates, busca.origin.label)
      if (guardarLocais(dados)) setLocais(dados)
    }
  }, [busca.status, busca.data, busca.origin])

  const itens = itensDoKit(pessoas, dias, extras)
  const prog = progresso(itens, marcados)
  const grupos = [...new Set(itens.map(i => i.grupo))]
  const lista = locais ? locaisAPartirDe(locais, aqui) : []

  function marcar(id: string) { setMarcados(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n }) }
  function salvarPlano(e: FormEvent) { e.preventDefault(); gravar('omni-plano', plano); setPlanoSalvo(true); setTimeout(() => setPlanoSalvo(false), 2500) }
  function ondeEstou() {
    if (!('geolocation' in navigator)) { setGpsMsg('Este aparelho não informa a localização.'); return }
    setGpsMsg('Procurando sua posição pelo GPS (funciona sem internet). Perto de uma janela ou ao ar livre fica mais rápido; pode levar até 1 minuto…')
    const ok = (p: GeolocationPosition) => {
      setAqui({ latitude: p.coords.latitude, longitude: p.coords.longitude })
      setGpsMsg(Number.isFinite(p.coords.accuracy) && p.coords.accuracy > 500 ? `Posição aproximada (~${Math.round(p.coords.accuracy)} m). Vá para perto de uma janela e toque de novo para melhorar.` : '')
    }
    const falhou = (e: GeolocationPositionError) => setGpsMsg(e.code === e.PERMISSION_DENIED
      ? (ehIOS
        ? 'O iPhone não deu permissão de localização. Vá em Ajustes → Privacidade e Segurança → Serviços de Localização → Sites do Safari → “Ao Usar o App”, e toque de novo.'
        : 'A localização foi bloqueada. Libere nas configurações do navegador e toque de novo.')
      : 'O GPS não achou sua posição agora. Sem internet, dentro de casa o GPS demora: vá para perto de uma janela ou ao ar livre e toque de novo. Enquanto isso, as distâncias são a partir do ponto guardado.')
    // 1ª tentativa: GPS preciso (até 60 s). Se falhar por tempo, aceita uma posição recente/menos precisa.
    navigator.geolocation.getCurrentPosition(ok, e => {
      if (e.code === e.PERMISSION_DENIED) { falhou(e); return }
      navigator.geolocation.getCurrentPosition(ok, falhou, { enableHighAccuracy: false, timeout: 30_000, maximumAge: 10 * 60_000 })
    }, { enableHighAccuracy: true, timeout: 60_000, maximumAge: 2 * 60_000 })
  }

  return <div className="citizen-app">
    <header className="citizen-header">
      <BrandSymbol className="h-11 w-10" decorative />
      <div><p className="citizen-brand">Omni-<span>EcoRescue</span></p><p className="citizen-tagline">Preparar e usar sem internet</p></div>
      <span className={`prep-rede ${online ? 'is-on' : 'is-off'}`} role="status">{online ? 'Com internet' : 'Sem internet'}</span>
    </header>

    <main className="citizen-main" id="main-content">
      <section className="citizen-card prep-intro" aria-labelledby="prep-titulo">
        <h1 id="prep-titulo" className="citizen-title">Funciona sem internet</h1>
        <p>Abra esta página uma vez com internet: ela fica guardada no celular. Depois, mesmo sem rede, você tem os guias, o seu kit, o plano da família e os locais guardados.</p>
        <p className="citizen-small">Dica: no celular, use “Adicionar à tela de início” para abrir como um app.</p>
      </section>

      <section className="citizen-card citizen-emergency" aria-labelledby="prep-numeros">
        <h2 id="prep-numeros" className="citizen-title">Números de emergência</h2>
        {numerosPorPais.map(p => <div key={p.pais} className="prep-pais"><p className="prep-pais-nome">{p.pais}</p>
          <div className="prep-numeros">{p.numeros.map(n => <a key={p.pais + n.numero} href={`tel:${n.numero}`} className="prep-numero"><strong>{n.numero}</strong><span>{n.nome}</span></a>)}</div></div>)}
        <p className="citizen-small">Ligação de emergência costuma funcionar mesmo sem crédito. Sem rede de celular, procure um rádio a pilha.</p>
      </section>

      <section className="citizen-card" aria-labelledby="prep-guias">
        <h2 id="prep-guias" className="citizen-title">O que fazer agora</h2>
        <div className="prep-guias">
          {guias.map(g => <button key={g.id} type="button" className="citizen-tip-btn" aria-expanded={guia === g.id} aria-pressed={guia === g.id} onClick={() => setGuia(guia === g.id ? null : g.id)}>
            <span aria-hidden="true">{g.emoji}</span> {g.titulo}</button>)}
        </div>
        {guias.filter(g => g.id === guia).map(g => <div key={g.id} className="prep-guia" aria-live="polite">
          <p className="prep-guia-resumo">{g.resumo}</p>
          <ol className="prep-passos">{g.passos.map(t => <li key={t}>{t}</li>)}</ol>
          <p className="citizen-small">Fonte: {g.fonte.nome}{online && <> · <a href={g.fonte.url} target="_blank" rel="noopener noreferrer">abrir</a></>}. Resumo para emergência; siga sempre as autoridades locais.</p>
        </div>)}
      </section>

      <section className="citizen-card" aria-labelledby="prep-locais">
        <h2 id="prep-locais" className="citizen-title">Locais guardados no celular</h2>
        {online && <>
          <p>Com internet, guarde os abrigos, hospitais, farmácias e igrejas perto de casa. Sem internet, o GPS mostra a distância e a direção até eles.</p>
          <button type="button" className="citizen-primary" onClick={busca.locate} disabled={busca.busy}>📍 Guardar locais perto de mim</button>
          {busca.busy && <p role="status" className="citizen-status">Buscando e guardando… pode levar até 30 segundos.</p>}
          {busca.status === 'error' && <p role="alert" className="citizen-error">{busca.message}</p>}
        </>}
        {!locais && !online && <p className="citizen-warning">Nenhum local guardado ainda. Quando tiver internet, toque em “Guardar locais perto de mim”.</p>}
        {locais && <>
          <p className="citizen-small">Guardado em {new Date(locais.salvoEm).toLocaleString('pt-BR')} perto de: {locais.rotulo}.</p>
          <button type="button" className="prep-gps" onClick={ondeEstou}>🧭 Onde estou agora? (GPS, sem internet)</button>
          {gpsMsg && <p role="status" className="citizen-status">{gpsMsg}</p>}
          <ul className="prep-locais">{lista.slice(0, 20).map(p => <li key={p.id} className="prep-local" style={{ borderLeftColor: categoryMeta[p.category].color }}>
            <p className="prep-local-nome">{categoryMeta[p.category].emoji} {p.name}</p>
            <p className="prep-local-info">{categoryMeta[p.category].label}{p.faith ? ` · ${p.faith}` : ''}</p>
            <p className="prep-local-dist"><span aria-hidden="true">{p.direcao.seta}</span> {formatDistance(p.kmAgora)} a {p.direcao.texto} · ~{p.minutosAPe} min a pé</p>
            {p.address && <p className="prep-local-info">📍 {p.address}</p>}
            <div className="prep-rotas">
              {ehIOS ? <a href={rotasOffline(p.coordinates, p.name).apple}>Apple Mapas</a> : <a href={rotasOffline(p.coordinates, p.name).geo}>Google Maps</a>}
              <a href={rotasOffline(p.coordinates, p.name).organic}>Organic Maps</a>
            </div>
          </li>)}</ul>
          <p className="citizen-small">Distância em linha reta{aqui ? ' a partir de onde você está' : ' a partir do ponto guardado'}. O app não sabe se o caminho está bloqueado.</p>
          <div className="citizen-warning prep-mapa-offline">
            <strong>Rota sem internet:</strong> Waze não funciona offline. Baixe antes o mapa da sua cidade:
            <ul>
              <li><strong>iPhone – Apple Mapas:</strong> foto do perfil → Mapas Off-line → Baixar novo mapa.</li>
              <li><strong>Google Maps:</strong> foto do perfil → Mapas off-line → Selecionar seu mapa.</li>
              <li><strong>Organic Maps</strong> (grátis, iPhone e Android): baixe o mapa do estado; funciona 100% sem internet.</li>
            </ul>
          </div>
        </>}
      </section>

      <section className="citizen-card" aria-labelledby="prep-kit">
        <h2 id="prep-kit" className="citizen-title">Kit de emergência da família</h2>
        <div className="prep-kit-config">
          <label>Pessoas<input type="number" min={1} max={20} value={pessoas} onChange={e => setPessoas(Number(e.target.value) || 1)} /></label>
          <div role="group" aria-label="Por quantos dias" className="prep-dias">
            {DURACOES.map(d => <button key={d} type="button" aria-pressed={dias === d} onClick={() => setDias(d)}>{d === 3 ? '72 horas' : `${d} dias`}</button>)}
          </div>
        </div>
        <div className="prep-extras">
          {([['bebe', '👶 Bebê'], ['idoso', '🧓 Idoso'], ['pet', '🐾 Animal']] as const).map(([k, rotulo]) => <label key={k} className="citizen-check">
            <input type="checkbox" checked={extras[k]} onChange={e => setExtras({ ...extras, [k]: e.target.checked })} /> {rotulo}</label>)}
        </div>
        <div className="prep-barra" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Kit pronto"><span style={{ width: `${prog.pct}%` }} /></div>
        <p className="prep-barra-texto">{prog.feitos} de {prog.total} itens prontos ({prog.pct}%)</p>
        {grupos.map(g => <fieldset key={g} className="prep-grupo"><legend>{g}</legend>
          {itens.filter(i => i.grupo === g).map(i => <label key={i.id} className="citizen-check"><input type="checkbox" checked={marcados.has(i.id)} onChange={() => marcar(i.id)} /> {i.texto}</label>)}
        </fieldset>)}
        <p className="citizen-small">72 horas é o mínimo recomendado pela União Europeia; a Alemanha recomenda até 10 dias. Troque a água e a comida antes de vencer.</p>
      </section>

      <section className="citizen-card prep-plano" aria-labelledby="prep-plano">
        <h2 id="prep-plano" className="citizen-title">Plano da família</h2>
        <p className="citizen-small">Fica só neste celular. Imprima e cole na geladeira: papel funciona sem bateria.</p>
        <form onSubmit={salvarPlano} className="prep-form">
          {([
            ['encontro', 'Ponto de encontro perto de casa', 'Ex.: em frente à capela da Rua …'],
            ['encontro2', 'Ponto de encontro fora do bairro', 'Ex.: casa da tia, Av. …'],
            ['contatoFora', 'Contato fora da cidade (todos avisam ele)', 'Nome e telefone'],
            ['contatos', 'Telefones da família', 'Um por linha'],
            ['criancas', 'Quem busca as crianças na escola', 'Nome e telefone'],
            ['remedios', 'Remédios e cuidados de saúde de cada um', 'Ex.: avó – insulina na geladeira'],
            ['observacoes', 'Outras combinações', 'Ex.: chave reserva com o vizinho'],
          ] as const).map(([campo, rotulo, dica]) => <label key={campo}>{rotulo}
            <textarea rows={campo === 'contatos' || campo === 'remedios' ? 3 : 2} value={plano[campo]} placeholder={dica} onChange={e => setPlano({ ...plano, [campo]: e.target.value })} /></label>)}
          <div className="prep-acoes">
            <button type="submit" className="citizen-primary">Salvar no celular</button>
            <button type="button" className="prep-imprimir" onClick={() => window.print()}>🖨️ Imprimir</button>
          </div>
          {planoSalvo && <p role="status" className="citizen-status">Plano salvo neste celular.</p>}
        </form>
      </section>

      <section className="citizen-card citizen-footer prep-sem-impressao">
        <p><Link to="/cidadao">← Voltar para “Ajuda perto de você”</Link></p>
        <p className="citizen-small">Os guias resumem orientações oficiais e não substituem a Defesa Civil, os bombeiros ou o serviço de saúde.</p>
      </section>
    </main>
  </div>
}
