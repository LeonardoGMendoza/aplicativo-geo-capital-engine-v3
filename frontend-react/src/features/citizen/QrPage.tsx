import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Printer, QrCode, Users } from 'lucide-react'
import { caminhoSvg, gerarQr } from './qr'
import { buscarResumo } from './cadastroAlertas'
import type { Resumo } from './cadastroAlertas'
import './qr.css'

/** Endereço que o QR abre: a tela do cidadão, marcada como vinda do QR (abre direto o cadastro de alertas). */
export function linkDoQr(origem = typeof window === 'undefined' ? 'https://omni.sandlj.com.br' : window.location.origin) {
  return `${origem.replace(/\/$/, '')}/cidadao?origem=qr`
}

export function QrPage() {
  const link = linkDoQr()
  const { d, tamanho } = useMemo(() => caminhoSvg(gerarQr(link, 'Q')), [link])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [erro, setErro] = useState(false)
  useEffect(() => {
    const abort = new AbortController()
    buscarResumo({ signal: abort.signal }).then(r => !abort.signal.aborted && setResumo(r)).catch(() => !abort.signal.aborted && setErro(true))
    return () => abort.abort()
  }, [])
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tamanho} ${tamanho}" width="1024" height="1024" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#031b2c"/></svg>`
  function baixar() {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: 'qrcode-omni-ecorescue.svg' })
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="qr-pagina space-y-3">
    <header className="qr-topo flex flex-wrap items-center justify-between gap-2 text-white">
      <div><h1 className="text-2xl font-semibold">QR Code do cidadão</h1><p className="mt-1 text-xs text-[#b5d2e2]">Cole o cartaz em escolas, UBS, igrejas e pontos de ônibus. Quem escaneia acha o abrigo mais perto e se cadastra para alertas no WhatsApp.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" className="qr-botao" onClick={() => window.print()}><Printer className="size-4" aria-hidden="true" />Imprimir cartaz</button><button type="button" className="qr-botao" onClick={baixar}><Download className="size-4" aria-hidden="true" />Baixar QR</button></div>
    </header>

    <div className="qr-layout">
      <section className="qr-cartaz" aria-label="Cartaz para imprimir">
        <p className="qr-marca">Omni-<span>EcoRescue</span></p>
        <h2>Aponte a câmera do celular</h2>
        <svg className="qr-imagem" viewBox={`0 0 ${tamanho} ${tamanho}`} role="img" aria-label={`QR code que abre ${link}`} shapeRendering="crispEdges">
          <rect width="100%" height="100%" fill="#fff" /><path d={d} fill="#031b2c" />
        </svg>
        <ul>
          <li>📍 Abrigo, hospital e UBS mais perto de você</li>
          <li>📲 Alertas de chuva forte e desastres no seu WhatsApp</li>
          <li>☎️ Em perigo, ligue: <b>199 · 193 · 192</b></li>
        </ul>
        <p className="qr-link">{link.replace(/^https?:\/\//, '')}</p>
        <p className="qr-gratis">Grátis · sem baixar aplicativo</p>
      </section>

      <aside className="light-panel qr-lado space-y-3 p-4 text-sm">
        <h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-primary" aria-hidden="true" />Cadastros para alertas</h2>
        {resumo ? <><p className="qr-numero">{resumo.total.toLocaleString('pt-BR')}</p><p className="text-muted-foreground">pessoas cadastradas · {resumo.peloQr.toLocaleString('pt-BR')} pelo QR code</p></>
          : <p className="text-muted-foreground" role="status">{erro ? 'Total indisponível agora.' : 'Consultando…'}</p>}
        <p className="text-xs text-muted-foreground">Os telefones ficam só no nosso servidor e nunca aparecem no site. A pessoa pode sair quando quiser, pelo mesmo link.</p>
        <h2 className="flex items-center gap-2 pt-2 font-semibold"><QrCode className="size-4 text-primary" aria-hidden="true" />Como funciona</h2>
        <ol className="list-decimal space-y-1 pl-5 text-xs">
          <li>A pessoa escaneia e abre a tela do cidadão no navegador.</li>
          <li>Coloca celular e CEP e aceita receber alertas.</li>
          <li>Recebe na hora a confirmação no WhatsApp.</li>
          <li>Quando houver alerta no CEP dela, a mensagem chega com o abrigo mais perto.</li>
        </ol>
        <Link to="/cidadao?origem=qr" className="text-link">Abrir a tela do cidadão →</Link>
      </aside>
    </div>
  </div>
}
