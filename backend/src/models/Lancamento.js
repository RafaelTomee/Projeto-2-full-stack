import { randomUUID } from 'node:crypto';
import { comTransacao, query } from '../config/db.js';
import { dividirEmCentavos } from '../utils/parcelas.js';

const CAMPOS = `
  id, tipo, descricao, valor, data::text AS data, categoria_id, fonte_destino_id,
  parcela_atual, total_parcelas, grupo_parcelamento, criado_em
`;

function publico(registro) {
  if (!registro) return null;
  return {
    id: registro.id,
    tipo: registro.tipo,
    descricao: registro.descricao,
    valor: Number(registro.valor),
    data: registro.data,
    categoriaId: registro.categoria_id,
    fonteDestinoId: registro.fonte_destino_id,
    parcelaAtual: registro.parcela_atual,
    totalParcelas: registro.total_parcelas,
    grupoParcelamento: registro.grupo_parcelamento,
    criadoEm: registro.criado_em?.toISOString?.() ?? registro.criado_em,
  };
}

export const Lancamento = {
  async categoriaDoUsuario(id, usuarioId) {
    const { rows } = await query(
      'SELECT id, tipo FROM categorias WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId],
    );
    return rows[0] ?? null;
  },

  async fonteDoUsuario(id, usuarioId) {
    const { rows } = await query(
      'SELECT id, tipo FROM fontes_destinos WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId],
    );
    return rows[0] ?? null;
  },

  async criar(
    usuarioId,
    {
      tipo,
      descricao,
      valor,
      data,
      categoriaId,
      fonteDestinoId,
      parcelaAtual = 1,
      totalParcelas = 1,
      grupoParcelamento = null,
    },
    executar = query,
  ) {
    const { rows } = await executar(
      `INSERT INTO lancamentos
         (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id,
          parcela_atual, total_parcelas, grupo_parcelamento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${CAMPOS}`,
      [
        usuarioId,
        tipo,
        descricao,
        valor,
        data,
        categoriaId,
        fonteDestinoId,
        parcelaAtual,
        totalParcelas,
        grupoParcelamento,
      ],
    );
    return publico(rows[0]);
  },

  async criarParcelados(usuarioId, dados) {
    const grupo = randomUUID();
    const centavos = dividirEmCentavos(dados.valor, dados.totalParcelas);

    return comTransacao(async (client) => {
      const executar = (sql, parametros) => client.query(sql, parametros);
      const parcelas = [];
      for (const [indice, valorCentavos] of centavos.entries()) {
        parcelas.push(
          await this.criar(
            usuarioId,
            {
              ...dados,
              valor: valorCentavos / 100,
              parcelaAtual: indice + 1,
              totalParcelas: dados.totalParcelas,
              grupoParcelamento: grupo,
            },
            executar,
          ),
        );
      }
      return parcelas;
    });
  },

  async buscarPorId(id, usuarioId) {
    const { rows } = await query(
      `SELECT ${CAMPOS} FROM lancamentos WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId],
    );
    return publico(rows[0]);
  },

  async atualizar(id, usuarioId, { tipo, descricao, valor, data, categoriaId, fonteDestinoId }) {
    const { rows } = await query(
      `UPDATE lancamentos
          SET tipo = $3, descricao = $4, valor = $5, data = $6,
              categoria_id = $7, fonte_destino_id = $8
        WHERE id = $1 AND usuario_id = $2
        RETURNING ${CAMPOS}`,
      [id, usuarioId, tipo, descricao, valor, data, categoriaId, fonteDestinoId],
    );
    return publico(rows[0]);
  },

  async atualizarGrupo(grupoId, usuarioId, { descricao, categoriaId }) {
    const { rows } = await query(
      `UPDATE lancamentos
          SET descricao = $3, categoria_id = $4
        WHERE usuario_id = $1 AND grupo_parcelamento = $2
        RETURNING ${CAMPOS}`,
      [usuarioId, grupoId, descricao, categoriaId],
    );
    return rows.map(publico);
  },

  async excluir(id, usuarioId) {
    const { rowCount } = await query(
      'DELETE FROM lancamentos WHERE id = $1 AND usuario_id = $2',
      [id, usuarioId],
    );
    return rowCount > 0;
  },

  async excluirGrupo(grupoParcelamento, usuarioId) {
    const { rowCount } = await query(
      'DELETE FROM lancamentos WHERE grupo_parcelamento = $1 AND usuario_id = $2',
      [grupoParcelamento, usuarioId],
    );
    return rowCount > 0;
  },
};
