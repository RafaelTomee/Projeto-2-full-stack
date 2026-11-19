import { tokenExpirado } from './token.js';

// Única fonte da sessão no navegador: { token, usuario } em localStorage.
// Usado pelo AuthContext e pelo cliente HTTP (api.js).
export const CHAVE_AUTH = 'financas.auth';

// Devolve { token, usuario } ou null (se não houver, estiver corrompido ou expirado).
export function lerAuth() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_AUTH));
    if (salvo?.token && !tokenExpirado(salvo.token)) return salvo;
  } catch {
    /* JSON corrompido ou localStorage indisponível: trata como sem sessão */
  }
  limparAuth();
  return null;
}

export function salvarAuth(auth) {
  try {
    localStorage.setItem(CHAVE_AUTH, JSON.stringify(auth));
  } catch {
    /* sem localStorage: a sessão vale só até recarregar a página */
  }
}

export function limparAuth() {
  try {
    localStorage.removeItem(CHAVE_AUTH);
  } catch {
    /* ignora */
  }
}
