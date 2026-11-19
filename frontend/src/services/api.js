// ÚNICO ponto de comunicação com a API. Todas as telas usam este arquivo.
//
//   import { api, extrairErro } from '../services/api';
//
//   const { data } = await api.get('/categorias');
//   await api.post('/lancamentos', { ... });
//
// - O cabeçalho "Authorization: Bearer <token>" é adicionado automaticamente.
//   Nunca monte esse cabeçalho à mão.
// - Se a API responder 401 a uma requisição que enviou token (sessão inválida ou
//   expirada), a sessão é encerrada e o usuário volta para a tela de login.
import axios from 'axios';
import { lerAuth, limparAuth } from './authStorage.js';

const env = import.meta.env ?? {};

export const api = axios.create({
  baseURL: env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 15000,
});

// O AuthProvider registra aqui o que fazer ao perder a sessão (atualizar o estado do React).
let aoPerderSessao = () => {};
export function configurarAuth({ aoNaoAutorizado }) {
  aoPerderSessao = aoNaoAutorizado ?? (() => {});
}

api.interceptors.request.use((config) => {
  const token = lerAuth()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    // Só conta como "sessão perdida" se a requisição enviou token. Um 401 do login
    // (credenciais inválidas) não tem token e deve apenas mostrar a mensagem.
    if (erro.response?.status === 401 && erro.config?.headers?.Authorization) {
      limparAuth();
      aoPerderSessao();
    }
    return Promise.reject(erro);
  },
);

// Converte qualquer erro do axios no padrão { mensagem, campos, status }.
// A API responde erros como { erro: "...", campos?: { campo: "mensagem" } }.
//
//   try { await api.post(...) } catch (e) {
//     const { mensagem, campos } = extrairErro(e);   // campos.cpf -> mensagem junto ao campo
//   }
export function extrairErro(erro) {
  const resposta = erro?.response;
  if (resposta?.data?.erro) {
    return { mensagem: resposta.data.erro, campos: resposta.data.campos ?? {}, status: resposta.status };
  }
  if (resposta) {
    return { mensagem: 'Erro inesperado no servidor.', campos: {}, status: resposta.status };
  }
  return {
    mensagem: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
    campos: {},
    status: null,
  };
}
