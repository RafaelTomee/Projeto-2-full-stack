import { query } from '../config/db.js';

const exec = (client) => client ?? { query };

const PADRAO = [
  { nome: 'Salário', tipo: 'entrada' },
  { nome: 'Outros', tipo: 'entrada' },
  { nome: 'Alimentação', tipo: 'saida' },
  { nome: 'Moradia', tipo: 'saida' },
  { nome: 'Saúde', tipo: 'saida' },
  { nome: 'Mobilidade', tipo: 'saida' },
  { nome: 'Lazer', tipo: 'saida' },
  { nome: 'Educação', tipo: 'saida' },
  { nome: 'Outros', tipo: 'saida' },
];

export const Categoria = {
  // Cria as categorias iniciais do usuário. Recebe o client da transação do
  // cadastro, para que usuário e padrões sejam gravados juntos (ou nenhum).
  async criarPadrao(usuarioId, client) {
    await exec(client).query(
      `INSERT INTO categorias (usuario_id, nome, tipo)
       SELECT $1, t.nome, t.tipo
         FROM unnest($2::text[], $3::text[]) AS t(nome, tipo)`,
      [usuarioId, PADRAO.map((c) => c.nome), PADRAO.map((c) => c.tipo)],
    );
  },

  async listar(usuarioId) {
    const { rows } = await query(
      'SELECT id, nome, tipo FROM categorias WHERE usuario_id = $1 ORDER BY id',
      [usuarioId],
    );
    return rows;
  },

  async buscarPorId(id, usuarioId) {
    const { rows } = await query(
      'SELECT id, nome, tipo FROM categorias WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId],
    );
    return rows[0] ?? null;
  },

  async existeComNome(usuarioId, nome, tipo, ignorarId = null) {
    const condicao = ignorarId ? ' AND id <> $4' : '';
    const params = [usuarioId, nome, tipo];
    if (ignorarId) params.push(ignorarId);
    const { rowCount } = await query(
      `SELECT 1 FROM categorias
        WHERE usuario_id = $1 AND LOWER(nome) = LOWER($2) AND tipo = $3${condicao}`,
      params,
    );
    return rowCount > 0;
  },

  async criar(usuarioId, { nome, tipo }) {
    const { rows } = await query(
      `INSERT INTO categorias (usuario_id, nome, tipo)
       VALUES ($1, $2, $3)
       RETURNING id, nome, tipo`,
      [usuarioId, nome, tipo],
    );
    return rows[0];
  },

  async atualizar(id, usuarioId, { nome, tipo }) {
    const { rows } = await query(
      `UPDATE categorias SET nome = $3, tipo = $4
        WHERE id = $1 AND usuario_id = $2
        RETURNING id, nome, tipo`,
      [id, usuarioId, nome, tipo],
    );
    return rows[0] ?? null;
  },

  async excluir(id, usuarioId) {
    const { rowCount } = await query(
      'DELETE FROM categorias WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId],
    );
    return rowCount > 0;
  },

  async temLancamentos(id, usuarioId) {
    const { rowCount } = await query(
      'SELECT 1 FROM lancamentos WHERE categoria_id = $1 AND usuario_id = $2 LIMIT 1',
      [id, usuarioId],
    );
    return rowCount > 0;
  },
};
