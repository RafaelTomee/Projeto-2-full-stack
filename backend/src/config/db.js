import 'dotenv/config';
import pg from 'pg';

// Pool de conexões: as conexões são reaproveitadas entre as requisições.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                       // máximo de conexões simultâneas
  idleTimeoutMillis: 30_000,     // fecha conexões ociosas após 30s
  connectionTimeoutMillis: 5_000,
});

// Evita derrubar o servidor se uma conexão ociosa for perdida.
pool.on('error', (erro) => {
  console.error('Erro inesperado no pool do banco:', erro.message);
});

// Consulta simples. Sempre use parâmetros ($1, $2...) e nunca concatene
// texto do usuário no SQL.
//   const { rows } = await query('SELECT * FROM usuarios WHERE id = $1', [id]);
export function query(texto, parametros) {
  return pool.query(texto, parametros);
}

// Para transações (ex.: parcelamento, cadastro com dados padrão):
//   await comTransacao(async (client) => {
//     await client.query('INSERT ...', [...]);
//     await client.query('INSERT ...', [...]);
//   });
// Se a função lançar erro, faz ROLLBACK; caso contrário, COMMIT.
export async function comTransacao(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await callback(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

export async function testarConexao() {
  const { rows } = await pool.query('SELECT NOW() AS agora');
  return rows[0].agora;
}
