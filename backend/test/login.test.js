// Teste de integração de login e /me. Precisa do banco (.env + npm run db:create).
// Sem banco, os testes são ignorados. Os usuários criados aqui são apagados no final.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import express from 'express';

process.env.JWT_SECRET ??= 'segredo-de-teste-nao-usar-em-producao';
const { pool, query, testarConexao } = await import('../src/config/db.js');
const { default: authRoutes } = await import('../src/routes/auth.routes.js');

const PREFIXO = 'teste-login-';

let temBanco = true;
try {
  await testarConexao();
} catch {
  temBanco = false;
}
const opcoes = { skip: temBanco ? false : 'banco não configurado (.env / npm run db:create)' };

function gerarCpf() {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (n) => {
    const soma = d.slice(0, n).reduce((s, v, i) => s + v * (n + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(9));
  d.push(dv(10));
  return d.join('');
}

const SENHA = 'Senha123';
const email = `${PREFIXO}${Date.now()}@teste.com`;
let servidor;
let base;
let usuarioId;

const chamar = async (metodo, caminho, { corpo, token } = {}) => {
  const r = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, corpo: await r.json() };
};
const login = (e, s) => chamar('POST', '/api/auth/login', { corpo: { email: e, senha: s } });

before(async () => {
  if (!temBanco) return;
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use((erro, req, res, next) => res.status(500).json({ erro: erro.message })); // só para o teste
  await new Promise((ok) => {
    servidor = app.listen(0, ok);
  });
  base = `http://localhost:${servidor.address().port}`;
  const r = await chamar('POST', '/api/auth/cadastro', {
    corpo: { nome: 'Teste Login', email, cpf: gerarCpf(), senha: SENHA },
  });
  assert.equal(r.status, 201, `cadastro de preparação falhou: ${JSON.stringify(r.corpo)}`);
  usuarioId = r.corpo.id;
});

after(async () => {
  if (temBanco) {
    await query('DELETE FROM usuarios WHERE email LIKE $1', [`${PREFIXO}%`]);
    await new Promise((ok) => servidor.close(ok));
  }
  await pool.end();
});

test('login correto: 200 com token (1h) e dados do usuário, sem senha_hash', opcoes, async () => {
  const r = await login(email, SENHA);
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.corpo).sort(), ['token', 'usuario']);
  assert.deepEqual(r.corpo.usuario, { id: usuarioId, nome: 'Teste Login', email });
  assert.equal(JSON.stringify(r.corpo).includes('senha'), false);

  const p = jwt.decode(r.corpo.token);
  assert.equal(p.sub, String(usuarioId));
  assert.equal(p.exp - p.iat, 3600);
});

test('login normaliza o e-mail (maiúsculas e espaços)', opcoes, async () => {
  const r = await login(`  ${email.toUpperCase()} `, SENHA);
  assert.equal(r.status, 200);
});

test('credenciais inválidas: 401 com a mesma mensagem genérica, exista o e-mail ou não', opcoes, async () => {
  const senhaErrada = await login(email, 'SenhaErrada1');
  const emailInexistente = await login(`naoexiste-${Date.now()}@teste.com`, SENHA);
  assert.equal(senhaErrada.status, 401);
  assert.equal(emailInexistente.status, 401);
  assert.equal(senhaErrada.corpo.erro, 'E-mail ou senha inválidos.');
  assert.deepEqual(senhaErrada.corpo, emailInexistente.corpo);
});

test('login sem e-mail ou sem senha: 400 com campos', opcoes, async () => {
  const r = await chamar('POST', '/api/auth/login', { corpo: {} });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.corpo.campos).sort(), ['email', 'senha']);
});

test('GET /me com o token do login: 200 e dados do usuário', opcoes, async () => {
  const { corpo } = await login(email, SENHA);
  const r = await chamar('GET', '/api/auth/me', { token: corpo.token });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.id, usuarioId);
  assert.equal(r.corpo.email, email);
  assert.equal(JSON.stringify(r.corpo).includes('senha'), false);
});

test('GET /me sem token, com token inválido ou expirado: 401', opcoes, async () => {
  assert.equal((await chamar('GET', '/api/auth/me')).status, 401);
  assert.equal((await chamar('GET', '/api/auth/me', { token: 'lixo' })).status, 401);
  const expirado = jwt.sign({}, process.env.JWT_SECRET, { subject: String(usuarioId), expiresIn: -10 });
  assert.equal((await chamar('GET', '/api/auth/me', { token: expirado })).status, 401);
});

test('GET /me com token válido de usuário que não existe mais: 401', opcoes, async () => {
  const fantasma = jwt.sign({}, process.env.JWT_SECRET, { subject: '2147483000', expiresIn: '1h' });
  assert.equal((await chamar('GET', '/api/auth/me', { token: fantasma })).status, 401);
});
