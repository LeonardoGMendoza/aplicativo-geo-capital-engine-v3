// Ações sobre um alerta real (evento NASA perto de um ativo), como no painel Streamlit:
// pergunta à IA (RAG) e envio REAL por WhatsApp via nossa API → n8n (exige o código do operador).
type Options = { baseUrl?: string; signal?: AbortSignal; fetcher?: typeof fetch }
export type PedidoWhatsApp = { codigo: string; destino: string; local: string; evento: string; recomendacao?: string | null; origem?: string }

/** Pergunta para a IA, até 300 caracteres (limite da API). */
export function perguntaDoAlerta(a: { evento: string; categoria: string; km: number; ativo: string; comunidade: string }, perfil: 'empresa' | 'comunidade') {
  const foco = perfil === 'empresa' ? 'proteger a operação, os trabalhadores e a comunidade vizinha' : 'proteger a comunidade (saúde, evacuação e abrigo)'
  const texto = `${a.categoria || 'Evento'} "${a.evento}" a ${Math.round(a.km)} km de ${a.ativo}, perto de ${a.comunidade || 'comunidades vizinhas'}. O que fazer agora para ${foco}?`
  return texto.length <= 300 ? texto : texto.slice(0, 297) + '…'
}

export async function enviarWhatsApp(pedido: PedidoWhatsApp, options: Options = {}): Promise<string> {
  const base = (options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000)
  const response = await (options.fetcher ?? fetch)(`${base}/api/v1/alertas/whatsapp`, {
    method: 'POST', signal, cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ origem: 'NASA EONET', ...pedido, recomendacao: pedido.recomendacao ?? null }),
  })
  const corpo = await response.json().catch(() => null)
  if (!response.ok) throw new Error(corpo?.error?.message ?? 'Não foi possível enviar agora.')
  return corpo?.mensagem ?? 'Alerta enviado.'
}
