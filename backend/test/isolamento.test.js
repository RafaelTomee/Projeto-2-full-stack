// Teste do RF3 (isolamento de dados entre usuários), de ponta a ponta e em caixa-preta.
//
// Sobe o servidor de verdade (node src/server.js) num banco TEMPORÁRIO, cadastra 2 usuários
// (A e B) pela API e tenta, com o token de A, ler/editar/excluir/criar usando dados de B.
// Só fala HTTP: não depende de como as rotas foram escritas.
//
// - Rotas que ainda não existem (404 "Rota não encontrada.") são IGNORADAS com aviso, e o
//   teste passa a valer sozinho quando elas forem criadas.
// - Para exigir que TODAS existam (use antes da entrega): RF3_COMPLETO=1 npm test
// - Sem banco configurado (DATABASE_URL), o arquivo inteiro é ignorado.
//
// Se um teste falhar por causa do FORMATO do corpo enviado (ex.: o PUT de lançamentos exige
// outro nome de campo), ajuste a seção CORPOS logo abaixo.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import 'dotenv/config';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raizBackend = path.join(aqui, '..');
const schema = readFileSync(path.join(raizBackend, 'database/schema.sql'), 'utf8');
const NOME_BANCO = `financas_rf3_${process.pid}`;
const SEGREDO = 'segredo-do-teste-rf3-bem-longo-0123456789';
const EXIGIR_TUDO = process.env.RF3_COMPLETO === '1';
const ROTA_AUSENTE = 'Rota não encontrada.';
// Rotas que o enunciado NÃO exige (ficam de fora do RF3_COMPLETO): detalhe de categoria/fonte e o desafio.
const OPCIONAIS = ['categorias:GET', 'fontes-destinos:GET'];
const caminhoOpcional = (caminho) => caminho.startsWith('/api/saude-financeira');

// ---------------------------------------------------------------------------
// CORPOS: formato das requisições de escrita (nomes de campo do enunciado, seção 10.6).
const CORPOS = {
  categorias: () => ({ nome: `RF3 categoria ${Math.random().toString(36).slice(2, 8)}`, tipo: 'saida' }),
  'fontes-destinos': () => ({ nome: `RF3 conta ${Math.random().toString(36).slice(2, 8)}`, tipo: 'conta' }),
  // fks: { categoriaId, fonteDestinoId } do PRÓPRIO usuário que faz a requisição
  lancamentos: (fks, extra = {}) => ({
    tipo: 'saida', descricao: 'RF3 lançamento', valor: 12.34, data: '2026-11-10',
    categoriaId: fks.categoriaId, fonteDestinoId: fks.fonteDestinoId, ...extra,
  }),
};

const RECURSOS = [
  { nome: 'categorias', base: '/api/categorias', tabela: 'categorias' },
  { nome: 'fontes-destinos', base: '/api/fontes-destinos', tabela: 'fontes_destinos' },
  { nome: 'lancamentos', base: '/api/lancamentos', tabela: 'lancamentos' },
];

// ---------------------------------------------------------------------------
// Infraestrutura

let admin;
let db;
let servidor;
let saidaServidor = '';
let base;
let pronto = false;
let motivoSemBanco = '';
const registro = []; // todas as respostas recebidas (para varrer senha_hash e 500)

const livre = () => new Promise((ok, falha) => {
  const s = net.createServer();
  s.listen(0, () => { const { port } = s.address(); s.close(() => ok(port)); });
  s.on('error', falha);
});

async function chamar(metodo, caminho, { token, corpo, cabecalhos } = {}) {
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...cabecalhos,
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* não era JSON */ }
  const r = { metodo, caminho, status: resposta.status, texto, json };
  registro.push(r);
  return r;
}

const ausente = (r) => r.status === 404 && r.json?.erro === ROTA_AUSENTE;

function gerarCpf() {
  const d = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (n) => {
    const soma = d.slice(0, n).reduce((s, v, i) => s + v * (n + 1 - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  d.push(dv(9));
  d.push(dv(10));
  return d.join('');
}

const q = async (sql, params) => (await db.query(sql, params)).rows;

// Cria, direto no banco, os dados de um usuário. Cada linha tem um marcador único
// ("RF3-SEGREDO-<rotulo>") para detectar vazamentos procurando o texto nas respostas.
async function criarDados(usuarioId, rotulo) {
  const marca = `RF3-SEGREDO-${rotulo}`;
  const categoria = async (sufixo) => (await q(
    `INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, 'saida') RETURNING id`,
    [usuarioId, `${marca}-categoria-${sufixo}`]))[0].id;
  const fonte = async (sufixo, tipo = 'conta') => (await q(
    `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [usuarioId, `${marca}-${tipo === 'conta' ? 'conta' : 'cartao'}-${sufixo}`, tipo,
      tipo === 'conta' ? null : 10, tipo === 'conta' ? null : 17, tipo === 'conta' ? null : 5000]))[0].id;
  const lancamento = async (sufixo, catId, fonteId, valor) => (await q(
    `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
     VALUES ($1, 'saida', $2, $3, '2026-11-05', $4, $5) RETURNING id`,
    [usuarioId, `${marca}-lancamento-${sufixo}`, valor, catId, fonteId]))[0].id;

  const valor = rotulo === 'B' ? '987654.32' : '111.11';
  const catAlvo = await categoria('alvo');
  const fonteAlvo = await fonte('alvo');
  const cartao = await fonte('alvo', 'cartao_credito');
  return {
    marca, valor,
    // alvos: linhas que o outro usuário tenta atacar (nunca podem mudar)
    categorias: { alvo: catAlvo, putOk: await categoria('put'), delOk: await categoria('del') },
    'fontes-destinos': { alvo: fonteAlvo, putOk: await fonte('put'), delOk: await fonte('del'), cartao },
    lancamentos: {
      alvo: await lancamento('alvo', catAlvo, fonteAlvo, valor),
      putOk: await lancamento('put', catAlvo, fonteAlvo, '5.00'),
      delOk: await lancamento('del', catAlvo, fonteAlvo, '6.00'),
      noCartao: await lancamento('cartao', catAlvo, cartao, valor),
    },
    fks: { categoriaId: catAlvo, fonteDestinoId: fonteAlvo },
  };
}

// Fotografia só das linhas que são ALVO de ataque (as dos controles positivos o dono edita e
// apaga de propósito, então ficam de fora). Se algo mudar, um ataque teve efeito.
const idsAlvo = (dados, recurso) => [dados[recurso].alvo, dados[recurso].cartao, dados[recurso].noCartao].filter(Boolean);

async function fotografia(dados) {
  const saida = {};
  for (const r of RECURSOS) {
    saida[r.nome] = await q(`SELECT * FROM ${r.tabela} WHERE id = ANY($1) ORDER BY id`, [idsAlvo(dados, r.nome)]);
  }
  return JSON.stringify(saida);
}

let A; let B; // { id, token, dados }
let fotoInicialB;
let fotoInicialA;
const controles = {}; // `${recurso}:${metodo}` -> 'ok' | 'ausente' | { falhou: resposta }
const existe = {};    // recurso -> a rota de listagem existe

before(async () => {
  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida');
    const adminUrl = new URL(process.env.DATABASE_URL);
    adminUrl.pathname = '/postgres';
    admin = new pg.Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(NOME_BANCO)}`);

    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/${NOME_BANCO}`;
    db = new pg.Client({ connectionString: url.toString() });
    await db.connect();
    await db.query(schema);

    // Sobe o servidor de verdade apontando para o banco temporário.
    const porta = await livre();
    base = `http://127.0.0.1:${porta}`;
    servidor = spawn(process.execPath, ['src/server.js'], {
      cwd: raizBackend,
      env: { ...process.env, PORT: String(porta), DATABASE_URL: url.toString(), JWT_SECRET: SEGREDO, FRONTEND_URL: 'http://localhost:5173' },
    });
    servidor.stdout.on('data', (d) => { saidaServidor += d; });
    servidor.stderr.on('data', (d) => { saidaServidor += d; });
    await new Promise((ok, falha) => {
      const limite = setTimeout(() => falha(new Error(`servidor não iniciou:\n${saidaServidor}`)), 15000);
      const olhar = setInterval(() => {
        if (saidaServidor.includes('API rodando')) { clearTimeout(limite); clearInterval(olhar); ok(); }
      }, 50);
      servidor.on('exit', () => { clearTimeout(limite); clearInterval(olhar); falha(new Error(`servidor encerrou:\n${saidaServidor}`)); });
    });

    // Cadastra e autentica os dois usuários PELA API (usa o cadastro e o login reais).
    const entrar = async (rotulo) => {
      const email = `rf3-${rotulo.toLowerCase()}@teste.com`;
      const cad = await chamar('POST', '/api/auth/cadastro', {
        corpo: { nome: `Usuário ${rotulo}`, email, cpf: gerarCpf(), senha: 'Senha123' },
      });
      assert.equal(cad.status, 201, `cadastro de ${rotulo}: ${cad.texto}`);
      const log = await chamar('POST', '/api/auth/login', { corpo: { email, senha: 'Senha123' } });
      assert.equal(log.status, 200, `login de ${rotulo}: ${log.texto}`);
      return { id: cad.json.id, token: log.json.token, email };
    };
    A = await entrar('A');
    B = await entrar('B');
    A.dados = await criarDados(A.id, 'A');
    B.dados = await criarDados(B.id, 'B');
    fotoInicialA = await fotografia(A.dados);
    fotoInicialB = await fotografia(B.dados);

    // Controles positivos: cada dono consegue usar as próprias rotas. Sem isso, um "404" no
    // ataque poderia ser só "a rota não existe" ou "o corpo enviado estava errado".
    for (const r of RECURSOS) {
      const lista = await chamar('GET', r.base, { token: B.token });
      existe[r.nome] = !ausente(lista);

      const get = await chamar('GET', `${r.base}/${B.dados[r.nome].alvo}`, { token: B.token });
      controles[`${r.nome}:GET`] = ausente(get) ? 'ausente' : get.status === 200 ? 'ok' : { falhou: get };

      const corpoPut = r.nome === 'lancamentos' ? CORPOS.lancamentos(B.dados.fks) : CORPOS[r.nome]();
      const put = await chamar('PUT', `${r.base}/${B.dados[r.nome].putOk}`, { token: B.token, corpo: corpoPut });
      controles[`${r.nome}:PUT`] = ausente(put) ? 'ausente' : put.status >= 200 && put.status < 300 ? 'ok' : { falhou: put };

      const del = await chamar('DELETE', `${r.base}/${B.dados[r.nome].delOk}`, { token: B.token });
      controles[`${r.nome}:DELETE`] = ausente(del) ? 'ausente' : del.status >= 200 && del.status < 300 ? 'ok' : { falhou: del };
    }
    pronto = true;
  } catch (erro) {
    motivoSemBanco = erro.message;
    console.log(`(isolamento.test: ignorado, ambiente indisponível: ${erro.message.split('\n')[0]})`);
  }
});

after(async () => {
  if (servidor && !servidor.killed) servidor.kill();
  if (db) await db.end().catch(() => {});
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS ${pg.escapeIdentifier(NOME_BANCO)} WITH (FORCE)`).catch(() => {});
    await admin.end().catch(() => {});
  }
});

// Usado no início de cada teste: ignora se não há ambiente.
const semAmbiente = (t) => {
  if (pronto) return false;
  t.skip(`ambiente indisponível: ${motivoSemBanco || 'sem banco'}`);
  return true;
};

// Decide se um trecho pode ser verificado. Rota ausente: ignora com aviso (ou falha se RF3_COMPLETO=1).
function disponivel(t, chave, descricao) {
  const estado = controles[chave];
  if (estado === 'ok') return true;
  if (estado === 'ausente') {
    if (EXIGIR_TUDO && !OPCIONAIS.includes(chave)) assert.fail(`RF3_COMPLETO=1: a rota ${descricao} ainda não existe`);
    t.diagnostic(`IGNORADO: ${descricao} ainda não existe`);
    return false;
  }
  const f = estado?.falhou;
  assert.fail(
    `O controle positivo falhou: o DONO não conseguiu usar ${descricao} ` +
    `(${f?.metodo} ${f?.caminho} -> ${f?.status} ${f?.texto?.slice(0, 200)}). ` +
    'Se o corpo enviado pelo teste não é o esperado pela rota, ajuste a seção CORPOS deste arquivo.',
  );
  return false;
}

// ---------------------------------------------------------------------------
// Todas as rotas protegidas (para os testes de token)

function rotasProtegidas() {
  const l = B.dados;
  const lista = [
    ['GET', '/api/auth/me'],
    ['GET', '/api/categorias'],
    ['POST', '/api/categorias', CORPOS.categorias()],
    ['PUT', `/api/categorias/${l.categorias.alvo}`, CORPOS.categorias()],
    ['DELETE', `/api/categorias/${l.categorias.alvo}`],
    ['GET', '/api/fontes-destinos'],
    ['POST', '/api/fontes-destinos', CORPOS['fontes-destinos']()],
    ['PUT', `/api/fontes-destinos/${l['fontes-destinos'].alvo}`, CORPOS['fontes-destinos']()],
    ['DELETE', `/api/fontes-destinos/${l['fontes-destinos'].alvo}`],
    ['GET', '/api/lancamentos'],
    ['POST', '/api/lancamentos', CORPOS.lancamentos(l.fks)],
    ['GET', `/api/lancamentos/${l.lancamentos.alvo}`],
    ['PUT', `/api/lancamentos/${l.lancamentos.alvo}`, CORPOS.lancamentos(l.fks)],
    ['DELETE', `/api/lancamentos/${l.lancamentos.alvo}`],
    ['GET', '/api/relatorios/categorias?inicio=2026-01-01&fim=2026-12-31'],
    ['GET', '/api/relatorios/fontes-destinos?inicio=2026-01-01&fim=2026-12-31'],
    ['GET', '/api/relatorios/faturas?meses=3'],
    ['GET', '/api/saude-financeira'],
  ];
  return lista.map(([metodo, caminho, corpo]) => ({ metodo, caminho, corpo }));
}

// ---------------------------------------------------------------------------
// 1) Sem token e token inválido -> 401

test('sem token: TODAS as rotas protegidas respondem 401', async (t) => {
  if (semAmbiente(t)) return;
  const ignoradas = [];
  for (const rota of rotasProtegidas()) {
    const r = await chamar(rota.metodo, rota.caminho, { corpo: rota.corpo });
    if (ausente(r)) {
      if (EXIGIR_TUDO && !caminhoOpcional(rota.caminho)) assert.fail(`RF3_COMPLETO=1: a rota ${rota.metodo} ${rota.caminho} não existe`);
      ignoradas.push(`${rota.metodo} ${rota.caminho.split('?')[0]}`);
      continue;
    }
    assert.equal(r.status, 401, `${rota.metodo} ${rota.caminho} sem token deveria dar 401 (deu ${r.status})`);
    assert.equal(typeof r.json?.erro, 'string', `${rota.metodo} ${rota.caminho}: resposta no padrão { erro }`);
  }
  if (ignoradas.length) t.diagnostic(`IGNORADAS (rota inexistente): ${ignoradas.join(', ')}`);
  assert.equal(await fotografia(B.dados), fotoInicialB, 'os dados de B não mudaram');
});

test('token inválido, adulterado, expirado ou de outro segredo: 401 nas rotas protegidas', async (t) => {
  if (semAmbiente(t)) return;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tokens = {
    'lixo': 'lixo.lixo.lixo',
    'adulterado': `${B.token.slice(0, -3)}abc`,
    'expirado': jwt.sign({}, SEGREDO, { subject: String(B.id), expiresIn: -60 }),
    'outro segredo': jwt.sign({}, 'outro-segredo-qualquer-123456', { subject: String(B.id), expiresIn: '1h' }),
    'alg none': `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: String(B.id) })}.`,
    'sem sub': jwt.sign({}, SEGREDO, { expiresIn: '1h' }),
  };
  const alvo = ['/api/auth/me', '/api/categorias', '/api/fontes-destinos', '/api/lancamentos', `/api/lancamentos/${B.dados.lancamentos.alvo}`];
  for (const [nome, token] of Object.entries(tokens)) {
    for (const caminho of alvo) {
      const r = await chamar('GET', caminho, { token });
      if (ausente(r)) continue;
      assert.equal(r.status, 401, `token ${nome} em GET ${caminho} deveria dar 401 (deu ${r.status})`);
      assert.equal(r.texto.includes('RF3-SEGREDO'), false, `token ${nome}: vazou dado de usuário`);
    }
  }
  // esquema errado (não é Bearer)
  const r = await chamar('GET', '/api/categorias', { cabecalhos: { authorization: `Basic ${B.token}` } });
  if (!ausente(r)) assert.equal(r.status, 401);
});

test('token válido de um usuário que não existe: nunca devolve dados de ninguém nem dá erro 500', async (t) => {
  if (semAmbiente(t)) return;
  const fantasma = jwt.sign({}, SEGREDO, { subject: '2147483000', expiresIn: '1h' });
  for (const caminho of ['/api/categorias', '/api/fontes-destinos', '/api/lancamentos',
    '/api/relatorios/categorias?inicio=2026-01-01&fim=2026-12-31', '/api/relatorios/faturas?meses=3']) {
    const r = await chamar('GET', caminho, { token: fantasma });
    if (ausente(r)) continue;
    assert.ok(r.status < 500, `${caminho}: erro do servidor (${r.status})`);
    assert.equal(r.texto.includes('RF3-SEGREDO'), false, `${caminho}: vazou dados para um usuário inexistente`);
  }
});

// ---------------------------------------------------------------------------
// 2) A tenta usar ids de B -> 404, e nada muda

for (const r of RECURSOS) {
  for (const metodo of ['GET', 'PUT', 'DELETE']) {
    test(`${metodo} ${r.base}/:id de OUTRO usuário responde 404 e não altera nada`, async (t) => {
      if (semAmbiente(t)) return;
      if (!disponivel(t, `${r.nome}:${metodo}`, `${metodo} ${r.base}/:id`)) return;

      // o dono acessa e funciona (controle); o outro usuário recebe 404
      const corpo = metodo === 'PUT'
        ? (r.nome === 'lancamentos' ? CORPOS.lancamentos(A.dados.fks, { descricao: 'RF3-INVASOR' }) : CORPOS[r.nome]())
        : undefined;
      const ataques = r.nome === 'lancamentos'
        ? [B.dados.lancamentos.alvo, B.dados.lancamentos.noCartao]
        : [B.dados[r.nome].alvo];
      for (const id of ataques) {
        const resp = await chamar(metodo, `${r.base}/${id}`, { token: A.token, corpo });
        assert.equal(resp.status, 404, `${metodo} ${r.base}/${id} (dado de B) com token de A deveria dar 404 (deu ${resp.status}: ${resp.texto.slice(0, 160)})`);
        assert.notEqual(resp.json?.erro, ROTA_AUSENTE, 'o 404 deve vir do recurso, não de rota inexistente');
        assert.equal(resp.texto.includes('RF3-SEGREDO-B'), false, 'a resposta não pode conter dados de B');
      }
      assert.equal(await fotografia(B.dados), fotoInicialB, 'as linhas de B continuam idênticas');
    });
  }
}

test('o isolamento vale nos dois sentidos: B também não alcança os dados de A', async (t) => {
  if (semAmbiente(t)) return;
  let verificadas = 0;
  for (const r of RECURSOS) {
    for (const metodo of ['GET', 'PUT', 'DELETE']) {
      if (controles[`${r.nome}:${metodo}`] !== 'ok') continue;
      const corpo = metodo === 'PUT'
        ? (r.nome === 'lancamentos' ? CORPOS.lancamentos(B.dados.fks) : CORPOS[r.nome]())
        : undefined;
      const resp = await chamar(metodo, `${r.base}/${A.dados[r.nome].alvo}`, { token: B.token, corpo });
      assert.equal(resp.status, 404, `${metodo} ${r.base}/<id de A> com token de B (deu ${resp.status})`);
      verificadas++;
    }
  }
  if (!verificadas) t.diagnostic('IGNORADO: nenhuma rota por id implementada ainda');
  assert.equal(await fotografia(A.dados), fotoInicialA, 'as linhas de A continuam idênticas');
});

// ---------------------------------------------------------------------------
// 3) Listagens e relatórios só trazem dados do próprio usuário

for (const r of RECURSOS) {
  test(`GET ${r.base} lista só os dados do próprio usuário`, async (t) => {
    if (semAmbiente(t)) return;
    if (!existe[r.nome]) {
      if (EXIGIR_TUDO) assert.fail(`RF3_COMPLETO=1: GET ${r.base} não existe`);
      return t.diagnostic(`IGNORADO: GET ${r.base} ainda não existe`);
    }
    const filtros = r.nome === 'lancamentos' ? '?inicio=2000-01-01&fim=2100-12-31&pagina=1' : '';
    const deB = await chamar('GET', `${r.base}${filtros}`, { token: B.token });
    assert.equal(deB.status, 200, `B listando os próprios dados: ${deB.texto.slice(0, 160)}`);
    assert.ok(deB.texto.includes('RF3-SEGREDO-B'), 'controle positivo: a listagem de B mostra os dados de B');

    const deA = await chamar('GET', `${r.base}${filtros}`, { token: A.token });
    assert.equal(deA.status, 200);
    assert.ok(deA.texto.includes('RF3-SEGREDO-A'), 'controle positivo: a listagem de A mostra os dados de A');
    assert.equal(deA.texto.includes('RF3-SEGREDO-B'), false, 'a listagem de A vazou dados de B');
    assert.equal(deA.texto.includes('987654'), false, 'a listagem de A vazou o valor de um lançamento de B');
  });
}

test('relatórios de A não incluem nada de B (por categoria, por fonte/destino e faturas)', async (t) => {
  if (semAmbiente(t)) return;
  const relatorios = [
    '/api/relatorios/categorias?inicio=2026-01-01&fim=2026-12-31',
    '/api/relatorios/fontes-destinos?inicio=2026-01-01&fim=2026-12-31',
    '/api/relatorios/faturas?meses=3',
    '/api/saude-financeira',
  ];
  for (const caminho of relatorios) {
    const doB = await chamar('GET', caminho, { token: B.token });
    if (ausente(doB)) {
      if (EXIGIR_TUDO && !caminhoOpcional(caminho)) assert.fail(`RF3_COMPLETO=1: GET ${caminho.split('?')[0]} não existe`);
      t.diagnostic(`IGNORADO: GET ${caminho.split('?')[0]} ainda não existe`);
      continue;
    }
    const doA = await chamar('GET', caminho, { token: A.token });
    assert.ok(doA.status < 500 && doB.status < 500, `${caminho}: erro do servidor`);
    assert.equal(doA.texto.includes('RF3-SEGREDO-B'), false, `${caminho}: o relatório de A vazou dados de B`);
    assert.equal(doA.texto.includes('987654'), false, `${caminho}: o relatório de A vazou valores de B`);
    if (!caminho.includes('saude-financeira')) {
      assert.ok(doB.texto.includes('RF3-SEGREDO-B'), `${caminho}: controle positivo, o relatório de B deveria mostrar os dados de B`);
    }
  }
});

// ---------------------------------------------------------------------------
// 4) Criar/editar com dados de outro usuário e id vindo do corpo

test('criar lançamento com categoria ou fonte/destino de OUTRO usuário é recusado (nada é gravado)', async (t) => {
  if (semAmbiente(t)) return;
  const criar = await chamar('POST', '/api/lancamentos', { token: A.token, corpo: CORPOS.lancamentos(A.dados.fks, { descricao: 'RF3-controle-ok' }) });
  if (ausente(criar)) {
    if (EXIGIR_TUDO) assert.fail('RF3_COMPLETO=1: POST /api/lancamentos não existe');
    return t.diagnostic('IGNORADO: POST /api/lancamentos ainda não existe');
  }
  assert.ok(criar.status === 201 || criar.status === 200, `controle positivo: A cria lançamento com as próprias categoria e fonte (deu ${criar.status}: ${criar.texto.slice(0, 200)}). Ajuste CORPOS se o formato for outro.`);

  const casos = {
    'categoria de B': { categoriaId: B.dados.fks.categoriaId, fonteDestinoId: A.dados.fks.fonteDestinoId },
    'fonte/destino de B': { categoriaId: A.dados.fks.categoriaId, fonteDestinoId: B.dados.fks.fonteDestinoId },
  };
  for (const [nome, fks] of Object.entries(casos)) {
    const r = await chamar('POST', '/api/lancamentos', { token: A.token, corpo: CORPOS.lancamentos(fks, { descricao: 'RF3-INTRUSO' }) });
    assert.ok(r.status === 404 || r.status === 400, `lançamento com ${nome} deveria ser recusado (404 ou 400), deu ${r.status}`);
  }
  assert.equal((await q(`SELECT COUNT(*)::int AS n FROM lancamentos WHERE descricao = 'RF3-INTRUSO'`))[0].n, 0, 'nenhum lançamento foi gravado');

  // editar um lançamento PRÓPRIO apontando para dados de B também é recusado
  const meu = (await q(`SELECT id FROM lancamentos WHERE usuario_id = $1 AND descricao = 'RF3-controle-ok'`, [A.id]))[0];
  if (meu) {
    const r = await chamar('PUT', `/api/lancamentos/${meu.id}`, { token: A.token, corpo: CORPOS.lancamentos({ categoriaId: B.dados.fks.categoriaId, fonteDestinoId: A.dados.fks.fonteDestinoId }, { descricao: 'RF3-INTRUSO' }) });
    if (!ausente(r)) {
      assert.ok(r.status === 404 || r.status === 400, `editar com categoria de B deveria ser recusado, deu ${r.status}`);
      assert.equal((await q(`SELECT COUNT(*)::int AS n FROM lancamentos WHERE descricao = 'RF3-INTRUSO'`))[0].n, 0);
    }
  }
});

test('o dono vem SEMPRE do token: "usuarioId" no corpo da requisição é ignorado', async (t) => {
  if (semAmbiente(t)) return;
  const tentativas = [
    ['/api/categorias', { ...CORPOS.categorias(), nome: 'RF3-contrabando-cat', usuarioId: B.id, usuario_id: B.id }, 'categorias', 'nome'],
    ['/api/fontes-destinos', { ...CORPOS['fontes-destinos'](), nome: 'RF3-contrabando-fonte', usuarioId: B.id, usuario_id: B.id }, 'fontes_destinos', 'nome'],
    ['/api/lancamentos', { ...CORPOS.lancamentos(A.dados.fks, { descricao: 'RF3-contrabando-lanc' }), usuarioId: B.id, usuario_id: B.id }, 'lancamentos', 'descricao'],
  ];
  let verificadas = 0;
  for (const [caminho, corpo, tabela, coluna] of tentativas) {
    const r = await chamar('POST', caminho, { token: A.token, corpo });
    if (ausente(r)) continue;
    verificadas++;
    const comoB = (await q(`SELECT COUNT(*)::int AS n FROM ${tabela} WHERE ${coluna} LIKE 'RF3-contrabando%' AND usuario_id = $1`, [B.id]))[0].n;
    assert.equal(comoB, 0, `POST ${caminho}: um registro foi criado em nome de B usando o usuarioId do corpo`);
  }
  if (!verificadas) t.diagnostic('IGNORADO: nenhuma rota POST implementada ainda');
});

// ---------------------------------------------------------------------------
// 5) Entradas maliciosas (ids malformados e injeção de SQL)

test('ids malformados e injeção de SQL no caminho: 400 ou 404, nunca 500 nem dado de outro usuário', async (t) => {
  if (semAmbiente(t)) return;
  const ids = ['abc', '0', '-1', '99999999999999999999', '1%20OR%201=1', "1'%20OR%20'1'='1", '1;DROP%20TABLE%20usuarios', '%00', '1.5'];
  let verificadas = 0;
  for (const rec of RECURSOS) {
    for (const id of ids) {
      for (const metodo of ['GET', 'PUT', 'DELETE']) {
        const corpo = metodo === 'PUT'
          ? (rec.nome === 'lancamentos' ? CORPOS.lancamentos(A.dados.fks) : CORPOS[rec.nome]())
          : undefined;
        const r = await chamar(metodo, `${rec.base}/${id}`, { token: A.token, corpo });
        if (ausente(r)) continue;
        verificadas++;
        assert.ok(r.status === 400 || r.status === 404, `${metodo} ${rec.base}/${id}: esperado 400 ou 404, deu ${r.status}`);
        assert.equal(r.texto.includes('RF3-SEGREDO-B'), false);
      }
    }
  }
  assert.equal((await q(`SELECT COUNT(*)::int AS n FROM usuarios`))[0].n >= 2, true, 'a tabela de usuários continua intacta');
  if (!verificadas) t.diagnostic('IGNORADO: nenhuma rota por id implementada ainda');
});

test('filtros com injeção de SQL nas listagens e relatórios: sem erro 500 e sem dados de B', async (t) => {
  if (semAmbiente(t)) return;
  const sujo = [
    "tipo=' OR '1'='1", "tipo=saida' OR '1'='1' --", 'categoriaId=1 OR 1=1', 'categoriaId=abc',
    "inicio=2020-01-01' OR '1'='1", 'inicio=2026-13-45&fim=nao-e-data', 'pagina=1;DROP TABLE lancamentos',
    'pagina=-5', 'pagina=99999999999999999999', 'fonteDestinoId=-1 UNION SELECT * FROM usuarios', 'meses=abc', 'meses=-3',
  ];
  const bases = ['/api/lancamentos', '/api/categorias', '/api/fontes-destinos',
    '/api/relatorios/categorias', '/api/relatorios/fontes-destinos', '/api/relatorios/faturas'];
  let verificadas = 0;
  for (const caminho of bases) {
    for (const filtro of sujo) {
      const sep = caminho.includes('relatorios/categorias') || caminho.includes('relatorios/fontes') ? '?inicio=2026-01-01&fim=2026-12-31&' : '?';
      const r = await chamar('GET', `${caminho}${sep}${filtro.replace(/ /g, '%20').replace(/'/g, '%27')}`, { token: A.token });
      if (ausente(r)) continue;
      verificadas++;
      assert.ok(r.status !== 500, `GET ${caminho}?${filtro}: erro 500 (consulta provavelmente concatena texto do usuário)`);
      assert.equal(r.texto.includes('RF3-SEGREDO-B'), false, `GET ${caminho}?${filtro}: vazou dados de B`);
      assert.equal(r.texto.includes('senha_hash'), false);
    }
  }
  const tabelas = (await q(`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_name IN ('usuarios','lancamentos','categorias','fontes_destinos')`))[0].n;
  assert.equal(tabelas, 4, 'as tabelas continuam existindo');
  if (!verificadas) t.diagnostic('IGNORADO: nenhuma listagem implementada ainda');
});

// ---------------------------------------------------------------------------
// 6) Conferências finais, sobre TODAS as respostas recebidas durante o teste

test('nenhuma resposta da API contém senha_hash nem hash bcrypt', async (t) => {
  if (semAmbiente(t)) return;
  // chamadas explícitas das rotas de usuário, além de todo o histórico
  await chamar('GET', '/api/auth/me', { token: A.token });
  await chamar('POST', '/api/auth/login', { corpo: { email: A.email, senha: 'Senha123' } });
  await chamar('POST', '/api/auth/login', { corpo: { email: A.email, senha: 'errada123' } });
  await chamar('POST', '/api/auth/cadastro', { corpo: { nome: 'Repetido', email: A.email, cpf: gerarCpf(), senha: 'Senha123' } });
  assert.ok(registro.length > 50, `varreu ${registro.length} respostas`);
  const vazadas = registro.filter((r) => /senha_hash|senhaHash|"senha"\s*:|\$2[aby]\$\d{2}\$/.test(r.texto));
  assert.deepEqual(vazadas.map((r) => `${r.metodo} ${r.caminho} -> ${r.status}`), [], 'respostas que expõem senha/hash');
});

test('nenhuma requisição feita durante o teste causou erro 500', async (t) => {
  if (semAmbiente(t)) return;
  const erros = registro.filter((r) => r.status >= 500);
  assert.deepEqual(erros.map((r) => `${r.metodo} ${r.caminho} -> ${r.status} ${r.texto.slice(0, 100)}`), []);
});

test('ao final, os dados de A e de B continuam exatamente como estavam', async (t) => {
  if (semAmbiente(t)) return;
  assert.equal(await fotografia(B.dados), fotoInicialB, 'dados de B foram alterados');
  assert.equal(await fotografia(A.dados), fotoInicialA, 'dados de A foram alterados');
});
