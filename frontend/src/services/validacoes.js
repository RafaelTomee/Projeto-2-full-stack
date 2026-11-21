// Validações do formulário no navegador. São COMPLEMENTARES: melhoram a experiência,
// mas o servidor valida tudo de novo (as mensagens são as mesmas do back-end).

export const SENHA_MIN = 8;
export const SENHA_MAX = 72;

export const somenteDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

// Formata enquanto a pessoa digita: "52998224725" -> "529.982.247-25".
export function mascararCpf(valor) {
  const d = somenteDigitos(valor).slice(0, 11);
  const [a, b, c, e] = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)];
  let texto = a;
  if (b) texto += `.${b}`;
  if (c) texto += `.${c}`;
  if (e) texto += `-${e}`;
  return texto;
}

// Valida os dois dígitos verificadores do CPF (aceita com ou sem pontuação).
export function cpfValido(cpf) {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false; // rejeita 111.111.111-11 etc.
  const digito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

export function emailValido(email) {
  const e = String(email ?? '').trim();
  return e.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function senhaValida(senha) {
  return (
    typeof senha === 'string' &&
    senha.length >= SENHA_MIN &&
    senha.length <= SENHA_MAX &&
    /\p{L}/u.test(senha) &&
    /\d/.test(senha)
  );
}

// ---------------------------------------------------------------------------
// Cada função devolve a mensagem de erro do campo, ou '' se estiver tudo certo.

const REGRAS_CADASTRO = {
  nome: (v) => {
    const nome = (v.nome ?? '').trim();
    if (!nome) return 'O nome é obrigatório.';
    if (nome.length > 120) return 'O nome deve ter no máximo 120 caracteres.';
    return '';
  },
  email: (v) => {
    if (!(v.email ?? '').trim()) return 'O e-mail é obrigatório.';
    return emailValido(v.email) ? '' : 'Informe um e-mail válido.';
  },
  cpf: (v) => {
    if (!somenteDigitos(v.cpf)) return 'O CPF é obrigatório.';
    return cpfValido(v.cpf) ? '' : 'Informe um CPF válido.';
  },
  senha: (v) => {
    const senha = v.senha ?? '';
    if (!senha) return 'A senha é obrigatória.';
    if (senha.length < SENHA_MIN || senha.length > SENHA_MAX) {
      return `A senha deve ter entre ${SENHA_MIN} e ${SENHA_MAX} caracteres.`;
    }
    return senhaValida(senha) ? '' : 'A senha deve conter letras e números.';
  },
  confirmacaoSenha: (v) => {
    if (!v.confirmacaoSenha) return 'Confirme a senha.';
    return v.confirmacaoSenha === v.senha ? '' : 'A confirmação de senha não confere.';
  },
};

const REGRAS_LOGIN = {
  email: (v) => {
    if (!(v.email ?? '').trim()) return 'O e-mail é obrigatório.';
    return emailValido(v.email) ? '' : 'Informe um e-mail válido.';
  },
  senha: (v) => (v.senha ? '' : 'A senha é obrigatória.'),
};

function validarCom(regras, valores) {
  const erros = {};
  for (const [campo, regra] of Object.entries(regras)) {
    const mensagem = regra(valores);
    if (mensagem) erros[campo] = mensagem;
  }
  return erros;
}

export const validarCadastro = (valores) => validarCom(REGRAS_CADASTRO, valores);
export const validarLogin = (valores) => validarCom(REGRAS_LOGIN, valores);
export const validarCampoCadastro = (campo, valores) => REGRAS_CADASTRO[campo]?.(valores) ?? '';
export const validarCampoLogin = (campo, valores) => REGRAS_LOGIN[campo]?.(valores) ?? '';
