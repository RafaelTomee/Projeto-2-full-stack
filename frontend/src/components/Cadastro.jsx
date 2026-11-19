import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { extrairErro } from '../services/api.js'

const CAMPOS = [
  { nome: 'nome', rotulo: 'Nome', tipo: 'text', auto: 'name' },
  { nome: 'email', rotulo: 'E-mail', tipo: 'email', auto: 'email' },
  { nome: 'cpf', rotulo: 'CPF', tipo: 'text', auto: 'off' },
  { nome: 'senha', rotulo: 'Senha', tipo: 'password', auto: 'new-password' },
  { nome: 'confirmacaoSenha', rotulo: 'Confirmar senha', tipo: 'password', auto: 'new-password' },
]

// Versão funcional mínima (Pessoa A refina: máscara de CPF, validação no cliente etc.).
// Já mostra a mensagem do servidor junto ao campo certo (ex.: "Já existe um usuário com este CPF.").
export default function Cadastro() {
  const { cadastrar } = useAuth()
  const navigate = useNavigate()
  const [valores, setValores] = useState({ nome: '', email: '', cpf: '', senha: '', confirmacaoSenha: '' })
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await cadastrar(valores)
      navigate('/login', { replace: true, state: { mensagem: 'Cadastro realizado! Faça login para continuar.' } })
    } catch (e) {
      setErro(extrairErro(e))
      setEnviando(false)
    }
  }

  return (
    <form className="form-auth" onSubmit={enviar}>
      <h1>Criar conta</h1>
      {erro && <p className="erro-geral" role="alert">{erro.mensagem}</p>}

      {CAMPOS.map((c) => (
        <label key={c.nome}>
          {c.rotulo}
          <input
            name={c.nome}
            type={c.tipo}
            autoComplete={c.auto}
            value={valores[c.nome]}
            onChange={(e) => setValores({ ...valores, [c.nome]: e.target.value })}
          />
          {erro?.campos?.[c.nome] && <p className="erro-campo" role="alert">{erro.campos[c.nome]}</p>}
        </label>
      ))}

      <button type="submit" disabled={enviando}>{enviando ? 'Cadastrando...' : 'Cadastrar'}</button>
      <p>Já tem conta? <Link to="/login">Entrar</Link></p>
    </form>
  )
}
