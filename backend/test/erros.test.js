import test, { before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  ErroHttp,
  erroValidacao,
  naoEncontrado,
  conflito,
  rotaNaoEncontrada,
  tratarErros,
} from '../src/middlewares/erros.js';

let servidor;
let base;
let logErro;

before(async () => {
  const app = express();
  app.use(express.json());

  app.post('/validacao', () => {
    throw erroValidacao({ valor: 'O valor deve ser maior que zero.' });
  });
  app.get('/async-nao-encontrado', async () => {
    throw naoEncontrado('Lançamento não encontrado.');
  });
  app.get('/nao-encontrado-padrao', () => {
    throw naoEncontrado();
  });
  app.get('/conflito', () => {
    throw conflito('Categoria em uso.', { nome: 'Já existe.' });
  });
  app.get('/via-next', (req, res, next) => next(new ErroHttp(418, 'Sou um bule.')));
  app.get('/explode', () => {
    throw new Error('senha do banco é 123456, em /home/usuario/segredo.js');
  });
  app.get('/pg/:codigo', (req, res, next) => {
    const e = new Error('detalhe interno: relation "usuarios" column "cpf"');
    e.code = req.params.codigo;
    next(e);
  });
  app.get('/ja-enviou', (req, res, next) => {
    res.write('parcial');
    next(new Error('falha no meio da resposta'));
  });
  app.post('/corpo', (req, res) => res.json({ ok: true }));

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);

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

// Silencia (e permite conferir) o console.error que o handler usa no 500.
beforeEach(() => {
  logErro?.mock.restore();
  logErro = mock.method(console, 'error', () => {});
});

const chamar = async (metodo, caminho, { corpo, tipo = 'application/json' } = {}) => {
  const r = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: corpo === undefined ? {} : { 'content-type': tipo },
    body: corpo,
  });
  const texto = await r.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* resposta não era JSON */
  }
  return { status: r.status, json, texto, tipo: r.headers.get('content-type') };
};

test('erroValidacao: 400 no padrão { erro, campos }', async () => {
  const r = await chamar('POST', '/validacao', { corpo: '{}' });
  assert.equal(r.status, 400);
  assert.deepEqual(r.json, {
    erro: 'Dados inválidos.',
    campos: { valor: 'O valor deve ser maior que zero.' },
  });
});

test('throw dentro de função async também é tratado (Express 5)', async () => {
  const r = await chamar('GET', '/async-nao-encontrado');
  assert.equal(r.status, 404);
  assert.deepEqual(r.json, { erro: 'Lançamento não encontrado.' }); // sem "campos"
});

test('naoEncontrado() sem mensagem usa o texto padrão', async () => {
  const r = await chamar('GET', '/nao-encontrado-padrao');
  assert.equal(r.status, 404);
  assert.equal(r.json.erro, 'Recurso não encontrado.');
});

test('conflito: 409 com campos', async () => {
  const r = await chamar('GET', '/conflito');
  assert.equal(r.status, 409);
  assert.deepEqual(r.json, { erro: 'Categoria em uso.', campos: { nome: 'Já existe.' } });
});

test('ErroHttp passado em next() mantém o status', async () => {
  const r = await chamar('GET', '/via-next');
  assert.equal(r.status, 418);
  assert.equal(r.json.erro, 'Sou um bule.');
});

test('erro inesperado: 500 genérico, sem vazar mensagem nem stack', async () => {
  const r = await chamar('GET', '/explode');
  assert.equal(r.status, 500);
  assert.deepEqual(r.json, { erro: 'Erro interno do servidor.' });
  assert.equal(r.texto.includes('senha do banco'), false);
  assert.equal(r.texto.includes('segredo.js'), false);
  assert.equal(r.texto.includes(' at '), false); // nenhum trecho de stack trace
  // ...mas o detalhe foi para o log do servidor
  assert.equal(logErro.mock.callCount(), 1);
});

test('JSON quebrado no corpo (ex.: cabeçalho colado no Body): 400 em JSON, sem stack', async () => {
  const r = await chamar('POST', '/corpo', { corpo: 'Authorization: Bearer abc.def.ghi' });
  assert.equal(r.status, 400);
  assert.deepEqual(r.json, { erro: 'JSON inválido no corpo da requisição.' });
  assert.equal(r.texto.includes('SyntaxError'), false);
  assert.equal(r.texto.includes('node_modules'), false);
  assert.equal(logErro.mock.callCount(), 0); // erro do cliente não é erro 500
});

test('corpo grande demais: 413 em JSON', async () => {
  const r = await chamar('POST', '/corpo', { corpo: JSON.stringify({ x: 'a'.repeat(200_000) }) });
  assert.equal(r.status, 413);
  assert.deepEqual(r.json, { erro: 'Corpo da requisição muito grande.' });
});

test('rota inexistente: 404 em JSON (não HTML)', async () => {
  const r = await chamar('GET', '/nao/existe');
  assert.equal(r.status, 404);
  assert.deepEqual(r.json, { erro: 'Rota não encontrada.' });
  assert.match(r.tipo, /application\/json/);
});

test('erros do PostgreSQL viram resposta segura, sem vazar detalhe', async () => {
  const esperado = {
    23505: 409, // UNIQUE
    23503: 409, // FK
    '22P02': 400, // id "abc"
    23514: 400, // CHECK
    23502: 400, // NOT NULL
  };
  for (const [codigo, status] of Object.entries(esperado)) {
    const r = await chamar('GET', `/pg/${codigo}`);
    assert.equal(r.status, status, `código ${codigo}`);
    assert.equal(r.texto.includes('relation'), false, `código ${codigo} vazou detalhe`);
    assert.equal(typeof r.json.erro, 'string');
  }
  assert.equal(logErro.mock.callCount(), 0);
});

test('código de erro desconhecido do banco continua sendo 500 genérico', async () => {
  const r = await chamar('GET', '/pg/57P01');
  assert.equal(r.status, 500);
  assert.deepEqual(r.json, { erro: 'Erro interno do servidor.' });
});

test('se a resposta já começou, repassa o erro ao Express (não tenta enviar JSON de novo)', () => {
  let repassado = null;
  const res = { headersSent: true };
  tratarErros(new Error('x'), { method: 'GET', originalUrl: '/' }, res, (e) => {
    repassado = e;
  });
  assert.equal(repassado.message, 'x');
});
