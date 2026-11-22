import { query } from '../config/db.js';

export async function consultarRelatorioFonteDestino(usuarioId, inicio, fim) {
  const { rows } = await query(`
    WITH totais_por_fonte AS (
      SELECT
        f.id,
        f.nome,
        f.tipo,
        COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0) AS entradas,
        COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0) AS saidas,
        CASE WHEN f.tipo = 'conta' THEN
          COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0)
          - COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0)
        END AS saldo
      FROM fontes_destinos f
      LEFT JOIN lancamentos l
        ON l.fonte_destino_id = f.id
        AND l.usuario_id = f.usuario_id
        AND l.data BETWEEN $2::date AND $3::date
      WHERE f.usuario_id = $1
      GROUP BY f.id, f.nome, f.tipo
    )
    SELECT *, SUM(entradas) OVER () AS total_entradas,
      SUM(saidas) OVER () AS total_saidas,
      SUM(entradas - saidas) OVER () AS total_saldo
    FROM totais_por_fonte
    ORDER BY nome, id
  `, [usuarioId, inicio, fim]);

  const primeira = rows[0];
  return {
    fontesDestinos: rows.map(({ id, nome, tipo, entradas, saidas, saldo }) => ({
      id,
      nome,
      tipo,
      entradas: Number(entradas),
      saidas: Number(saidas),
      saldo: saldo === null ? null : Number(saldo),
    })),
    totais: {
      entradas: Number(primeira?.total_entradas ?? 0),
      saidas: Number(primeira?.total_saidas ?? 0),
      saldo: Number(primeira?.total_saldo ?? 0),
    },
  };
}
