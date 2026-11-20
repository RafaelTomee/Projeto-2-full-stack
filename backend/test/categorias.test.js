import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { pool, query, testarConexao } from '../src/config/db.js';
import { gerarToken } from '../src/config/jwt.js';
import { tratarErros } from '../src/middlewares/erros.js';
import categoriasRoutes from '../src/routes/categorias.routes.js';
import { Usuario } from '../src/models/Usuario.js';

process.env.JWT_SECRET ??= 'segredo-de-teste-nao-usar-em-producao';

const PREFIXO = 'teste-categorias-';

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
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  d.push(dv(9));
  d.push(dv(10));
  return d.join('');
}

let contador = 0;
async function criarUsuario() {
  const usuario = await Usuario.criar({
    nome: 'Teste Categorias',
    email: `${PREFIXO}${Date.now()}-${contador++}@teste.com`,
    cpf: gerarCpf(),
    senhaHash: 'hash-de-teste',
  });
  return { id: usuario.id, token: gerarToken(usuario.id) };
}

let servidor;
let base;

async function chamar(metodo, caminho, token, corpo) {
  const resposta = await fetch(`${base}/api/categorias${caminho}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

before(async () => {
  if (!temBanco) return;
  const app = express();
  app.use(express.json());
  app.use('/api/categorias', categoriasRoutes);
  app.use(tratarErros);
  await new Promise((ok) => {
    servidor = app.listen(0, ok);
  });
  base = `http://localhost:${servidor.address().port}`;
});

after(async () => {
  if (temBanco) {
    await query('DELETE FROM usuarios WHERE email LIKE $1', [`${PREFIXO}%`]);
    await new Promise((ok) => servidor.close(ok));
  }
  await pool.end();
});

test('sem token: 401', opcoes, async () => {
  const r = await chamar('GET', '/', null);
  assert.equal(r.status, 401);
});

test('cria, lista, detalha, edita e exclui', opcoes, async () => {
  const { token } = await criarUsuario();
  assert.deepEqual((await chamar('GET', '/', token)).corpo, []);

  const criada = await chamar('POST', '/', token, { nome: '  Transporte  ', tipo: 'saida' });
  assert.equal(criada.status, 201);
  assert.deepEqual(Object.keys(criada.corpo).sort(), ['id', 'nome', 'tipo']);
  assert.equal(criada.corpo.nome, 'Transporte');
  assert.equal(criada.corpo.tipo, 'saida');

  const outra = await chamar('POST', '/', token, { nome: 'Renda extra', tipo: 'entrada' });
  assert.equal(outra.status, 201);

  const lista = await chamar('GET', '/', token);
  assert.equal(lista.status, 200);
  assert.equal(lista.corpo.length, 2);

  const id = criada.corpo.id;
  const detalhe = await chamar('GET', `/${id}`, token);
  assert.equal(detalhe.corpo.nome, 'Transporte');

  const editada = await chamar('PUT', `/${id}`, token, { nome: 'Mobilidade', tipo: 'saida' });
  assert.equal(editada.status, 200);
  assert.equal(editada.corpo.nome, 'Mobilidade');

  assert.equal((await chamar('DELETE', `/${id}`, token)).status, 204);
  assert.equal((await chamar('GET', `/${id}`, token)).status, 404);
  assert.equal((await chamar('GET', '/', token)).corpo.length, 1);
});

test('dados inválidos: 400 com erro no campo', opcoes, async () => {
  const { token } = await criarUsuario();

  const semNome = await chamar('POST', '/', token, { nome: '   ', tipo: 'entrada' });
  assert.equal(semNome.status, 400);
  assert.ok(semNome.corpo.campos.nome);

  const tipoInvalido = await chamar('POST', '/', token, { nome: 'Teste', tipo: 'investimento' });
  assert.equal(tipoInvalido.status, 400);
  assert.ok(tipoInvalido.corpo.campos.tipo);

  const nomeLongo = await chamar('POST', '/', token, { nome: 'a'.repeat(61), tipo: 'entrada' });
  assert.equal(nomeLongo.status, 400);
  assert.ok(nomeLongo.corpo.campos.nome);
});

test('nome único por usuário e tipo: 409 (inclusive com maiúsculas diferentes)', opcoes, async () => {
  const { token } = await criarUsuario();
  assert.equal((await chamar('POST', '/', token, { nome: 'Alimentação', tipo: 'saida' })).status, 201);

  const repetida = await chamar('POST', '/', token, { nome: ' Alimentação ', tipo: 'saida' });
  assert.equal(repetida.status, 409);
  assert.ok(repetida.corpo.campos.nome);

  const minuscula = await chamar('POST', '/', token, { nome: 'alimentação', tipo: 'saida' });
  assert.equal(minuscula.status, 409);

  const outroTipo = await chamar('POST', '/', token, { nome: 'Alimentação', tipo: 'entrada' });
  assert.equal(outroTipo.status, 201);

  const id = outroTipo.corpo.id;
  const conflito = await chamar('PUT', `/${id}`, token, { nome: 'alimentação', tipo: 'saida' });
  assert.equal(conflito.status, 409);

  assert.equal((await chamar('GET', '/', token)).corpo.length, 2);
});

test('categoria de outro usuário: 404 e sem vazamento na listagem', opcoes, async () => {
  const usuarioA = await criarUsuario();
  const usuarioB = await criarUsuario();
  const categoria = await chamar('POST', '/', usuarioA.token, { nome: 'Privada', tipo: 'saida' });
  const id = categoria.corpo.id;

  assert.equal((await chamar('GET', `/${id}`, usuarioB.token)).status, 404);
  assert.equal(
    (await chamar('PUT', `/${id}`, usuarioB.token, { nome: 'Roubada', tipo: 'saida' })).status,
    404,
  );
  assert.equal((await chamar('DELETE', `/${id}`, usuarioB.token)).status, 404);
  assert.deepEqual((await chamar('GET', '/', usuarioB.token)).corpo, []);
});

test('exclusão bloqueada quando há lançamento vinculado: 409', opcoes, async () => {
  const { id, token } = await criarUsuario();
  const categoria = await chamar('POST', '/', token, { nome: 'Moradia', tipo: 'saida' });

  const { rows } = await query(
    `INSERT INTO fontes_destinos (usuario_id, nome, tipo)
     VALUES ($1, $2, $3) RETURNING id`,
    [id, 'Conta exclusão', 'conta'],
  );
  await query(
    `INSERT INTO lancamentos
       (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, 'saida', 'Aluguel', 100, '2026-11-10', categoria.corpo.id, rows[0].id],
  );

  const bloqueada = await chamar('DELETE', `/${categoria.corpo.id}`, token);
  assert.equal(bloqueada.status, 409);
  assert.equal((await chamar('GET', `/${categoria.corpo.id}`, token)).status, 200);
});
