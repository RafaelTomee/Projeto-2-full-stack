import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import express from 'express';
import { pool, query, testarConexao } from '../src/config/db.js';
import { gerarToken } from '../src/config/jwt.js';
import { tratarErros } from '../src/middlewares/erros.js';
import relatorios from '../src/routes/relatorios.routes.js';

process.env.JWT_SECRET ??= 'segredo-local-de-teste';
const temBanco = await testarConexao().then(() => true, () => false);
const opcoes = { skip: temBanco ? false : 'PostgreSQL não configurado' };
const caminho = '/api/relatorios/';
const periodo = '?inicio=2026-11-01&fim=2026-11-30';

let servidor;
let url;
let usuario;
let headers;

before(async () => {
  const app = express();
  app.use(caminho, relatorios);
  app.use(tratarErros);
  servidor = await new Promise((resolve) => {
    const inst = app.listen(0, '127.0.0.1', () => resolve(inst));
  });
  url = 'http://127.0.0.1:' + servidor.address().port + caminho;
  if (!temBanco) return;

  const { rows: usuarios } = await query(
    'INSERT INTO usuarios (nome,email,cpf,senha_hash) VALUES ($1,$2,$3,$4) RETURNING id',
    ['Teste Relatórios', randomUUID() + '@example.test', String(randomInt(1e10, 1e11)), 'x'],
  );
  usuario = usuarios[0].id;
  headers = { Authorization: 'Bearer ' + gerarToken(usuario) };

  const { rows: categorias } = await query(
    "INSERT INTO categorias (usuario_id,nome,tipo) VALUES ($1,'Compras','saida') RETURNING id",
    [usuario],
  );
  const { rows: fontes } = await query(
    "INSERT INTO fontes_destinos (usuario_id,nome,tipo) VALUES ($1,'Conta','conta') RETURNING id",
    [usuario],
  );
  const { rows: cartoes } = await query(
    "INSERT INTO fontes_destinos (usuario_id,nome,tipo,dia_fechamento,dia_vencimento,limite) VALUES ($1,'Cartão','cartao_credito',10,20,500) RETURNING id",
    [usuario],
  );
  await query(
    `INSERT INTO lancamentos (usuario_id,tipo,descricao,valor,data,categoria_id,fonte_destino_id)
     VALUES ($1,'saida','Anterior',20,'2026-10-31',$2,$3),
            ($1,'saida','Atual',40,'2026-11-01',$2,$3),
            ($1,'saida','No fechamento',100,
              date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date + 9,$2,$4)`,
    [usuario, categorias[0].id, fontes[0].id, cartoes[0].id],
  );
});

after(async () => {
  if (servidor) await new Promise((resolve) => servidor.close(resolve));
  try {
    if (usuario) await query('DELETE FROM usuarios WHERE id = $1', [usuario]);
  } finally {
    await pool.end();
  }
});

async function obter(recurso) {
  const resposta = await fetch(url + recurso, { headers });
  assert.equal(resposta.status, 200);
  return resposta.json();
}

test('os três relatórios exigem autenticação', async () => {
  for (const recurso of ['categorias', 'fontes-destinos', 'faturas']) {
    assert.equal((await fetch(url + recurso)).status, 401);
  }
});

test('categorias valida datas e compara os períodos', opcoes, async () => {
  assert.equal((await fetch(url + 'categorias?inicio=2026-02-30&fim=2026-03-01', { headers })).status, 400);
  const dados = await obter('categorias' + periodo);
  assert.deepEqual(dados.periodoAnterior, { inicio: '2026-10-02', fim: '2026-10-31' });
  assert.equal(dados.saidas.categorias[0].anterior, 20);
  assert.equal(dados.saidas.categorias[0].percentual, 100);
  assert.equal(dados.saidas.categorias[0].variacao, (dados.saidas.total - 20) * 5);
});

test('fonte/destino retorna saldo por conta e totais', opcoes, async () => {
  const dados = await obter('fontes-destinos' + periodo);
  assert.equal(dados.fontesDestinos.find(({ tipo }) => tipo === 'conta').saldo, -40);
  assert.equal(dados.fontesDestinos.find(({ tipo }) => tipo === 'cartao_credito').saldo, null);
  assert.equal(dados.totais.entradas, 0);
  assert.equal(dados.totais.saldo, -dados.totais.saidas);
});

test('faturas coloca compra no fechamento no mês seguinte', opcoes, async () => {
  const { cartoes: [cartao] } = await obter('faturas?meses=2');
  assert.equal(cartao.faturas.length, 3);
  const fatura = cartao.faturas.find(({ lancamentos }) => lancamentos.length > 0);
  const hoje = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [ano, mes] = hoje.split('-').map(Number);
  assert.equal(fatura.vencimento, new Date(Date.UTC(ano, mes, 20)).toISOString().slice(0, 10));
  assert.equal(cartao.limiteDisponivel, 400);
});
