import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { pool, query, testarConexao } from '../src/config/db.js';
import { gerarToken } from '../src/config/jwt.js';
import { tratarErros } from '../src/middlewares/erros.js';
import lancamentosRoutes from '../src/routes/lancamentos.routes.js';
import { Usuario } from '../src/models/Usuario.js';

process.env.JWT_SECRET ??= 'segredo-de-teste-nao-usar-em-producao';

const PREFIXO = 'teste-listagem-';

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
    nome: 'Teste Listagem',
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

async function criarLancamento(usuarioId, categoriaId, fonteDestinoId, dados = {}) {
  const { tipo = 'entrada', valor = 10, data = '2026-11-15' } = dados;
  const { rows } = await query(
    `INSERT INTO lancamentos
       (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [usuarioId, tipo, `Lançamento ${contador++}`, valor, data, categoriaId, fonteDestinoId],
  );
  return rows[0].id;
}

const agora = new Date();
const ano = agora.getUTCFullYear();
const mes = agora.getUTCMonth();
const inicioMes = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
const fimMes = new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10);
const mesAnterior = new Date(Date.UTC(ano, mes - 1, 15)).toISOString().slice(0, 10);

let servidor;
let base;

async function chamar(caminho, token) {
  const resposta = await fetch(`${base}/api/lancamentos${caminho}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
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
  assert.equal((await chamar('/', null)).status, 401);
});

test('padrão: somente lançamentos do mês corrente, com totais do período', opcoes, async () => {
  const { id, token } = await criarUsuario();
  const categoriaEntrada = await criarCategoria(id, 'Salário', 'entrada');
  const categoriaSaida = await criarCategoria(id, 'Mercado', 'saida');
  const fonte = await criarFonte(id);
  await criarLancamento(id, categoriaEntrada, fonte, { valor: 100, data: inicioMes });
  await criarLancamento(id, categoriaSaida, fonte, { tipo: 'saida', valor: 40, data: fimMes });
  await criarLancamento(id, categoriaEntrada, fonte, { valor: 999, data: mesAnterior });

  const resposta = await chamar('/', token);
  assert.equal(resposta.status, 200);
  assert.equal(resposta.corpo.totalRegistros, 2);
  assert.equal(resposta.corpo.lancamentos.length, 2);
  assert.ok(resposta.corpo.lancamentos.every((l) => l.data >= inicioMes && l.data <= fimMes));
  assert.equal(resposta.corpo.pagina, 1);
  assert.equal(resposta.corpo.porPagina, 20);
  assert.equal(resposta.corpo.totalPaginas, 1);
  assert.deepEqual(resposta.corpo.totais, { entradas: 100, saidas: 40, saldo: 60 });
});

test('filtros por período, tipo, categoria e fonte/destino', opcoes, async () => {
  const { id, token } = await criarUsuario();
  const categoriaEntrada = await criarCategoria(id, 'Salário', 'entrada');
  const categoriaSaida = await criarCategoria(id, 'Mercado', 'saida');
  const fonte = await criarFonte(id);
  const outraFonte = await criarFonte(id, 'Outra conta');
  const periodo = `inicio=${inicioMes}&fim=${fimMes}`;

  await criarLancamento(id, categoriaEntrada, fonte, { valor: 10, data: inicioMes });
  await criarLancamento(id, categoriaSaida, fonte, { tipo: 'saida', valor: 3, data: inicioMes });
  await criarLancamento(id, categoriaEntrada, outraFonte, { valor: 7, data: inicioMes });

  const entradas = await chamar(`/?${periodo}&tipo=entrada`, token);
  assert.equal(entradas.corpo.totalRegistros, 2);
  assert.deepEqual(entradas.corpo.totais, { entradas: 17, saidas: 0, saldo: 17 });

  const porCategoria = await chamar(`/?${periodo}&categoriaId=${categoriaEntrada}`, token);
  assert.equal(porCategoria.corpo.totalRegistros, 2);

  const porFonte = await chamar(`/?${periodo}&fonteDestinoId=${fonte}`, token);
  assert.equal(porFonte.corpo.totalRegistros, 2);
  assert.deepEqual(porFonte.corpo.totais, { entradas: 10, saidas: 3, saldo: 7 });

  const combinado = await chamar(
    `/?${periodo}&tipo=entrada&categoriaId=${categoriaEntrada}&fonteDestinoId=${fonte}`,
    token,
  );
  assert.equal(combinado.corpo.totalRegistros, 1);
  assert.equal(combinado.corpo.lancamentos[0].valor, 10);
});

test('filtros inválidos: 400 com campos', opcoes, async () => {
  const { token } = await criarUsuario();
  const casos = {
    'inicio=2026-13-01': 'inicio',
    'fim=2026-02-30': 'fim',
    'inicio=2026-11-20&fim=2026-11-01': 'periodo',
    'tipo=investimento': 'tipo',
    'categoriaId=abc': 'categoriaId',
    'fonteDestinoId=0': 'fonteDestinoId',
    'pagina=0': 'pagina',
  };

  for (const [consulta, campo] of Object.entries(casos)) {
    const resposta = await chamar(`/?${consulta}`, token);
    assert.equal(resposta.status, 400, consulta);
    assert.ok(resposta.corpo.campos[campo], consulta);
  }
});

test('paginação: 20 por página, metadados e página além do fim vazia', opcoes, async () => {
  const { id, token } = await criarUsuario();
  const categoria = await criarCategoria(id, 'Salário', 'entrada');
  const fonte = await criarFonte(id);
  for (let i = 0; i < 25; i++) {
    await criarLancamento(id, categoria, fonte, { valor: 1, data: inicioMes });
  }

  const primeira = await chamar('/?pagina=1', token);
  assert.equal(primeira.corpo.lancamentos.length, 20);
  assert.equal(primeira.corpo.totalRegistros, 25);
  assert.equal(primeira.corpo.totalPaginas, 2);

  const segunda = await chamar('/?pagina=2', token);
  assert.equal(segunda.corpo.lancamentos.length, 5);
  assert.deepEqual(segunda.corpo.totais, { entradas: 25, saidas: 0, saldo: 25 });

  const ids = new Set(primeira.corpo.lancamentos.map((l) => l.id));
  assert.ok(segunda.corpo.lancamentos.every((l) => !ids.has(l.id)));

  const vazia = await chamar('/?pagina=3', token);
  assert.equal(vazia.corpo.lancamentos.length, 0);
  assert.equal(vazia.corpo.totalRegistros, 25);
});

test('isolamento: lançamentos de outro usuário não entram na listagem', opcoes, async () => {
  const usuario = await criarUsuario();
  const outro = await criarUsuario();
  const categoria = await criarCategoria(usuario.id, 'Salário', 'entrada');
  const fonte = await criarFonte(usuario.id);
  const categoriaAlheia = await criarCategoria(outro.id, 'Salário', 'entrada');
  const fonteAlheia = await criarFonte(outro.id);
  const proprio = await criarLancamento(usuario.id, categoria, fonte, { valor: 5, data: inicioMes });
  const alheio = await criarLancamento(outro.id, categoriaAlheia, fonteAlheia, {
    valor: 500,
    data: inicioMes,
  });

  const resposta = await chamar('/', usuario.token);
  const ids = resposta.corpo.lancamentos.map((l) => l.id);
  assert.ok(ids.includes(proprio));
  assert.ok(!ids.includes(alheio));
  assert.deepEqual(resposta.corpo.totais, { entradas: 5, saidas: 0, saldo: 5 });
});
