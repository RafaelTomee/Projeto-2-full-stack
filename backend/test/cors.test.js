import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.FRONTEND_URL = 'http://localhost:5173, http://127.0.0.1:5173/';
const { criarCors, origensPermitidas } = await import('../src/config/cors.js');

let servidor;
let base;

before(async () => {
  const app = express();
  app.use(criarCors());
  app.get('/api/teste', (req, res) => res.json({ ok: true }));
  await new Promise((ok) => {
    servidor = app.listen(0, ok);
  });
  base = `http://localhost:${servidor.address().port}`;
});

after(async () => {
  await new Promise((ok) => {
    servidor.closeAllConnections?.();
    servidor.close(ok);
  });
});

test('origensPermitidas: aceita lista com vírgula e ignora espaços e "/" final', () => {
  assert.deepEqual(origensPermitidas(), ['http://localhost:5173', 'http://127.0.0.1:5173']);
});

test('origem do front-end é liberada', async () => {
  const r = await fetch(`${base}/api/teste`, { headers: { origin: 'http://localhost:5173' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('segunda origem da lista também é liberada', async () => {
  const r = await fetch(`${base}/api/teste`, { headers: { origin: 'http://127.0.0.1:5173' } });
  assert.equal(r.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
});

test('outra origem NÃO recebe o cabeçalho (o navegador bloqueia)', async () => {
  for (const origin of ['http://site-malicioso.com', 'http://localhost:3000', 'http://localhost:5174']) {
    const r = await fetch(`${base}/api/teste`, { headers: { origin } });
    assert.equal(r.headers.get('access-control-allow-origin'), null, origin);
  }
});

test('requisição sem Origin (Postman, curl) funciona normalmente', async () => {
  const r = await fetch(`${base}/api/teste`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});

test('preflight (OPTIONS) do front-end com Authorization é aceito', async () => {
  const r = await fetch(`${base}/api/teste`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'DELETE',
      'access-control-request-headers': 'authorization,content-type',
    },
  });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.match(r.headers.get('access-control-allow-headers').toLowerCase(), /authorization/);
  assert.match(r.headers.get('access-control-allow-methods'), /DELETE/);
});

test('preflight de outra origem não recebe permissão', async () => {
  const r = await fetch(`${base}/api/teste`, {
    method: 'OPTIONS',
    headers: { origin: 'http://site-malicioso.com', 'access-control-request-method': 'GET' },
  });
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});
