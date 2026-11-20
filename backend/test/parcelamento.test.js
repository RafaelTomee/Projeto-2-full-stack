import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { pool, query, testarConexao } from '../src/config/db.js';
import { gerarToken } from '../src/config/jwt.js';
import { tratarErros } from '../src/middlewares/erros.js';
import lancamentosRoutes from '../src/routes/lancamentos.routes.js';
import { Lancamento } from '../src/models/Lancamento.js';
import { Usuario } from '../src/models/Usuario.js';
import { dividirEmCentavos } from '../src/utils/parcelas.js';

process.env.JWT_SECRET ??= 'segredo-de-teste-nao-usar-em-producao';

const PREFIXO = 'teste-parcelamento-';

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
    nome: 'Teste Parcelamento',
    email: `${PREFIXO}${Date.now()}-${contador++}@teste.com`,
    cpf: gerarCpf(),
    senhaHash: 'hash-de-teste',
  });
  return { id: usuario.id, token: gerarToken(usuario.id) };
}

async function criarCategoria(usuarioId) {
  const { rows } = await query(
    `INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id`,
    [usuarioId, 'Cartão', 'saida'],
  );
  return rows[0].id;
}

async function criarFonte(usuarioId, tipo = 'cartao_credito') {
  const cartao = tipo === 'cartao_credito';
  const { rows } = await query(
    `INSERT INTO fontes_destinos
       (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [usuarioId, `Fonte ${tipo}`, tipo, cartao ? 5 : null, cartao ? 12 : null, cartao ? 5000 : null],
  );
  return rows[0].id;
}

let servidor;
let base;

async function chamar(metodo, caminho, token, corpo) {
  const resposta = await fetch(`${base}/api/lancamentos${caminho}`, {
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
  app.use('/api/lancamentos', lancamentosRoutes);
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

test('divisão em centavos: sobra sempre na primeira parcela', () => {
  assert.deepEqual(dividirEmCentavos(100, 3), [3334, 3333, 3333]);
  assert.deepEqual(dividirEmCentavos(10, 3), [334, 333, 333]);
  assert.deepEqual(dividirEmCentavos(1, 3), [34, 33, 33]);
  assert.deepEqual(dividirEmCentavos(100, 1), [10000]);
  assert.deepEqual(dividirEmCentavos(99.99, 2), [5000, 4999]);
  assert.throws(() => dividirEmCentavos(100, 0));
  assert.throws(() => dividirEmCentavos(100, 49));
});

test('POST em cartão com 3 parcelas: uma linha por parcela e soma igual ao total', opcoes, async () => {
  const { id, token } = await criarUsuario();
  const categoriaId = await criarCategoria(id);
  const fonteDestinoId = await criarFonte(id);

  const resposta = await chamar('POST', '/', token, {
    tipo: 'saida',
    descricao: 'Compra parcelada',
    valor: 100,
    data: '2026-11-20',
    categoriaId,
    fonteDestinoId,
    totalParcelas: 3,
  });

  assert.equal(resposta.status, 201);
  assert.equal(resposta.corpo.valor, 33.34);
  assert.equal(resposta.corpo.parcelaAtual, 1);
  assert.equal(resposta.corpo.totalParcelas, 3);
  assert.ok(resposta.corpo.grupoParcelamento);

  const { rows } = await query(
    `SELECT valor, parcela_atual FROM lancamentos
      WHERE grupo_parcelamento = $1 AND usuario_id = $2 ORDER BY parcela_atual`,
    [resposta.corpo.grupoParcelamento, id],
  );
  assert.deepEqual(rows.map((r) => Number(r.valor)), [33.34, 33.33, 33.33]);
  assert.deepEqual(rows.map((r) => r.parcela_atual), [1, 2, 3]);
  assert.equal(rows.reduce((soma, r) => soma + Math.round(Number(r.valor) * 100), 0), 10000);
});

test('parcelamento só em cartão e no máximo 48 parcelas: 400', opcoes, async () => {
  const { id, token } = await criarUsuario();
  const categoriaId = await criarCategoria(id);
  const contaId = await criarFonte(id, 'conta');
  const cartaoId = await criarFonte(id);
  const corpo = {
    tipo: 'saida',
    descricao: 'Teste',
    valor: 100,
    data: '2026-11-20',
    categoriaId,
  };

  const conta = await chamar('POST', '/', token, {
    ...corpo,
    fonteDestinoId: contaId,
    totalParcelas: 2,
  });
  assert.equal(conta.status, 400);
  assert.ok(conta.corpo.campos.totalParcelas);

  const muitos = await chamar('POST', '/', token, {
    ...corpo,
    fonteDestinoId: cartaoId,
    totalParcelas: 49,
  });
  assert.equal(muitos.status, 400);
  assert.ok(muitos.corpo.campos.totalParcelas);
});

test('DELETE apaga só a parcela sem a flag e todo o grupo com todasParcelas=true', opcoes, async () => {
  const { id, token } = await criarUsuario();
  const categoriaId = await criarCategoria(id);
  const fonteDestinoId = await criarFonte(id);
  const primeira = await chamar('POST', '/', token, {
    tipo: 'saida',
    descricao: 'Compra',
    valor: 30,
    data: '2026-11-20',
    categoriaId,
    fonteDestinoId,
    totalParcelas: 3,
  });
  const grupo = primeira.corpo.grupoParcelamento;

  assert.equal((await chamar('DELETE', `/${primeira.corpo.id}`, token)).status, 204);
  const restantes = await query(
    'SELECT id FROM lancamentos WHERE grupo_parcelamento = $1 AND usuario_id = $2',
    [grupo, id],
  );
  assert.equal(restantes.rowCount, 2);

  const outra = await chamar('GET', `/${restantes.rows[1].id}`, token);
  assert.equal(outra.status, 200);
  assert.equal(
    (await chamar('DELETE', `/${restantes.rows[0].id}?todasParcelas=true`, token)).status,
    204,
  );

  const fim = await query(
    'SELECT id FROM lancamentos WHERE grupo_parcelamento = $1 AND usuario_id = $2',
    [grupo, id],
  );
  assert.equal(fim.rowCount, 0);
});

test('transação: falha no meio das inserções não grava nenhuma parcela', opcoes, async () => {
  const { id } = await criarUsuario();
  const categoriaId = await criarCategoria(id);
  const fonteDestinoId = await criarFonte(id);
  const antes = await query('SELECT id FROM lancamentos WHERE usuario_id = $1', [id]);

  await assert.rejects(() =>
    Lancamento.criarParcelados(id, {
      tipo: 'saida',
      descricao: 'Valor que gera parcela zero',
      valor: 0.01,
      data: '2026-11-20',
      categoriaId,
      fonteDestinoId,
      totalParcelas: 2,
    }),
  );

  const depois = await query('SELECT id FROM lancamentos WHERE usuario_id = $1', [id]);
  assert.equal(depois.rowCount, antes.rowCount);
});
