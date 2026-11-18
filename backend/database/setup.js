// Cria o banco (se não existir) e aplica o schema.sql.
// Uso: npm run db:create
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida. Copie .env.example para .env e preencha.');
  process.exit(1);
}

const url = new URL(DATABASE_URL);
const nomeBanco = decodeURIComponent(url.pathname.slice(1));

// 1) Conecta no banco administrativo "postgres" para poder criar o banco do projeto.
const adminUrl = new URL(DATABASE_URL);
adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.toString() });

try {
  await admin.connect();
  const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nomeBanco]);
  if (existe.rowCount === 0) {
    // Nome de banco não pode ser parâmetro ($1); por isso escapamos como identificador.
    await admin.query(`CREATE DATABASE ${pg.escapeIdentifier(nomeBanco)}`);
    console.log(`Banco "${nomeBanco}" criado.`);
  } else {
    console.log(`Banco "${nomeBanco}" já existe.`);
  }
} catch (erro) {
  console.error('Não foi possível conectar/criar o banco:', erro.message);
  console.error('Confira usuário, senha e porta em DATABASE_URL e se o PostgreSQL está rodando.');
  process.exit(1);
} finally {
  await admin.end();
}

// 2) Aplica o schema no banco do projeto.
const aqui = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.join(aqui, 'schema.sql'), 'utf8');
const client = new pg.Client({ connectionString: DATABASE_URL });

try {
  await client.connect();
  await client.query(sql);
  console.log('Schema aplicado com sucesso.');
} catch (erro) {
  console.error('Erro ao aplicar o schema:', erro.message);
  process.exit(1);
} finally {
  await client.end();
}
