import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { useAlertasAtivos } from '@/features/alerts/useAlertasAtivos'
import { buscarMercado, formatarPreco, formatarVariacao, pontosDaLinha } from './mercado'
import type { RespostaMercado } from './mercado'
import './mercado.css'

const cor = (v: number | null | undefined) => (v === null || v === undefined ? '#a3c7dc' : v >= 0 ? '#2ee59d' : '#ff5971')
const hora = (s: number | null | undefined) => (s ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(s * 1000)) : '—')

/**
 * "Mercado agora" (como no painel Streamlit, com cara de corretora): cotação real das empresas dos ativos de referência
 * e, ao lado, se algum ativo da empresa tem evento NASA perto. Mostra as duas coisas juntas; não diz que uma causou a outra.
 */
export function MercadoPainel() {
  const [dados, setDados] = useState<RespostaMercado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const { alertas, resultado, erro: erroNasa } = useAlertasAtivos()

  useEffect(() => {
    const abort = new AbortController()
    const carregar = () => buscarMercado({ signal: abort.signal }).then(d => { if (!abort.signal.aborted) { setDados(d); setErro(null) } }).catch(e => { if (!abort.signal.aborted) setErro(e instanceof Error ? e.message : 'Cotações indisponíveis agora.') })
    carregar()
    const t = setInterval(carregar, 10 * 60 * 1000)
    return () => { abort.abort(); clearInterval(t) }
  }, [])

  const eventoPerto = (ids: string[]) => alertas.find(m => ids.includes(m.asset.id))
  const empresas = dados?.empresas ?? []
  const comPreco = empresas.filter(e => e.ok && e.preco !== undefined)
  const sobem = comPreco.filter(e => (e.variacaoDia ?? 0) > 0).length
  const comEvento = empresas.filter(e => eventoPerto(e.ativos)).length
  const estadoNasa = (e: RespostaMercado['empresas'][number]) => {
    const m = eventoPerto(e.ativos)
    if (m) return <span className="mercado-alerta" title={`${m.event.title} → ${m.asset.name}`}>⚠ {Math.round(m.distanceKm)} km de {m.asset.name.replace(/\s*\(.*\)$/, '')}</span>
    return <span className="text-[#a3c7dc]">{e.ativos.length ? (resultado ? 'sem evento a 600 km' : erroNasa ? 'NASA indisponível agora' : 'consultando NASA…') : 'sem ativo na lista'}</span>
  }
  const preco = (e: RespostaMercado['empresas'][number]) => e.ok && e.preco !== undefined ? formatarPreco(e.preco, e.moeda) : <span className="text-xs font-normal text-[#a3c7dc]">indisponível</span>

  return <section className="dark-panel mercado space-y-3 p-4" aria-labelledby="mercado-titulo">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 id="mercado-titulo" className="flex items-center gap-2 text-base font-semibold"><TrendingUp className="size-5 text-[#2ee59d]" aria-hidden="true" />Mercado agora</h2>
        <p className="mt-1 text-xs text-[#a3c7dc]">Cotação real das empresas dos ativos de referência · Yahoo Finance{dados ? ` · atualizado ${hora(dados.obtidoEm)}${dados.antigo ? ' (última cotação boa)' : ''}` : ''}</p></div>
      {comPreco.length > 0 && <div className="mercado-resumo"><span><b>{comPreco.length}</b> cotações</span><span style={{ color: '#2ee59d' }}><b>{sobem}</b> em alta</span><span style={{ color: '#ff5971' }}><b>{comPreco.length - sobem}</b> em baixa</span><span style={{ color: '#f5a016' }}><b>{comEvento}</b> com evento NASA perto</span></div>}
    </div>
    {!dados && !erro && <p role="status" className="text-sm">Consultando cotações…</p>}
    {erro && !dados && <p role="alert" className="text-sm text-[#ffd18a]">{erro}</p>}
    {empresas.length > 0 && <div className="mercado-desktop overflow-x-auto"><table className="mercado-tabela"><caption className="sr-only">Cotações das empresas e eventos NASA perto dos ativos</caption>
      <thead><tr><th>Empresa</th><th className="text-right">Preço</th><th className="text-right">24 h</th><th>30 dias</th><th>Ativo × NASA</th></tr></thead>
      <tbody>{empresas.map(e => <tr key={e.ticker}>
          <td><div className="flex items-center gap-2.5"><span className="mercado-logo" aria-hidden="true">{e.nome.charAt(0)}</span><div className="min-w-0"><p className="font-semibold">{e.nome} <span className="mercado-ticker">{e.ticker}</span></p><p className="text-xs text-[#a3c7dc]">{e.setor}</p></div></div></td>
          <td className="text-right font-semibold tabular-nums">{preco(e)}</td>
          <td className="text-right tabular-nums" style={{ color: cor(e.variacaoDia) }}>{formatarVariacao(e.variacaoDia)}</td>
          <td>{e.serie && e.serie.length > 1 ? <svg width="96" height="28" viewBox="0 0 96 28" role="img" aria-label={`30 dias: ${formatarVariacao(e.variacaoMes)}`}><polyline points={pontosDaLinha(e.serie)} fill="none" stroke={cor(e.variacaoMes)} strokeWidth="1.8" strokeLinejoin="round" /></svg> : '—'}</td>
          <td className="text-xs">{estadoNasa(e)}</td>
        </tr>)}</tbody></table></div>}
    {/* Celular: lista como app de corretora (nome à esquerda, preço e 24 h à direita, NASA embaixo) */}
    {empresas.length > 0 && <ul className="mercado-lista" aria-label="Cotações das empresas e eventos NASA perto dos ativos">
      {empresas.map(e => <li key={e.ticker} className="mercado-item">
        <span className="mercado-logo" aria-hidden="true">{e.nome.charAt(0)}</span>
        <div className="mercado-item-nome"><p className="font-semibold">{e.nome}</p><p className="text-xs text-[#a3c7dc]"><span className="mercado-ticker">{e.ticker}</span> {e.setor}</p></div>
        <div className="mercado-item-preco"><p className="font-semibold tabular-nums">{preco(e)}</p><p className="tabular-nums text-sm" style={{ color: cor(e.variacaoDia) }}>{formatarVariacao(e.variacaoDia)}</p></div>
        <div className="mercado-item-nasa text-xs">{estadoNasa(e)}</div>
      </li>)}
    </ul>}
    <p className="text-xs text-[#a3c7dc]">Cotação com atraso de até 15 min. A tela mostra preço e evento lado a lado, sem afirmar que um causou o outro. Não é recomendação de investimento.</p>
  </section>
}
