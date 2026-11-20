import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { pool, query, testarConexao } from '../src/config/db.js';
import { gerarToken } from '../src/config/jwt.js';
import { tratarErros } from '../src/middlewares/erros.js';
import fontesDestinosRoutes from '../src/routes/fontesDestinos.routes.js';
import { Usuario } from '../src/models/Usuario.js';

process.env.JWT_SECRET ??= 'segredo-de-teste-nao-usar-em-producao';

const PREFIXO = 'teste-fontes-';

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
    nome: 'Teste Fontes',
    email: `${PREFIXO}${Date.now()}-${contador++}@teste.com`,
    cpf: gerarCpf(),
    senhaHash: 'hash-de-teste',
  });
  return { id: usuario.id, token: gerarToken(usuario.id) };
}

let servidor;
let base;

async function chamar(metodo, caminho, token, corpo) {
  const resposta = await fetch(`${base}/api/fontes-destinos${caminho}`, {
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
  app.use('/api/fontes-destinos', fontesDestinosRoutes);
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
  assert.equal((await chamar('GET', '/', null)).status, 401);
});

test('cria, lista, detalha, edita e exclui', opcoes, async () => {
  const { token } = await criarUsuario();
  assert.deepEqual((await chamar('GET', '/', token)).corpo, []);

  const criada = await chamar('POST', '/', token, { nome: '  Conta Nova  ', tipo: 'conta' });
  assert.equal(criada.status, 201);
  assert.equal(criada.corpo.nome, 'Conta Nova');
  assert.equal(criada.corpo.tipo, 'conta');
  assert.equal(criada.corpo.dia_fechamento, null);
  assert.equal(criada.corpo.dia_vencimento, null);
  assert.equal(criada.corpo.limite, null);
  assert.equal(criada.corpo.reserva, false);

  assert.equal((await chamar('GET', '/', token)).corpo.length, 1);
  const id = criada.corpo.id;
  assert.equal((await chamar('GET', `/${id}`, token)).corpo.nome, 'Conta Nova');

  const editada = await chamar('PUT', `/${id}`, token, { nome: 'Conta Editada', tipo: 'conta' });
  assert.equal(editada.status, 200);
  assert.equal(editada.corpo.nome, 'Conta Editada');

  assert.equal((await chamar('DELETE', `/${id}`, token)).status, 204);
  assert.equal((await chamar('GET', `/${id}`, token)).status, 404);
});

test('cartão de crédito válido: dias e limite gravados', opcoes, async () => {
  const { token } = await criarUsuario();
  const cartao = await chamar('POST', '/', token, {
    nome: 'Cartão X',
    tipo: 'cartao_credito',
    diaFechamento: 5,
    diaVencimento: 12,
    limite: 1000,
  });
  assert.equal(cartao.status, 201);
  assert.equal(cartao.corpo.dia_fechamento, 5);
  assert.equal(cartao.corpo.dia_vencimento, 12);
  assert.equal(cartao.corpo.limite, 1000);

  const editado = await chamar('PUT', `/${cartao.corpo.id}`, token, {
    nome: 'Cartão X',
    tipo: 'cartao_credito',
    diaFechamento: 10,
    diaVencimento: 20,
    limite: 2500.5,
  });
  assert.equal(editado.status, 200);
  assert.equal(editado.corpo.dia_fechamento, 10);
  assert.equal(editado.corpo.limite, 2500.5);
});

test('cartão de crédito sem dias/limite ou com valores inválidos: 400 por campo', opcoes, async () => {
  const { token } = await criarUsuario();

  const incompleto = await chamar('POST', '/', token, { nome: 'Cartão Y', tipo: 'cartao_credito' });
  assert.equal(incompleto.status, 400);
  assert.deepEqual(
    Object.keys(incompleto.corpo.campos).sort(),
    ['diaFechamento', 'diaVencimento', 'limite'],
  );

  const invalido = await chamar('POST', '/', token, {
    nome: 'Cartão Y',
    tipo: 'cartao_credito',
    diaFechamento: 32,
    diaVencimento: 0,
    limite: -1,
  });
  assert.equal(invalido.status, 400);
  assert.ok(invalido.corpo.campos.diaFechamento);
  assert.ok(invalido.corpo.campos.diaVencimento);
  assert.ok(invalido.corpo.campos.limite);
});

test('nome único por usuário: 409 (case-insensitive) e 409 na edição', opcoes, async () => {
  const { token } = await criarUsuario();
  const primeira = await chamar('POST', '/', token, { nome: 'Conta X', tipo: 'conta' });
  assert.equal(primeira.status, 201);

  const repetida = await chamar('POST', '/', token, { nome: ' conta x ', tipo: 'renda' });
  assert.equal(repetida.status, 409);
  assert.ok(repetida.corpo.campos.nome);

  const segunda = await chamar('POST', '/', token, { nome: 'Outra', tipo: 'conta' });
  const conflito = await chamar('PUT', `/${segunda.corpo.id}`, token, { nome: 'CONTA X', tipo: 'conta' });
  assert.equal(conflito.status, 409);

  assert.equal((await chamar('GET', '/', token)).corpo.length, 2);
});

test('fonte/destino de outro usuário: 404 e sem vazamento na listagem', opcoes, async () => {
  const usuarioA = await criarUsuario();
  const usuarioB = await criarUsuario();
  const criada = await chamar('POST', '/', usuarioA.token, { nome: 'Privada', tipo: 'conta' });
  const id = criada.corpo.id;

  assert.equal((await chamar('GET', `/${id}`, usuarioB.token)).status, 404);
  assert.equal(
    (await chamar('PUT', `/${id}`, usuarioB.token, { nome: 'Roubada', tipo: 'conta' })).status,
    404,
  );
  assert.equal((await chamar('DELETE', `/${id}`, usuarioB.token)).status, 404);
  assert.deepEqual((await chamar('GET', '/', usuarioB.token)).corpo, []);
});

test('exclusão bloqueada quando há lançamento vinculado: 409', opcoes, async () => {
  const { id, token } = await criarUsuario();
  const categoria = await query(
    `INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id`,
    [id, 'Categoria teste', 'saida'],
  );
  const fonte = await chamar('POST', '/', token, { nome: 'Conta vinculada', tipo: 'conta' });

  await query(
    `INSERT INTO lancamentos
       (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, 'saida', 'Teste', 50, '2026-11-10', categoria.rows[0].id, fonte.corpo.id],
  );

  const bloqueada = await chamar('DELETE', `/${fonte.corpo.id}`, token);
  assert.equal(bloqueada.status, 409);
  assert.equal((await chamar('GET', `/${fonte.corpo.id}`, token)).status, 200);
});
