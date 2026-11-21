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

test('nome que não é texto: 400 no campo', opcoes, async () => {
  const { token } = await criarUsuario();
  for (const nome of [{ a: 1 }, 123, true, [5]]) {
    const r = await chamar('POST', '/', token, { nome, tipo: 'conta' });
    assert.equal(r.status, 400);
    assert.ok(r.corpo.campos.nome);
  }
});

test('limite e dias com tipos errados: 400 por campo', opcoes, async () => {
  const { token } = await criarUsuario();
  const base = { nome: 'Cartão tipos', tipo: 'cartao_credito', diaVencimento: 12 };

  for (const limite of [true, [5], 0.004, '1e3']) {
    const r = await chamar('POST', '/', token, { ...base, diaFechamento: 5, limite });
    assert.equal(r.status, 400, `limite ${JSON.stringify(limite)}`);
    assert.ok(r.corpo.campos.limite);
  }
  for (const diaFechamento of [true, [5], 'abc', 5.5]) {
    const r = await chamar('POST', '/', token, { ...base, diaFechamento, limite: 1000 });
    assert.equal(r.status, 400, `dia ${JSON.stringify(diaFechamento)}`);
    assert.ok(r.corpo.campos.diaFechamento);
  }
  const valida = await chamar('POST', '/', token, {
    ...base,
    diaFechamento: '5',
    limite: '2500.50',
  });
  assert.equal(valida.status, 201);
  assert.equal(valida.corpo.limite, 2500.5);
});

test('PUT não troca o tipo de fonte com lançamentos: 409 no campo tipo', opcoes, async () => {
  const { id, token } = await criarUsuario();
  const categoria = await query(
    `INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id`,
    [id, 'Categoria tipo fonte', 'saida'],
  );
  const cartao = await chamar('POST', '/', token, {
    nome: 'Cartão vinculado',
    tipo: 'cartao_credito',
    diaFechamento: 5,
    diaVencimento: 12,
    limite: 1000,
  });
  await query(
    `INSERT INTO lancamentos
       (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, 'saida', 'Compra', 100, '2026-11-10', categoria.rows[0].id, cartao.corpo.id],
  );

  const trocada = await chamar('PUT', `/${cartao.corpo.id}`, token, {
    nome: 'Cartão vinculado',
    tipo: 'conta',
  });
  assert.equal(trocada.status, 409);
  assert.ok(trocada.corpo.campos.tipo);
  assert.equal((await chamar('GET', `/${cartao.corpo.id}`, token)).corpo.tipo, 'cartao_credito');

  const livre = await chamar('POST', '/', token, { nome: 'Renda livre', tipo: 'renda' });
  const trocadaLivre = await chamar('PUT', `/${livre.corpo.id}`, token, {
    nome: 'Conta livre',
    tipo: 'conta',
  });
  assert.equal(trocadaLivre.status, 200);
});

test('unicidade case-insensitive resiste a POSTs simultâneos', opcoes, async () => {
  const { token } = await criarUsuario();
  const nomes = ['Conta1', 'CONTA1', 'conta1', 'Conta1', 'CONTA1', 'conta1', 'Conta1', 'CONTA1'];
  const respostas = await Promise.all(
    nomes.map((nome) => chamar('POST', '/', token, { nome, tipo: 'conta' })),
  );
  assert.equal(respostas.filter((r) => r.status === 201).length, 1);
  assert.ok(respostas.every((r) => r.status === 201 || r.status === 409));
  assert.equal((await chamar('GET', '/', token)).corpo.length, 1);
});

test('id com byte nulo: 400 (não 500)', opcoes, async () => {
  const { token } = await criarUsuario();
  assert.equal((await chamar('GET', '/%00', token)).status, 400);
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
