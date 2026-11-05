// Cartão da assistente na Área do cidadão: foto da Clara (leve, abre na hora em qualquer celular)
// e o botão que abre a conversa. O rosto 3D só carrega no Modo acessível (o iPhone não aguenta dois 3D seguidos).
import { Link } from 'react-router-dom'
import { Mic } from 'lucide-react'
import './acessivel.css'

export const FOTO_ASSISTENTE = '/avatars/clara.jpg'

export function CartaoAssistente() {
  return <section className="ac-cartao ac-cartao-cidadao" aria-label="Assistente de emergência">
    <header className="ac-cartao-topo">
      <div><h2>Assistente de emergência</h2><p>Pergunte falando. Entende português, espanhol e inglês.</p></div>
      <i className="ac-ponto is-pronto" aria-hidden="true" />
    </header>
    <Link to="/cidadao/acessivel" className="ac-palco ac-palco-cidadao ac-foto" aria-label="Abrir a assistente">
      <img src={FOTO_ASSISTENTE} alt="Clara, a assistente de emergência" width={528} height={318} loading="lazy" />
    </Link>
    <div className="ac-cartao-acao">
      <Link to="/cidadao/acessivel" className="ac-falar"><Mic aria-hidden="true" />Falar com a assistente</Link>
      <p>Letras grandes e respostas em voz alta. Funciona também sem internet (só voz).</p>
    </div>
  </section>
}
