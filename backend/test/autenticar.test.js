import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET ??= 'segredo-de-teste-nao-usar-em-producao';
const { autenticar } = await import('../src/middlewares/autenticar.js');
const { gerarToken } = await import('../src/config/jwt.js');

function executar(authorization) {
  const req = { headers: authorization === undefined ? {} : { authorization } };
  const r = { status: null, json: null, next: false };
  const res = {
    status(c) {
      r.status = c;
      return this;
    },
    json(c) {
      r.json = c;
      return this;
    },
  };
  autenticar(req, res, () => {
    r.next = true;
  });
  return { req, ...r };
}

test('token válido: chama next() e define req.usuarioId como número', () => {
  const r = executar(`Bearer ${gerarToken(42)}`);
  assert.equal(r.next, true);
  assert.equal(r.req.usuarioId, 42);
});

test('sem cabeçalho Authorization: 401', () => {
  const r = executar(undefined);
  assert.equal(r.next, false);
  assert.equal(r.status, 401);
});

test('esquema diferente de Bearer ou token vazio: 401', () => {
  assert.equal(executar('Basic abc123').status, 401);
  assert.equal(executar('Bearer').status, 401);
  assert.equal(executar('Bearer ').status, 401);
  assert.equal(executar(gerarToken(1)).status, 401); // sem a palavra Bearer
});

test('token adulterado ou lixo: 401', () => {
  assert.equal(executar('Bearer lixo.lixo.lixo').status, 401);
  assert.equal(executar(`Bearer ${gerarToken(1)}x`).status, 401);
});

test('token assinado com outro segredo: 401', () => {
  const falso = jwt.sign({}, 'outro-segredo', { subject: '1', expiresIn: '1h' });
  assert.equal(executar(`Bearer ${falso}`).status, 401);
});

test('token expirado: 401', () => {
  const expirado = jwt.sign({}, process.env.JWT_SECRET, { subject: '1', expiresIn: -10 });
  const r = executar(`Bearer ${expirado}`);
  assert.equal(r.status, 401);
  assert.equal(r.next, false);
});

test('token sem "sub" válido: 401', () => {
  const semSub = jwt.sign({}, process.env.JWT_SECRET, { expiresIn: '1h' });
  assert.equal(executar(`Bearer ${semSub}`).status, 401);
  const subTexto = jwt.sign({}, process.env.JWT_SECRET, { subject: 'abc', expiresIn: '1h' });
  assert.equal(executar(`Bearer ${subTexto}`).status, 401);
});

test('token com algoritmo "none" é rejeitado', () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const semAssinatura = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: '1' })}.`;
  assert.equal(executar(`Bearer ${semAssinatura}`).status, 401);
});

test('o token gerado expira em 1 hora', () => {
  const p = jwt.decode(gerarToken(7));
  assert.equal(p.sub, '7');
  assert.equal(p.exp - p.iat, 3600);
});
