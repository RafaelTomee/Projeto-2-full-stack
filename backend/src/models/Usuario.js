import { query } from '../config/db.js';

// Todas as funções aceitam um "executor" opcional (o client de uma transação).
// Sem ele, usam o pool normal.
const exec = (client) => client ?? { query };

export const Usuario = {
  // Os dados já devem vir normalizados (e-mail em minúsculas, CPF só dígitos).
  // A unicidade de e-mail e CPF é garantida pelo banco (UNIQUE): se houver
  // duplicidade, esta função lança o erro do PostgreSQL (code 23505).
  // Nunca devolve senha_hash.
  async criar({ nome, email, cpf, senhaHash }, client) {
    const { rows } = await exec(client).query(
      `INSERT INTO usuarios (nome, email, cpf, senha_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, email, criado_em`,
      [nome, email, cpf, senhaHash],
    );
    return rows[0];
  },

  // Devolve também o senha_hash, pois o login precisa dele para comparar.
  // Uso interno: nunca envie este objeto inteiro na resposta da API.
  async buscarPorEmail(email, client) {
    const { rows } = await exec(client).query(
      'SELECT id, nome, email, cpf, senha_hash FROM usuarios WHERE email = $1',
      [email],
    );
    return rows[0] ?? null;
  },
};
