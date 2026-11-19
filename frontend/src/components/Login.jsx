import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { extrairErro } from '../services/api.js'

// Versão funcional mínima (Pessoa A refina na task "telas de login e cadastro").
export default function Login() {
  const { autenticado, login } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  // Depois de entrar, volta para a página que a pessoa tentou abrir (ou para o início).
  if (autenticado) return <Navigate to={location.state?.de?.pathname ?? '/'} replace />

  async function enviar(evento) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await login(email, senha)
    } catch (e) {
      setErro(extrairErro(e))
      setEnviando(false)
    }
  }

  return (
    <form className="form-auth" onSubmit={enviar}>
      <h1>Entrar</h1>
      {location.state?.mensagem && <p className="aviso-ok">{location.state.mensagem}</p>}
      {erro && <p className="erro-geral" role="alert">{erro.mensagem}</p>}

      <label>
        E-mail
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label>
        Senha
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
      </label>
      <button type="submit" disabled={enviando}>{enviando ? 'Entrando...' : 'Entrar'}</button>
      <p>Não tem conta? <Link to="/cadastro">Cadastre-se</Link></p>
    </form>
  )
}
