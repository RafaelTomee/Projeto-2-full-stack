import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError } from 'axios';
import { instalarLocalStorageFalso, fazerToken } from '../test-helpers/helpers.js';

instalarLocalStorageFalso();
const { api, configurarAuth, extrairErro } = await import('../src/services/api.js');
const { salvarAuth, lerAuth } = await import('../src/services/authStorage.js');

let ultimaConfig;
let avisos;

// Troca a rede por uma resposta falsa com o status desejado.
function responderCom(status, data = {}) {
  api.defaults.adapter = async (config) => {
    ultimaConfig = config;
    const resposta = { data, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      throw new AxiosError('falhou', 'ERR_BAD_REQUEST', config, null, resposta);
    }
    return resposta;
  };
}

beforeEach(() => {
  localStorage.clear();
  ultimaConfig = undefined;
  avisos = 0;
  configurarAuth({ aoNaoAutorizado: () => avisos++ });
});

test('com sessão guardada, envia Authorization: Bearer <token> automaticamente', async () => {
  const token = fazerToken(3600);
  salvarAuth({ token, usuario: { id: 1 } });
  responderCom(200);
  await api.get('/categorias');
  assert.equal(ultimaConfig.headers.Authorization, `Bearer ${token}`);
});

test('sem sessão, não envia Authorization', async () => {
  responderCom(200);
  await api.post('/auth/login', {});
  assert.equal(ultimaConfig.headers.Authorization, undefined);
});

test('401 com token: limpa a sessão, avisa o AuthProvider e propaga o erro', async () => {
  salvarAuth({ token: fazerToken(3600), usuario: { id: 1 } });
  responderCom(401, { erro: 'Token inválido ou expirado.' });
  await assert.rejects(api.get('/lancamentos'), (e) => e.response.status === 401);
  assert.equal(lerAuth(), null);
  assert.equal(avisos, 1);
});

test('401 SEM token (credenciais erradas no login): não derruba nada', async () => {
  responderCom(401, { erro: 'E-mail ou senha inválidos.' });
  await assert.rejects(api.post('/auth/login', {}));
  assert.equal(avisos, 0);
});

test('outros erros (400, 404, 409, 500) com token não encerram a sessão', async () => {
  const sessao = { token: fazerToken(3600), usuario: { id: 1 } };
  salvarAuth(sessao);
  for (const status of [400, 404, 409, 500]) {
    responderCom(status, { erro: 'x' });
    await assert.rejects(api.get('/x'));
  }
  assert.equal(avisos, 0);
  assert.deepEqual(lerAuth(), sessao);
});

test('extrairErro: padrão { erro, campos } da API', () => {
  const e = new AxiosError('x', 'ERR', {}, null, {
    status: 409,
    data: { erro: 'Usuário já cadastrado.', campos: { cpf: 'Já existe um usuário com este CPF.' } },
  });
  assert.deepEqual(extrairErro(e), {
    mensagem: 'Usuário já cadastrado.',
    campos: { cpf: 'Já existe um usuário com este CPF.' },
    status: 409,
  });
});

test('extrairErro: sem "campos" devolve objeto vazio; resposta fora do padrão e erro de rede', () => {
  const semCampos = new AxiosError('x', 'ERR', {}, null, { status: 404, data: { erro: 'Rota não encontrada.' } });
  assert.deepEqual(extrairErro(semCampos).campos, {});

  const html = new AxiosError('x', 'ERR', {}, null, { status: 502, data: '<html>Bad Gateway</html>' });
  assert.equal(extrairErro(html).mensagem, 'Erro inesperado no servidor.');
  assert.equal(extrairErro(html).status, 502);

  const rede = new AxiosError('Network Error', 'ERR_NETWORK');
  assert.match(extrairErro(rede).mensagem, /conectar ao servidor/);
  assert.equal(extrairErro(rede).status, null);
});
