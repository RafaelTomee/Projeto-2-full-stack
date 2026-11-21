import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { pool, query, testarConexao } from '../src/config/db.js';
import { gerarToken } from '../src/config/jwt.js';
import { tratarErros } from '../src/middlewares/erros.js';
import lancamentosRoutes from '../src/routes/lancamentos.routes.js';
import { Usuario } from '../src/models/Usuario.js';

process.env.JWT_SECRET ??= 'segredo-de-teste-nao-usar-em-producao';

const PREFIXO = 'teste-lancamentos-';

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
    nome: 'Teste Lançamentos',
    email: `${PREFIXO}${Date.now()}-${contador++}@teste.com`,
    cpf: gerarCpf(),
    senhaHash: 'hash-de-teste',
  });
  return { id: usuario.id, token: gerarToken(usuario.id) };
}

async function criarCategoria(usuarioId, nome, tipo) {
  const { rows } = await query(
    'INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id',
    [usuarioId, nome, tipo],
  );
  return rows[0].id;
}

async function criarFonte(usuarioId, nome = 'Conta teste') {
  const { rows } = await query(
    'INSERT INTO fontes_destinos (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id',
    [usuarioId, nome, 'conta'],
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

test('sem token: 401', opcoes, async () => {
  assert.equal((await chamar('GET', '/1', null)).status, 401);
  assert.equal((await chamar('POST', '/', null, {})).status, 401);
});

test('cria lançamento válido com todos os campos', opcoes, async () => {
  const { id, token } = await criarUsuario();
  const categoriaId = await criarCategoria(id, 'Salário', 'entrada');
  const fonteDestinoId = await criarFonte(id);

  const resposta = await chamar('POST', '/', token, {
    tipo: 'entrada',
    descricao: 'Salário de novembro',
    valor: 1234.56,
    data: '2026-11-20',
    categoriaId,
    fonteDestinoId,
  });

  assert.equal(resposta.status, 201);
  assert.equal(resposta.corpo.tipo, 'entrada');
  assert.equal(resposta.corpo.descricao, 'Salário de novembro');
  assert.equal(resposta.corpo.valor, 1234.56);
  assert.equal(resposta.corpo.data, '2026-11-20');
  assert.equal(resposta.corpo.categoriaId, categoriaId);
  assert.equal(resposta.corpo.fonteDestinoId, fonteDestinoId);
  assert.equal(resposta.corpo.parcelaAtual, 1);
  assert.equal(resposta.corpo.totalParcelas, 1);
  assert.equal(resposta.corpo.grupoParcelamento, null);
  assert.ok(resposta.corpo.criadoEm);
});

test('corpo vazio: 400 com todos os campos obrigatórios', opcoes, async () => {
  const { token } = await criarUsuario();
  const resposta = await chamar('POST', '/', token, {});
  assert.equal(resposta.status, 400);
  assert.deepEqual(
    Object.keys(resposta.corpo.campos).sort(),
    ['categoriaId', 'data', 'descricao', 'fonteDestinoId', 'tipo', 'valor'],
  );
});

test('valor, data e tipo inválidos: 400 por campo', opcoes, async () => {
  const { id, token } = await criarUsuario();
  const categoriaId = await criarCategoria(id, 'Salário', 'entrada');
  const fonteDestinoId = await criarFonte(id);
  const baseCorpo = {
    tipo: 'entrada',
    descricao: 'Teste',
    valor: 10,
    data: '2026-11-20',
    categoriaId,
    fonteDestinoId,
  };

  const valor = await chamar('POST', '/', token, { ...baseCorpo, valor: 0 });
  assert.equal(valor.status, 400);
  assert.ok(valor.corpo.campos.valor);

  const tipo = await chamar('POST', '/', token, { ...baseCorpo, tipo: 'investimento' });
  assert.equal(tipo.status, 400);
  assert.ok(tipo.corpo.campos.tipo);

  const data = await chamar('POST', '/', token, { ...baseCorpo, data: '2026-02-30' });
  assert.equal(data.status, 400);
  assert.ok(data.corpo.campos.data);
});

test('categoria de outro usuário: 404; fonte de outro usuário: 404', opcoes, async () => {
  const usuario = await criarUsuario();
  const outro = await criarUsuario();
  const categoriaId = await criarCategoria(usuario.id, 'Salário', 'entrada');
  const fonteDestinoId = await criarFonte(usuario.id);
  const alheia = await criarCategoria(outro.id, 'Salário alheio', 'entrada');
  const fonteAlheia = await criarFonte(outro.id, 'Conta alheia');

  const corpo = {
    tipo: 'entrada',
    descricao: 'Teste',
    valor: 10,
    data: '2026-11-20',
    categoriaId,
    fonteDestinoId,
  };

  const categoria = await chamar('POST', '/', usuario.token, { ...corpo, categoriaId: alheia });
  assert.equal(categoria.status, 404);

  const fonte = await chamar('POST', '/', usuario.token, { ...corpo, fonteDestinoId: fonteAlheia });
  assert.equal(fonte.status, 404);
});

test('tipo da categoria diferente do tipo do lançamento: 400', opcoes, async () => {
  const { id, token } = await criarUsuario();
  const categoriaId = await criarCategoria(id, 'Mercado', 'saida');
  const fonteDestinoId = await criarFonte(id);

  const resposta = await chamar('POST', '/', token, {
    tipo: 'entrada',
    descricao: 'Teste',
    valor: 10,
    data: '2026-11-20',
    categoriaId,
    fonteDestinoId,
  });

  assert.equal(resposta.status, 400);
  assert.ok(resposta.corpo.campos.categoriaId);
});

test('detalha, edita, exclui e devolve 404 para id de outro usuário', opcoes, async () => {
  const usuario = await criarUsuario();
  const outro = await criarUsuario();
  const categoriaEntrada = await criarCategoria(usuario.id, 'Salário', 'entrada');
  const categoriaSaida = await criarCategoria(usuario.id, 'Mercado', 'saida');
  const fonteDestinoId = await criarFonte(usuario.id);
  const alheio = await chamar('POST', '/', outro.token, {
    tipo: 'entrada',
    descricao: 'Alheio',
    valor: 1,
    data: '2026-11-20',
    categoriaId: await criarCategoria(outro.id, 'Salário', 'entrada'),
    fonteDestinoId: await criarFonte(outro.id),
  });

  const criado = await chamar('POST', '/', usuario.token, {
    tipo: 'entrada',
    descricao: 'Original',
    valor: 10,
    data: '2026-11-20',
    categoriaId: categoriaEntrada,
    fonteDestinoId,
  });
  const id = criado.corpo.id;

  assert.equal((await chamar('GET', `/${id}`, usuario.token)).corpo.descricao, 'Original');

  const editado = await chamar('PUT', `/${id}`, usuario.token, {
    tipo: 'saida',
    descricao: 'Editado',
    valor: 25.5,
    data: '2026-11-19',
    categoriaId: categoriaSaida,
    fonteDestinoId,
  });
  assert.equal(editado.status, 200);
  assert.equal(editado.corpo.tipo, 'saida');
  assert.equal(editado.corpo.descricao, 'Editado');
  assert.equal(editado.corpo.valor, 25.5);
  assert.equal(editado.corpo.categoriaId, categoriaSaida);

  assert.equal((await chamar('GET', `/${alheio.corpo.id}`, usuario.token)).status, 404);
  assert.equal(
    (await chamar('PUT', `/${alheio.corpo.id}`, usuario.token, {})).status,
    404,
  );
  assert.equal((await chamar('DELETE', `/${alheio.corpo.id}`, usuario.token)).status, 404);

  assert.equal((await chamar('DELETE', `/${id}`, usuario.token)).status, 204);
  assert.equal((await chamar('GET', `/${id}`, usuario.token)).status, 404);
  assert.equal((await chamar('DELETE', `/${id}`, usuario.token)).status, 404);
});
