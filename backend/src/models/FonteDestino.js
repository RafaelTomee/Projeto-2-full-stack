import { query } from '../config/db.js';

const exec = (client) => client ?? { query };

const PADRAO = [
  { nome: 'Conta corrente', tipo: 'conta' },
  { nome: 'Dinheiro', tipo: 'conta' },
  { nome: 'Salário', tipo: 'renda' },
];

const CAMPOS = `id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva`;

function publico(registro) {
  if (!registro) return null;
  return {
    ...registro,
    limite: registro.limite === null ? null : Number(registro.limite),
  };
}

export const FonteDestino = {
  // Cria as fontes/destinos iniciais do usuário (usa o client da transação).
  async criarPadrao(usuarioId, client) {
    await exec(client).query(
      `INSERT INTO fontes_destinos (usuario_id, nome, tipo)
       SELECT $1, t.nome, t.tipo
         FROM unnest($2::text[], $3::text[]) AS t(nome, tipo)`,
      [usuarioId, PADRAO.map((f) => f.nome), PADRAO.map((f) => f.tipo)],
    );
  },

  async listar(usuarioId) {
    const { rows } = await query(
      `SELECT ${CAMPOS} FROM fontes_destinos WHERE usuario_id = $1 ORDER BY id`,
      [usuarioId],
    );
    return rows.map(publico);
  },

  async buscarPorId(id, usuarioId) {
    const { rows } = await query(
      `SELECT ${CAMPOS} FROM fontes_destinos WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId],
    );
    return publico(rows[0]);
  },

  async existeComNome(usuarioId, nome, ignorarId = null) {
    const condicao = ignorarId ? ' AND id <> $3' : '';
    const params = [usuarioId, nome];
    if (ignorarId) params.push(ignorarId);
    const { rowCount } = await query(
      `SELECT 1 FROM fontes_destinos
        WHERE usuario_id = $1 AND LOWER(nome) = LOWER($2)${condicao}`,
      params,
    );
    return rowCount > 0;
  },

  async criar(usuarioId, { nome, tipo, diaFechamento, diaVencimento, limite }) {
    const { rows } = await query(
      `INSERT INTO fontes_destinos
         (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${CAMPOS}`,
      [usuarioId, nome, tipo, diaFechamento, diaVencimento, limite],
    );
    return publico(rows[0]);
  },

  async atualizar(id, usuarioId, { nome, tipo, diaFechamento, diaVencimento, limite }) {
    const { rows } = await query(
      `UPDATE fontes_destinos
          SET nome = $3, tipo = $4, dia_fechamento = $5, dia_vencimento = $6, limite = $7
        WHERE id = $1 AND usuario_id = $2
        RETURNING ${CAMPOS}`,
      [id, usuarioId, nome, tipo, diaFechamento, diaVencimento, limite],
    );
    return publico(rows[0]);
  },

  async excluir(id, usuarioId) {
    const { rowCount } = await query(
      'DELETE FROM fontes_destinos WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId],
    );
    return rowCount > 0;
  },

  async temLancamentos(id, usuarioId) {
    const { rowCount } = await query(
      'SELECT 1 FROM lancamentos WHERE fonte_destino_id = $1 AND usuario_id = $2 LIMIT 1',
      [id, usuarioId],
    );
    return rowCount > 0;
  },
};
