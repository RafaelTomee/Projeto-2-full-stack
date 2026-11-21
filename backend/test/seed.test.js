// Teste do seed. Cria um banco TEMPORÁRIO (e apaga no final), então nunca mexe nos dados
// de demonstração de ninguém. Precisa de DATABASE_URL apontando para um PostgreSQL com
// permissão de criar bancos (a mesma do npm run db:create). Sem banco, os testes são ignorados.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcrypt';
import pg from 'pg';
import 'dotenv/config';
import {
  SENHA_DEMO, dataRelativa, dividirEmParcelas, executarSeed, montarLancamentos,
} from '../database/seed.js';
import { cpfValido } from '../src/models/validacoes.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(path.join(aqui, '../database/schema.sql'), 'utf8');
const NOME_BANCO = `financas_seedtest_${process.pid}`;

const utc = (texto) => new Date(`${texto}T00:00:00Z`);
const HOJE = utc('2026-11-20');

// ---- Implementação de referência do enunciado (seção 10.5.9), usada só para conferir o seed.
// Quando a Pessoa C criar o calcularFatura de verdade, este teste pode importar o dela.
function ultimoDiaDoMes(ano, mes) { return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate(); }
function dataSegura(ano, mes, dia) {
  const a = ano + Math.floor(mes / 12);
  const m = ((mes % 12) + 12) % 12;
  return new Date(Date.UTC(a, m, Math.min(dia, ultimoDiaDoMes(a, m))));
}
function calcularFatura(dataCompra, cartao, numeroParcela = 1) {
  const [ano, mes, dia] = dataCompra.split('-').map(Number);
  const m = mes - 1;
  const fechamentoDoMes = Math.min(cartao.diaFechamento, ultimoDiaDoMes(ano, m));
  let mesFechamento = dia < fechamentoDoMes ? m : m + 1;
  mesFechamento += numeroParcela - 1;
  const fechamento = dataSegura(ano, mesFechamento, cartao.diaFechamento);
  const mesVencimento = cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : mesFechamento + 1;
  const vencimento = dataSegura(ano, mesVencimento, cartao.diaVencimento);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { referencia: iso(vencimento).slice(0, 7), fechamento: iso(fechamento), vencimento: iso(vencimento) };
}

// ---- Funções puras (não precisam de banco)

test('dividirEmParcelas: centavos exatos, diferença na primeira parcela', () => {
  assert.deepEqual(dividirEmParcelas(10000, 3), [3334, 3333, 3333]); // R$ 100,00 em 3x
  assert.deepEqual(dividirEmParcelas(89990, 3), [29998, 29996, 29996]);
  assert.deepEqual(dividirEmParcelas(12000, 4), [3000, 3000, 3000, 3000]);
  for (const [total, n] of [[429990, 10], [240000, 12], [219990, 12], [1, 3], [100, 48]]) {
    const partes = dividirEmParcelas(total, n);
    assert.equal(partes.length, n);
    assert.equal(partes.reduce((s, v) => s + v, 0), total, `${total} em ${n}x`);
    assert.ok(partes.every((p) => p >= 0));
  }
});

test('dataRelativa: meses anteriores, virada de ano, fim de mês e sem datas futuras', () => {
  assert.equal(dataRelativa(HOJE, 0, 5), '2026-11-05');
  assert.equal(dataRelativa(HOJE, -1, 25), '2026-10-25');
  assert.equal(dataRelativa(HOJE, -2, 25), '2026-09-25');
  assert.equal(dataRelativa(HOJE, 0, 28), '2026-11-20'); // dia que ainda não chegou vira hoje
  assert.equal(dataRelativa(utc('2027-01-10'), -2, 15), '2026-11-15'); // virada de ano
  assert.equal(dataRelativa(utc('2026-03-31'), -1, 31), '2026-02-28'); // fevereiro
});

test('os CPFs de demonstração são válidos', () => {
  for (const cpf of ['11144477735', '12345678909']) assert.equal(cpfValido(cpf), true, cpf);
});

// ---- Com banco

let admin;
let client;
let temBanco = true;
let resumo;

before(async () => {
  try {
    const adminUrl = new URL(process.env.DATABASE_URL);
    adminUrl.pathname = '/postgres';
    admin = new pg.Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(NOME_BANCO)}`);

    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/${NOME_BANCO}`;
    client = new pg.Client({ connectionString: url.toString() });
    await client.connect();
    await client.query(schema);
    resumo = await executarSeed(client, { hoje: HOJE });
  } catch (erro) {
    temBanco = false;
    await admin?.end().catch(() => {});
    admin = undefined;
    console.log(`(seed.test: sem banco utilizável, testes de integração ignorados: ${erro.message})`);
  }
});

after(async () => {
  if (client) await client.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS ${pg.escapeIdentifier(NOME_BANCO)}`);
    await admin.end();
  }
});

const opcoes = () => ({ skip: temBanco ? false : 'banco não configurado (.env / npm run db:create)' });
const consultar = async (sql, params) => (await client.query(sql, params)).rows;

test('cria os 2 usuários de demonstração, com senha em hash e e-mail/CPF normalizados', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  const usuarios = await consultar('SELECT id, nome, email, cpf, senha_hash FROM usuarios ORDER BY id');
  assert.equal(usuarios.length, 2);
  assert.deepEqual(usuarios.map((u) => u.email), ['ana@demo.com', 'bruno@demo.com']);
  for (const u of usuarios) {
    assert.match(u.cpf, /^\d{11}$/);
    assert.match(u.senha_hash, /^\$2[aby]\$/);
    assert.equal(await bcrypt.compare(SENHA_DEMO, u.senha_hash), true, `${u.email} entra com a senha de demonstração`);
    assert.equal(await bcrypt.compare('outra-senha-1', u.senha_hash), false);
  }
  assert.equal(resumo.length, 2);
});

test('cada usuário tem categorias e fontes/destinos próprios, e há 2 cartões de crédito', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  const porUsuario = await consultar(
    `SELECT u.email,
            (SELECT COUNT(*)::int FROM categorias c WHERE c.usuario_id = u.id) AS categorias,
            (SELECT COUNT(*)::int FROM fontes_destinos f WHERE f.usuario_id = u.id) AS fontes,
            (SELECT COUNT(*)::int FROM fontes_destinos f WHERE f.usuario_id = u.id AND f.tipo = 'cartao_credito') AS cartoes,
            (SELECT COUNT(*)::int FROM fontes_destinos f WHERE f.usuario_id = u.id AND f.reserva) AS reservas
       FROM usuarios u ORDER BY u.id`,
  );
  const [ana, bruno] = porUsuario;
  assert.equal(ana.cartoes, 2, 'Ana tem 2 cartões');
  assert.ok(bruno.cartoes >= 1);
  assert.ok(ana.reservas >= 1 && bruno.reservas >= 1, 'cada um tem uma conta marcada como reserva');
  for (const u of porUsuario) assert.ok(u.categorias >= 8 && u.fontes >= 3, u.email);

  // Dados diferentes entre os usuários (para demonstrar o isolamento)
  const exclusivas = await consultar(
    `SELECT nome FROM categorias WHERE nome IN ('Pets','Freelance') ORDER BY nome`,
  );
  assert.deepEqual(exclusivas.map((c) => c.nome), ['Freelance', 'Pets']);
  const totais = await consultar(`SELECT usuario_id, SUM(valor)::numeric AS total FROM lancamentos GROUP BY usuario_id`);
  assert.equal(totais.length, 2);
  assert.notEqual(totais[0].total, totais[1].total);
});

test('cartões seguem o enunciado: Nubank fecha 3/vence 10; Visa fecha 25/vence 5; dias entre 1 e 31', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  const cartoes = await consultar(
    `SELECT nome, dia_fechamento, dia_vencimento, limite::float AS limite
       FROM fontes_destinos WHERE tipo = 'cartao_credito' ORDER BY id`,
  );
  const nubank = cartoes.find((c) => c.nome === 'Nubank');
  const visa = cartoes.find((c) => c.nome === 'Visa crédito');
  assert.deepEqual([nubank.dia_fechamento, nubank.dia_vencimento], [3, 10]);
  assert.deepEqual([visa.dia_fechamento, visa.dia_vencimento], [25, 5]);
  for (const c of cartoes) {
    assert.ok(c.dia_fechamento >= 1 && c.dia_fechamento <= 31 && c.dia_vencimento >= 1 && c.dia_vencimento <= 31);
    assert.ok(c.limite > 0);
  }
});

test('lançamentos cobrem 3 meses e nenhum tem data futura', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  for (const email of ['ana@demo.com', 'bruno@demo.com']) {
    const meses = await consultar(
      `SELECT to_char(l.data, 'YYYY-MM') AS mes, COUNT(*)::int AS n
         FROM lancamentos l JOIN usuarios u ON u.id = l.usuario_id
        WHERE u.email = $1 GROUP BY 1 ORDER BY 1`,
      [email],
    );
    assert.deepEqual(meses.map((m) => m.mes), ['2026-09', '2026-10', '2026-11'], email);
    assert.ok(meses.every((m) => m.n >= 5), `${email}: dados em todos os meses`);
  }
  const [{ futuras }] = await consultar(`SELECT COUNT(*)::int AS futuras FROM lancamentos WHERE data > $1`, ['2026-11-20']);
  assert.equal(futuras, 0);
});

test('entradas e saídas variadas, todas com valor positivo e ao menos uma de cada tipo por mês', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  const linhas = await consultar(
    `SELECT u.email, to_char(l.data, 'YYYY-MM') AS mes, l.tipo, COUNT(*)::int AS n, MIN(l.valor)::float AS minimo
       FROM lancamentos l JOIN usuarios u ON u.id = l.usuario_id GROUP BY 1, 2, 3`,
  );
  assert.ok(linhas.every((l) => l.minimo > 0));
  for (const email of ['ana@demo.com', 'bruno@demo.com']) {
    for (const mes of ['2026-09', '2026-10', '2026-11']) {
      for (const tipo of ['entrada', 'saida']) {
        assert.ok(linhas.some((l) => l.email === email && l.mes === mes && l.tipo === tipo), `${email} ${mes} ${tipo}`);
      }
    }
  }
});

test('integridade: categoria e fonte/destino de cada lançamento são do MESMO usuário e o tipo bate', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  const [{ outroDono }] = await consultar(
    `SELECT COUNT(*)::int AS "outroDono"
       FROM lancamentos l
       JOIN categorias c ON c.id = l.categoria_id
       JOIN fontes_destinos f ON f.id = l.fonte_destino_id
      WHERE c.usuario_id <> l.usuario_id OR f.usuario_id <> l.usuario_id`,
  );
  assert.equal(outroDono, 0, 'nenhum lançamento aponta para categoria/fonte de outro usuário');
  const [{ tipoErrado }] = await consultar(
    `SELECT COUNT(*)::int AS "tipoErrado" FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id WHERE c.tipo <> l.tipo`,
  );
  assert.equal(tipoErrado, 0, 'lançamento só usa categoria do mesmo tipo');
});

test('compras parceladas: parcelas 1..N, mesmo grupo, soma exata, só em cartão', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  const grupos = await consultar(
    `SELECT l.grupo_parcelamento AS grupo, u.email, MIN(l.descricao) AS descricao, COUNT(*)::int AS n,
            MAX(l.total_parcelas)::int AS total, SUM(l.valor)::text AS soma,
            array_agg(l.parcela_atual ORDER BY l.parcela_atual) AS parcelas, MIN(f.tipo) AS tipo_fonte
       FROM lancamentos l
       JOIN usuarios u ON u.id = l.usuario_id
       JOIN fontes_destinos f ON f.id = l.fonte_destino_id
      WHERE l.grupo_parcelamento IS NOT NULL GROUP BY l.grupo_parcelamento, u.email ORDER BY 3`,
  );
  const porNome = Object.fromEntries(grupos.map((g) => [g.descricao, g]));
  assert.deepEqual(Object.keys(porNome).sort(), ['Geladeira', 'Notebook', 'Smartphone', 'Tênis de corrida']);
  const esperado = { Notebook: ['4299.90', 10], Geladeira: ['2400.00', 12], 'Tênis de corrida': ['899.90', 3], Smartphone: ['2199.90', 12] };
  for (const [nome, [soma, n]] of Object.entries(esperado)) {
    const g = porNome[nome];
    assert.equal(g.soma, soma, `${nome}: as parcelas somam exatamente o valor da compra`);
    assert.equal(g.n, n);
    assert.equal(g.total, n);
    assert.deepEqual(g.parcelas, Array.from({ length: n }, (_, i) => i + 1));
    assert.equal(g.tipo_fonte, 'cartao_credito');
  }
  // R$ 899,90 em 3x: diferença de centavos na primeira parcela
  const tenis = await consultar(`SELECT valor::text AS valor FROM lancamentos WHERE descricao = 'Tênis de corrida' ORDER BY parcela_atual`);
  assert.deepEqual(tenis.map((t) => t.valor), ['299.98', '299.96', '299.96']);
  // Lançamentos comuns não têm grupo
  const [{ semGrupoComParcelas }] = await consultar(
    `SELECT COUNT(*)::int AS "semGrupoComParcelas" FROM lancamentos WHERE grupo_parcelamento IS NULL AND total_parcelas > 1`,
  );
  assert.equal(semGrupoComParcelas, 0);
});

test('limite dos cartões comporta as compras parceladas (limite usado <= limite)', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  const linhas = await consultar(
    `SELECT f.nome, f.limite::float AS limite, SUM(l.valor)::float AS usado
       FROM fontes_destinos f JOIN lancamentos l ON l.fonte_destino_id = f.id
      WHERE f.tipo = 'cartao_credito' AND l.grupo_parcelamento IS NOT NULL GROUP BY f.id, f.nome, f.limite`,
  );
  assert.ok(linhas.length >= 3);
  for (const l of linhas) assert.ok(l.usado <= l.limite, `${l.nome}: ${l.usado} <= ${l.limite}`);
});

test('compra no dia do fechamento cai na fatura do mês seguinte (regra do enunciado)', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  const compras = await consultar(
    `SELECT l.descricao, to_char(l.data, 'YYYY-MM-DD') AS data, f.dia_fechamento AS "diaFechamento", f.dia_vencimento AS "diaVencimento"
       FROM lancamentos l JOIN fontes_destinos f ON f.id = l.fonte_destino_id
      WHERE l.descricao LIKE '%no dia do fechamento%' OR l.descricao LIKE '%um dia antes do fechamento%'`,
  );
  const noDia = compras.filter((c) => c.descricao.includes('no dia do fechamento'));
  const antes = compras.filter((c) => c.descricao.includes('um dia antes'));
  assert.equal(noDia.length, 3, 'Ana (Nubank e Visa) e Bruno têm uma compra no dia do fechamento');
  assert.equal(antes.length, 3);

  for (const c of noDia) {
    assert.equal(Number(c.data.slice(8)), c.diaFechamento, `${c.descricao}: a data é o dia do fechamento`);
    const f = calcularFatura(c.data, c);
    const mesCompra = Number(c.data.slice(5, 7));
    assert.equal(Number(f.fechamento.slice(5, 7)), (mesCompra % 12) + 1, `${c.descricao}: fecha no mês seguinte`);
  }
  for (const c of antes) {
    const f = calcularFatura(c.data, c);
    assert.equal(Number(f.fechamento.slice(5, 7)), Number(c.data.slice(5, 7)), `${c.descricao}: fecha no mesmo mês`);
  }
});

test('fatura das parcelas segue os exemplos do enunciado (Tabela 10.3)', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  // Notebook: comprado em 2026-09-12 no Visa (fecha 25, vence 5). 1ª parcela: fecha 25/09, vence 05/10.
  const notebook = await consultar(
    `SELECT to_char(l.data, 'YYYY-MM-DD') AS data, l.parcela_atual AS parcela
       FROM lancamentos l WHERE l.descricao = 'Notebook' ORDER BY l.parcela_atual`,
  );
  const visa = { diaFechamento: 25, diaVencimento: 5 };
  assert.deepEqual(calcularFatura(notebook[0].data, visa, 1), { referencia: '2026-10', fechamento: '2026-09-25', vencimento: '2026-10-05' });
  assert.deepEqual(calcularFatura(notebook[9].data, visa, 10), { referencia: '2027-07', fechamento: '2027-06-25', vencimento: '2027-07-05' });
});

test('é idempotente: rodar de novo não duplica usuários nem lançamentos e não mexe em outras contas', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  // Uma conta "de verdade" que o seed não pode tocar
  await client.query(
    `INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ('Real', 'real@teste.com', '52998224725', 'hash')`,
  );
  const antes = await consultar('SELECT COUNT(*)::int AS n FROM lancamentos');
  const resumo2 = await executarSeed(client, { hoje: HOJE });
  const depois = await consultar('SELECT COUNT(*)::int AS n FROM lancamentos');
  assert.equal(depois[0].n, antes[0].n);
  assert.equal((await consultar('SELECT COUNT(*)::int AS n FROM usuarios'))[0].n, 3);
  assert.equal((await consultar(`SELECT COUNT(*)::int AS n FROM usuarios WHERE email = 'real@teste.com'`))[0].n, 1);
  assert.equal(resumo2.length, 2);
  await client.query(`DELETE FROM usuarios WHERE email = 'real@teste.com'`);
});

test('funciona em qualquer dia do mês: sem data futura e sem perder lançamentos', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  const esperado = (await consultar('SELECT COUNT(*)::int AS n FROM lancamentos'))[0].n;
  for (const dia of ['2026-11-01', '2026-11-02', '2027-01-31', '2026-03-31', '2028-02-29']) {
    await executarSeed(client, { hoje: utc(dia) });
    const [{ n, maxData, minData }] = await consultar(
      `SELECT COUNT(*)::int AS n, to_char(MAX(data), 'YYYY-MM-DD') AS "maxData", to_char(MIN(data), 'YYYY-MM-DD') AS "minData" FROM lancamentos`,
    );
    assert.equal(n, esperado, `hoje = ${dia}`);
    assert.ok(maxData <= dia, `hoje = ${dia}: maior data ${maxData}`);
    const dentro = dataRelativa(utc(dia), -2, 1);
    assert.ok(minData >= dentro, `hoje = ${dia}: menor data ${minData} dentro dos 3 meses`);
  }
  await executarSeed(client, { hoje: HOJE }); // volta ao estado do restante dos testes
});

test('um CPF ou e-mail de demonstração já usado por outra conta falha com a mensagem do banco e não deixa lixo', async (t) => {
  if (!temBanco) return t.skip('sem banco');
  await client.query(`DELETE FROM usuarios WHERE email IN ('ana@demo.com', 'bruno@demo.com')`);
  await client.query(`INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ('Dono do CPF', 'dono@teste.com', '11144477735', 'hash')`);
  await assert.rejects(executarSeed(client, { hoje: HOJE }), (e) => e.code === '23505');
  // ROLLBACK: nada do seed ficou gravado
  assert.equal((await consultar(`SELECT COUNT(*)::int AS n FROM usuarios WHERE email LIKE '%@demo.com'`))[0].n, 0);
  assert.equal((await consultar('SELECT COUNT(*)::int AS n FROM lancamentos'))[0].n, 0);
  await client.query(`DELETE FROM usuarios WHERE email = 'dono@teste.com'`);
});

test('montarLancamentos recusa dados inconsistentes (categoria/fonte inexistente, parcelado fora do cartão)', () => {
  const base = {
    nome: 'T', categorias: [['saida', 'Moradia']], fontes: [{ nome: 'Conta', tipo: 'conta' }],
  };
  const item = { tipo: 'saida', descricao: 'x', categoria: 'Moradia', fonte: 'Conta', mes: 0, dia: 1, valor: 10 };
  assert.throws(() => montarLancamentos({ ...base, lancamentos: [{ ...item, fonte: 'Nada' }] }, HOJE), /fonte\/destino "Nada"/);
  assert.throws(() => montarLancamentos({ ...base, lancamentos: [{ ...item, categoria: 'Nada' }] }, HOJE), /categoria "Nada"/);
  assert.throws(() => montarLancamentos({ ...base, lancamentos: [{ ...item, tipo: 'entrada' }] }, HOJE), /categoria "Moradia"/);
  assert.throws(() => montarLancamentos({ ...base, lancamentos: [{ ...item, parcelas: 3 }] }, HOJE), /parcelado fora de cartão/);
});
