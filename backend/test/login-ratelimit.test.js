// Fica em arquivo separado porque o contador do limitador vive na memória do
// processo e cada arquivo de teste roda no seu próprio processo.
// Não precisa de banco: tentativas com corpo vazio já contam como falhas (400).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.JWT_SECRET ??= 'segredo-de-teste-nao-usar-em-producao';
const { default: authRoutes } = await import('../src/routes/auth.routes.js');
const { pool } = await import('../src/config/db.js');

let servidor;
let base;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  await new Promise((ok) => {
    servidor = app.listen(0, ok);
  });
  base = `http://localhost:${servidor.address().port}`;
});

after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await pool.end();
});

test('rate limit: a 11ª tentativa falha em 15 minutos recebe 429', async () => {
  const tentar = () =>
    fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

  for (let i = 1; i <= 10; i++) {
    assert.equal((await tentar()).status, 400, `tentativa ${i}`);
  }
  const r = await tentar();
  assert.equal(r.status, 429);
  assert.match((await r.json()).erro, /Muitas tentativas/);
  assert.ok(r.headers.get('ratelimit') || r.headers.get('ratelimit-policy'));
});
