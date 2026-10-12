import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { ask, citacao } from '@/features/intelligence/intelligence'
import type { Resposta } from '@/features/intelligence/intelligence'
import { enviarWhatsApp, perguntaDoAlerta } from './enviarAlerta'

type Props = { ativo: string; comunidade: string; evento: string; categoria: string; km: number; perfil: 'empresa' | 'comunidade'; observadoEm: string | null }

/** Painel de ação do alerta (igual ao Streamlit): recomendação da IA, ação simulada e envio REAL por WhatsApp. */
export function AlertActions({ ativo, comunidade, evento, categoria, km, perfil, observadoEm }: Props) {
  const [ia, setIa] = useState<Resposta | null>(null)
  const [iaCarregando, setIaCarregando] = useState(false)
  const [iaErro, setIaErro] = useState<string | null>(null)
  const [simulado, setSimulado] = useState(false)
  const [destino, setDestino] = useState('')
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [envio, setEnvio] = useState<{ ok: boolean; texto: string; previa?: string | null } | null>(null)
  const local = perfil === 'empresa' ? ativo : comunidade || ativo
  const recomendacao = ia?.resposta ?? (ia ? ia.trechos.map(t => `${t.texto.slice(0, 200)} (${citacao(t)})`).join(' ') : null)

  async function pedirIa() {
    setIaCarregando(true); setIaErro(null)
    try { setIa(await ask(perguntaDoAlerta({ evento, categoria, km, ativo, comunidade }, perfil), perfil)) }
    catch (e) { setIaErro(e instanceof Error ? e.message : 'A IA não respondeu agora.') }
    finally { setIaCarregando(false) }
  }
  async function enviar(event: FormEvent) {
    event.preventDefault()
    setEnviando(true); setEnvio(null)
    try {
      const r = await enviarWhatsApp({ codigo, destino, local, evento, recomendacao, publico: perfil, km, observadoEm, categoria })
      setEnvio({ ok: true, texto: r.mensagem, previa: r.previa })
    }
    catch (e) { setEnvio({ ok: false, texto: e instanceof Error ? e.message : 'Não foi possível enviar.' }) }
    finally { setEnviando(false) }
  }

  return <section className="alerta-acoes space-y-3 rounded border border-red-200 bg-red-50 p-3 text-sm" aria-label="Ações sobre o alerta">
    <p className="font-bold text-red-800">🚨 {perfil === 'empresa' ? 'PERIGO A ATIVO DETECTADO' : 'EMERGÊNCIA SOCIAL DETECTADA'}</p>
    <p><b>Gatilho:</b> {evento} · <b>{perfil === 'empresa' ? 'Ativo' : 'Comunidade'}:</b> {perfil === 'empresa' ? ativo : comunidade || ativo} · <b>Distância:</b> {Math.round(km)} km</p>

    <div className="space-y-2 rounded border border-sky-200 bg-white p-3">
      <p className="font-semibold text-sky-900">🤖 Decisão RAG (IA)</p>
      {!ia && <Button size="sm" disabled={iaCarregando} onClick={() => void pedirIa()}>{iaCarregando ? 'Consultando documentos… até 30 s' : 'Gerar recomendação da IA'}</Button>}
      {iaErro && <p role="alert" className="text-amber-900">{iaErro}</p>}
      {ia && <>
        {ia.resposta ? <p className="whitespace-pre-line leading-relaxed">{ia.resposta.replace(/\*\*/g, '')}</p> : <p className="text-amber-900">A IA não respondeu; seguem os trechos mais parecidos dos documentos.</p>}
        <p className="text-xs text-muted-foreground">Fontes: {ia.trechos.map(citacao).join(' · ')}</p>
        <p className="text-xs text-muted-foreground">{ia.aviso}</p>
      </>}
    </div>

    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => setSimulado(true)}>{perfil === 'empresa' ? 'ENVIAR ORDEM DE BLOQUEIO (simulação)' : 'ACIONAR LIDERANÇAS E ONGS (simulação)'}</Button>
    </div>
    {simulado && <p role="status" className="rounded bg-violet-50 p-2 text-violet-900">🧪 SIMULAÇÃO: registrado só na tela. Nada foi enviado. O envio real é o WhatsApp abaixo.</p>}

    <form onSubmit={enviar} className="space-y-2 rounded border border-emerald-300 bg-white p-3">
      <p className="font-semibold text-emerald-900">📲 Enviar este alerta por WhatsApp (envio real)</p>
      <label className="block">Celular com DDD ou ID do grupo<input className="mini-select mt-1 w-full" value={destino} onChange={e => setDestino(e.target.value)} placeholder="(51) 99999-1234 ou 1203…@g.us" maxLength={60} /></label>
      <label className="block">Código do operador<input className="mini-select mt-1 w-full" type="password" autoComplete="off" value={codigo} onChange={e => setCodigo(e.target.value)} maxLength={100} /></label>
      <p className="text-xs text-muted-foreground">A mensagem segue um modelo fixo para {perfil === 'empresa' ? 'a empresa (técnica)' : 'a comunidade (simples)'}, com o nível calculado pela distância e pela data do evento e o link do app de rotas. {recomendacao ? 'A recomendação da IA (com PDF e página) vai junto.' : 'Dica: gere a recomendação da IA antes, para ela ir junto.'} Só quem tem o código consegue enviar.</p>
      <Button type="submit" size="sm" disabled={enviando || destino.trim().length < 8 || codigo.trim().length < 6}>{enviando ? 'Enviando…' : '📲 ENVIAR ESTE ALERTA POR WHATSAPP'}</Button>
      {envio && <p role={envio.ok ? 'status' : 'alert'} className={envio.ok ? 'text-emerald-800' : 'text-red-800'}>{envio.ok ? '✅ ' : ''}{envio.texto}</p>}
      {envio?.previa && <details open><summary className="cursor-pointer text-xs">Mensagem enviada</summary><pre className="mt-1 whitespace-pre-wrap rounded bg-[#e7f6ec] p-2 font-sans text-xs text-[#0b2233]">{envio.previa.replace(/\*/g, '')}</pre></details>}
    </form>
  </section>
}
