import { useState } from 'react'
import type { FormEvent } from 'react'
import { cadastrar, cepValido, celularValido, formatarCelular, formatarCep, origemDaUrl, sair } from './cadastroAlertas'

/** Cartão "Receber alertas no WhatsApp" da tela do cidadão: celular + CEP + aceite. Botões e letras grandes. */
export function AlertsSignup() {
  const origem = typeof window === 'undefined' ? 'site' : origemDaUrl(window.location.search)
  const [aberto, setAberto] = useState(origem === 'qr') // quem veio pelo QR já vê o formulário
  const [modo, setModo] = useState<'entrar' | 'sair'>('entrar')
  const [celular, setCelular] = useState('')
  const [cep, setCep] = useState('')
  const [nome, setNome] = useState('')
  const [aceite, setAceite] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [ok, setOk] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const pronto = celularValido(celular) && cepValido(cep) && (modo === 'sair' || aceite)

  async function enviar(event: FormEvent) {
    event.preventDefault()
    if (!pronto || enviando) return
    setEnviando(true); setErro(null); setOk(null)
    try {
      if (modo === 'sair') {
        await sair({ celular, cep })
        setOk('Pronto. Se esse celular e CEP estavam cadastrados, você não vai mais receber os alertas.')
      } else {
        const r = await cadastrar({ celular, cep, nome, aceite, origem })
        setOk(`${r.atualizado ? 'Cadastro atualizado' : 'Cadastro feito'}! Os alertas para o CEP ${r.cep} vão para o WhatsApp ${r.celular}.`)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir agora.')
    } finally { setEnviando(false) }
  }

  return <section aria-labelledby="citizen-alerts" className="citizen-card citizen-alerts">
    <h2 id="citizen-alerts" className="citizen-title">📲 Receber alertas no WhatsApp</h2>
    <p className="citizen-small" style={{ marginTop: 0 }}>Aviso de chuva forte, calor extremo e desastres perto do seu CEP. É grátis.</p>
    {!aberto ? <button type="button" className="citizen-primary citizen-whats" onClick={() => setAberto(true)}>Quero receber alertas</button>
      : <form onSubmit={enviar} className="citizen-form citizen-alerts-form" noValidate>
        <label htmlFor="alerta-celular">Celular com DDD (WhatsApp)</label>
        <input id="alerta-celular" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(51) 99999-1234" value={celular}
          onChange={e => setCelular(formatarCelular(e.target.value))} aria-invalid={celular.length > 13 && !celularValido(celular)} />
        <label htmlFor="alerta-cep">CEP de onde você mora</label>
        <input id="alerta-cep" inputMode="numeric" autoComplete="postal-code" placeholder="90010-150" value={cep}
          onChange={e => setCep(formatarCep(e.target.value))} aria-invalid={cep.length === 9 && !cepValido(cep)} />
        {modo === 'entrar' && <>
          <label htmlFor="alerta-nome">Seu nome (opcional)</label>
          <input id="alerta-nome" autoComplete="given-name" maxLength={60} value={nome} onChange={e => setNome(e.target.value)} />
          <label className="citizen-check"><input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} />
            <span>Aceito que o Omni-EcoRescue guarde meu celular e CEP <b>só para enviar alertas</b>. Não compartilhamos com ninguém e posso sair quando quiser.</span></label>
        </>}
        <button type="submit" className={modo === 'sair' ? 'citizen-sair' : 'citizen-primary citizen-whats'} disabled={!pronto || enviando}>
          {enviando ? 'Enviando…' : modo === 'sair' ? 'Parar de receber' : 'Cadastrar meu WhatsApp'}</button>
        {ok && <p role="status" className="citizen-status">✅ {ok}</p>}
        {erro && <p role="alert" className="citizen-error">{erro}</p>}
        <button type="button" className="citizen-link" onClick={() => { setModo(m => (m === 'entrar' ? 'sair' : 'entrar')); setOk(null); setErro(null) }}>
          {modo === 'entrar' ? 'Já cadastrado? Parar de receber alertas' : '← Voltar para o cadastro'}</button>
      </form>}
    <p className="citizen-small">Em perigo, não espere a mensagem: ligue 199, 193 ou 192.</p>
  </section>
}
