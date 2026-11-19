import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, configurarAuth } from '../services/api.js';
import { CHAVE_AUTH, lerAuth, limparAuth, salvarAuth } from '../services/authStorage.js';
import { msParaExpirar } from '../services/token.js';

const SEM_SESSAO = { token: null, usuario: null };
const AuthContext = createContext(null);

// Uso nas telas:  const { usuario, login, logout, cadastrar, autenticado } = useAuth();
// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return contexto;
}

export function AuthProvider({ children }) {
  // A sessão é lida do localStorage na primeira renderização: recarregar a página mantém o login.
  const [auth, setAuth] = useState(() => lerAuth() ?? SEM_SESSAO);

  const logout = useCallback(() => {
    limparAuth();
    setAuth(SEM_SESSAO);
  }, []);

  // Autentica e guarda a sessão. Se falhar, lança o erro do axios (use extrairErro).
  const login = useCallback(async (email, senha) => {
    const { data } = await api.post('/auth/login', { email, senha });
    const sessao = { token: data.token, usuario: data.usuario };
    salvarAuth(sessao);
    setAuth(sessao);
    return data.usuario;
  }, []);

  // Cria a conta. Não faz login: depois do cadastro, o usuário entra pela tela de login.
  const cadastrar = useCallback(async (dados) => {
    const { data } = await api.post('/auth/cadastro', dados);
    return data;
  }, []);

  // Quando a API devolver 401 (token inválido/expirado), o cliente HTTP avisa aqui.
  useEffect(() => {
    configurarAuth({ aoNaoAutorizado: logout });
    return () => configurarAuth({});
  }, [logout]);

  // Ao abrir o app com uma sessão guardada, confirma no servidor que ela ainda vale.
  // Se não valer, o cliente HTTP trata o 401 e a pessoa volta ao login.
  useEffect(() => {
    if (!lerAuth()) return;
    api
      .get('/auth/me')
      .then(({ data }) => setAuth((atual) => (atual.token ? { ...atual, usuario: data } : atual)))
      .catch(() => {});
  }, []);

  // Token expirado -> volta ao login sozinho, sem precisar de nenhuma requisição.
  useEffect(() => {
    if (!auth.token) return undefined;
    const espera = Math.min(msParaExpirar(auth.token), 2 ** 31 - 1);
    const timer = setTimeout(logout, espera);
    return () => clearTimeout(timer);
  }, [auth.token, logout]);

  // Logout/login em outra aba do navegador reflete nesta.
  useEffect(() => {
    const sincronizar = (evento) => {
      if (evento.key === CHAVE_AUTH || evento.key === null) setAuth(lerAuth() ?? SEM_SESSAO);
    };
    window.addEventListener('storage', sincronizar);
    return () => window.removeEventListener('storage', sincronizar);
  }, []);

  const valor = useMemo(
    () => ({ usuario: auth.usuario, token: auth.token, autenticado: Boolean(auth.token), login, logout, cadastrar }),
    [auth, login, logout, cadastrar],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
