// Teste de integração do cadastro. Precisa do banco configurado (.env + npm run db:create).
// Sem banco, os testes são ignorados. Os usuários criados aqui são apagados no final.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { pool, query, comTransacao, testarConexao } from '../src/config/db.js';
import authRoutes from '../src/routes/auth.routes.js';
import { Usuario } from '../src/models/Usuario.js';
import { Categoria } from '../src/models/Categoria.js';

const PREFIXO = 'teste-cadastro-';

let temBanco = true;
try {
  await testarConexao();
} catch {
  temBanco = false;
}
const opcoes = { skip: temBanco ? false : 'banco não configurado (.env / npm run db:create)' };

// Gera um CPF válido aleatório (9 dígitos + 2 verificadores).
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

const formatar = (c) => `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
let contador = 0;
const novoEmail = () => `${PREFIXO}${Date.now()}-${contador++}@teste.com`;
const dados = (extra = {}) => ({
  nome: 'Teste Cadastro',
  email: novoEmail(),
  cpf: gerarCpf(),
  senha: 'Senha123',
  ...extra,
});

let servidor;
let base;

async function cadastrar(corpo) {
  const r = await fetch(`${base}/api/auth/cadastro`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return { status: r.status, corpo: await r.json() };
}

before(async () => {
  if (!temBanco) return;
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use((erro, req, res, next) => res.status(500).json({ erro: erro.message })); // só para o teste
  await new Promise((ok) => {
    servidor = app.listen(0, ok);
  });
  base = `http://localhost:${servidor.address().port}`;
});

after(async () => {
  if (temBanco) {
    // ON DELETE CASCADE apaga também categorias e fontes/destinos desses usuários.
    await query('DELETE FROM usuarios WHERE email LIKE $1', [`${PREFIXO}%`]);
    await new Promise((ok) => servidor.close(ok));
  }
  await pool.end();
});

test('cadastro válido: 201, sem senha_hash e com senha guardada como hash', opcoes, async () => {
  const d = dados();
  const r = await cadastrar(d);
  assert.equal(r.status, 201);
  assert.deepEqual(Object.keys(r.corpo).sort(), ['email', 'id', 'nome']);
  assert.equal(JSON.stringify(r.corpo).includes('senha'), false);

  const { rows } = await query('SELECT senha_hash, cpf FROM usuarios WHERE id = $1', [r.corpo.id]);
  assert.match(rows[0].senha_hash, /^\$2[aby]\$/); // formato do bcrypt
  assert.notEqual(rows[0].senha_hash, d.senha);
  assert.equal(rows[0].cpf, d.cpf); // CPF gravado só com dígitos
});

test('cadastro cria categorias e fontes/destinos padrão', opcoes, async () => {
  const r = await cadastrar(dados());
  const cat = await query('SELECT nome, tipo FROM categorias WHERE usuario_id = $1', [r.corpo.id]);
  const fon = await query('SELECT nome, tipo FROM fontes_destinos WHERE usuario_id = $1', [r.corpo.id]);
  const nomes = cat.rows.map((c) => `${c.nome}/${c.tipo}`);
  assert.ok(nomes.includes('Salário/entrada'));
  assert.ok(nomes.includes('Alimentação/saida'));
  assert.ok(nomes.includes('Outros/saida'));
  assert.equal(cat.rowCount, 9);
  assert.ok(fon.rows.some((f) => f.nome === 'Conta corrente'));
});

test('e-mail repetido com maiúsculas diferentes é rejeitado (409 no campo email)', opcoes, async () => {
  const d = dados();
  assert.equal((await cadastrar(d)).status, 201);
  const r = await cadastrar({ ...dados(), email: `  ${d.email.toUpperCase()} ` });
  assert.equal(r.status, 409);
  assert.deepEqual(Object.keys(r.corpo.campos), ['email']);
});

test('CPF repetido, com e sem pontuação, é rejeitado (409 no campo cpf)', opcoes, async () => {
  const d = dados();
  assert.equal((await cadastrar({ ...d, cpf: formatar(d.cpf) })).status, 201); // com pontuação
  const r = await cadastrar({ ...dados(), cpf: d.cpf }); // sem pontuação
  assert.equal(r.status, 409);
  assert.deepEqual(Object.keys(r.corpo.campos), ['cpf']);
});

test('requisições simultâneas com o mesmo e-mail: só uma é gravada (UNIQUE no banco)', opcoes, async () => {
  const email = novoEmail();
  const resultados = await Promise.all(
    Array.from({ length: 5 }, () => cadastrar({ ...dados(), email })),
  );
  const status = resultados.map((r) => r.status).sort();
  assert.deepEqual(status, [201, 409, 409, 409, 409]);
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM usuarios WHERE email = $1', [email]);
  assert.equal(rows[0].n, 1);
});

test('dados inválidos: 400 e nada é gravado', opcoes, async () => {
  const email = novoEmail();
  const r = await cadastrar({ ...dados(), email, cpf: '111.111.111-11' });
  assert.equal(r.status, 400);
  const { rows } = await query('SELECT 1 FROM usuarios WHERE email = $1', [email]);
  assert.equal(rows.length, 0);
});

test('transação: se criar os padrões falhar, o usuário também não é gravado', opcoes, async () => {
  const email = novoEmail();
  await assert.rejects(
    comTransacao(async (client) => {
      const u = await Usuario.criar(
        { nome: 'X', email, cpf: gerarCpf(), senhaHash: 'hash' },
        client,
      );
      await Categoria.criarPadrao(u.id, client);
      throw new Error('falha simulada depois de criar o usuário');
    }),
    /falha simulada/,
  );
  const { rows } = await query('SELECT 1 FROM usuarios WHERE email = $1', [email]);
  assert.equal(rows.length, 0);
});
