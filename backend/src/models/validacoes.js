// Funções puras de validação e normalização (sem acesso ao banco).
// Usadas pelo middleware validarCadastro e reaproveitáveis em outras rotas.

// ---------- Normalização ----------

// "  Ana@Email.COM " -> "ana@email.com"
export function normalizarEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

// "529.982.247-25" -> "52998224725"
export function normalizarCpf(cpf) {
  return String(cpf ?? '').replace(/\D/g, '');
}

// ---------- Validação ----------

// Valida os dois dígitos verificadores do CPF (aceita com ou sem pontuação).
export function cpfValido(cpf) {
  const d = normalizarCpf(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) {   // rejeita 111.111.111-11 etc.
    return false;
  }
  const digito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

// Formato básico: algo@dominio.ext, sem espaços. Limite de 160 = tamanho da coluna.
export function emailValido(email) {
  const e = normalizarEmail(email);
  return e.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// Mínimo de 8 caracteres, com pelo menos uma letra e um número.
// Máximo de 72: o bcrypt ignora o que passa disso.
export const SENHA_MIN = 8;
export const SENHA_MAX = 72;

export function senhaValida(senha) {
  return (
    typeof senha === 'string' &&
    senha.length >= SENHA_MIN &&
    senha.length <= SENHA_MAX &&
    /\p{L}/u.test(senha) &&
    /\d/.test(senha)
  );
}
