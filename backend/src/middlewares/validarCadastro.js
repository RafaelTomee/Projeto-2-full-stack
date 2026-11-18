import {
  cpfValido,
  emailValido,
  normalizarCpf,
  normalizarEmail,
  senhaValida,
  SENHA_MIN,
  SENHA_MAX,
} from '../models/validacoes.js';

// Valida o corpo de POST /api/auth/cadastro.
// - Em caso de erro: 400 no padrão { erro, campos }.
// - Em caso de sucesso: troca req.body pelos valores já normalizados
//   (nome sem espaços nas pontas, e-mail em minúsculas, CPF só com dígitos).
export function validarCadastro(req, res, next) {
  const { nome, email, cpf, senha, confirmacaoSenha } = req.body ?? {};
  const campos = {};

  // Aceita apenas texto: evita que um objeto ou número quebre as funções abaixo.
  const texto = (v) => (typeof v === 'string' ? v : '');

  const nomeLimpo = texto(nome).trim();
  if (!nomeLimpo) campos.nome = 'O nome é obrigatório.';
  else if (nomeLimpo.length > 120) campos.nome = 'O nome deve ter no máximo 120 caracteres.';

  if (!texto(email).trim()) campos.email = 'O e-mail é obrigatório.';
  else if (!emailValido(email)) campos.email = 'Informe um e-mail válido.';

  if (!normalizarCpf(texto(cpf))) campos.cpf = 'O CPF é obrigatório.';
  else if (!cpfValido(texto(cpf))) campos.cpf = 'Informe um CPF válido.';

  if (!texto(senha)) {
    campos.senha = 'A senha é obrigatória.';
  } else if (!senhaValida(senha)) {
    campos.senha =
      senha.length < SENHA_MIN || senha.length > SENHA_MAX
        ? `A senha deve ter entre ${SENHA_MIN} e ${SENHA_MAX} caracteres.`
        : 'A senha deve conter letras e números.';
  }

  // A confirmação é conferida no servidor quando enviada.
  if (confirmacaoSenha !== undefined && confirmacaoSenha !== senha) {
    campos.confirmacaoSenha = 'A confirmação de senha não confere.';
  }

  if (Object.keys(campos).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos });
  }

  req.body = {
    nome: nomeLimpo,
    email: normalizarEmail(email),
    cpf: normalizarCpf(cpf),
    senha, // a senha nunca é alterada (nem com trim)
  };
  return next();
}
