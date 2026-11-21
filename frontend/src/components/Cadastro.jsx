import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { extrairErro } from '../services/api.js'
import {
  SENHA_MAX,
  SENHA_MIN,
  mascararCpf,
  somenteDigitos,
  validarCadastro,
  validarCampoCadastro,
} from '../services/validacoes.js'
import CampoForm from './CampoForm.jsx'

const VAZIO = { nome: '', email: '', cpf: '', senha: '', confirmacaoSenha: '' }

export default function Cadastro() {
  const { cadastrar } = useAuth()
  const navigate = useNavigate()
  const [valores, setValores] = useState(VAZIO)
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

  function alterar(evento) {
    const { name } = evento.target
    const valor = name === 'cpf' ? mascararCpf(evento.target.value) : evento.target.value
    setValores((v) => ({ ...v, [name]: valor }))
    setErros((e) => ({ ...e, [name]: '' })) // limpa o erro do campo que está sendo corrigido
    setErroGeral('')
  }

  // Ao sair do campo, valida só se a pessoa digitou algo (evita gritar ao passar com Tab).
  function aoSair(evento) {
    const { name, value } = evento.target
    if (value) setErros((e) => ({ ...e, [name]: validarCampoCadastro(name, valores) }))
  }

  async function enviar(evento) {
    evento.preventDefault()
    setErroGeral('')

    // 1) Validação no cliente: não gasta requisição se já dá para saber que está errado.
    const errosCliente = validarCadastro(valores)
    setErros(errosCliente)
    const primeiroInvalido = Object.keys(errosCliente)[0]
    if (primeiroInvalido) {
      document.getElementById(primeiroInvalido)?.focus()
      return
    }

    // 2) O servidor valida de novo e é quem decide (ex.: e-mail ou CPF já cadastrado).
    setEnviando(true)
    try {
      await cadastrar({
        nome: valores.nome.trim(),
        email: valores.email.trim(),
        cpf: somenteDigitos(valores.cpf),
        senha: valores.senha,
        confirmacaoSenha: valores.confirmacaoSenha,
      })
      navigate('/login', { replace: true, state: { mensagem: 'Cadastro realizado! Faça login para continuar.' } })
    } catch (e) {
      const { mensagem, campos } = extrairErro(e)
      setErros(campos) // ex.: { cpf: 'Já existe um usuário com este CPF.' } aparece junto ao campo
      setErroGeral(mensagem)
      focarDepois.current = Object.keys(campos)[0] ?? null
      setEnviando(false)
    }
  }

  return (
    <form className="form-auth" onSubmit={enviar} noValidate aria-busy={enviando}>
      <h1>Criar conta</h1>
      {erroGeral && <p className="erro-geral" role="alert">{erroGeral}</p>}

      <fieldset className="form-conjunto" disabled={enviando}>
        <CampoForm
          id="nome"
          name="nome"
          rotulo="Nome"
          autoComplete="name"
          autoFocus
          value={valores.nome}
          onChange={alterar}
          onBlur={aoSair}
          erro={erros.nome}
        />
        <CampoForm
          id="email"
          name="email"
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          value={valores.email}
          onChange={alterar}
          onBlur={aoSair}
          erro={erros.email}
        />
        <CampoForm
          id="cpf"
          name="cpf"
          rotulo="CPF"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          maxLength={14}
          value={valores.cpf}
          onChange={alterar}
          onBlur={aoSair}
          erro={erros.cpf}
        />
        <CampoForm
          id="senha"
          name="senha"
          rotulo="Senha"
          type="password"
          autoComplete="new-password"
          dica={`Mínimo de ${SENHA_MIN} caracteres, com letras e números (máximo ${SENHA_MAX}).`}
          value={valores.senha}
          onChange={alterar}
          onBlur={aoSair}
          erro={erros.senha}
        />
        <CampoForm
          id="confirmacaoSenha"
          name="confirmacaoSenha"
          rotulo="Confirmar senha"
          type="password"
          autoComplete="new-password"
          value={valores.confirmacaoSenha}
          onChange={alterar}
          onBlur={aoSair}
          erro={erros.confirmacaoSenha}
        />
        <button type="submit">{enviando ? 'Cadastrando...' : 'Cadastrar'}</button>
      </fieldset>

      <p>Já tem conta? <Link to="/login">Entrar</Link></p>
    </form>
  )
}
