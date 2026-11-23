import { Link } from 'react-router-dom'

export default function NaoEncontrada() {
  return (
    <section className="ui-painel">
      <h1>Página não encontrada</h1>
      <p><Link className="ui-link-botao" to="/">Voltar ao início</Link></p>
    </section>
  )
}
