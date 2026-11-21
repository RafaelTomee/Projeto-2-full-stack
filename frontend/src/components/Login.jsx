import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { extrairErro } from '../services/api.js'
import { validarCampoLogin, validarLogin } from '../services/validacoes.js'
import CampoForm from './CampoForm.jsx'

export default function Login() {
  const { autenticado, login } = useAuth()
  const location = useLocation()
  const [valores, setValores] = useState({ email: '', senha: '' })
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [enviando, setEnviando] = useState(false)
  const focarDepois = useRef(null)

  // Campo desabilitado não recebe foco: só focamos depois que o formulário volta a ficar habilitado.
  useEffect(() => {
    if (!enviando && focarDepois.current) {
      document.getElementById(focarDepois.current)?.focus()
      focarDepois.current = null
    }
  }, [enviando])

  // Depois de entrar, volta para a página que a pessoa tentou abrir (ou para o início).
  if (autenticado) return <Navigate to={location.state?.de?.pathname ?? '/'} replace />

  function alterar(evento) {
    const { name, value } = evento.target
    setValores((v) => ({ ...v, [name]: value }))
    setErros((e) => ({ ...e, [name]: '' }))
    setErroGeral('')
  }

  // Ao sair do campo, valida só se a pessoa digitou algo (evita gritar ao passar com Tab).
  function aoSair(evento) {
    const { name, value } = evento.target
    if (value) setErros((e) => ({ ...e, [name]: validarCampoLogin(name, valores) }))
  }

  async function enviar(evento) {
    evento.preventDefault()
    setErroGeral('')

    const errosCliente = validarLogin(valores)
    setErros(errosCliente)
    const primeiroInvalido = Object.keys(errosCliente)[0]
    if (primeiroInvalido) {
      document.getElementById(primeiroInvalido)?.focus()
      return
    }

    setEnviando(true)
    try {
      await login(valores.email.trim(), valores.senha)
      // Sucesso: o AuthProvider guarda a sessão e o <Navigate> acima redireciona.
    } catch (e) {
      const { mensagem, campos } = extrairErro(e)
      setErros(campos)
      setErroGeral(mensagem) // 401: "E-mail ou senha inválidos."; 429: muitas tentativas; sem rede...
      focarDepois.current = 'senha' // pronto para tentar de novo
      setEnviando(false)
    }
  }

  return (
    <form className="form-auth" onSubmit={enviar} noValidate aria-busy={enviando}>
      <h1>Entrar</h1>
      {location.state?.mensagem && <p className="aviso-ok" role="status">{location.state.mensagem}</p>}
      {erroGeral && <p className="erro-geral" role="alert">{erroGeral}</p>}

      <fieldset className="form-conjunto" disabled={enviando}>
        <CampoForm
          id="email"
          name="email"
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          autoFocus
          value={valores.email}
          onChange={alterar}
          onBlur={aoSair}
          erro={erros.email}
        />
        <CampoForm
          id="senha"
          name="senha"
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
          value={valores.senha}
          onChange={alterar}
          onBlur={aoSair}
          erro={erros.senha}
        />
        <button type="submit">{enviando ? 'Entrando...' : 'Entrar'}</button>
      </fieldset>

      <p>Não tem conta? <Link to="/cadastro">Cadastre-se</Link></p>
    </form>
  )
}
