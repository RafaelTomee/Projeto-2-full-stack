import { query } from '../config/db.js';

export async function consultarRelatorioFonteDestino(usuarioId, inicio, fim) {
  const { rows } = await query(`
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
    ORDER BY f.nome, f.id
  `, [usuarioId, inicio, fim]);

  return rows.map(({ entradas, saidas, saldo, ...fonteDestino }) => ({
    ...fonteDestino,
    entradas: Number(entradas),
    saidas: Number(saidas),
    saldo: saldo === null ? null : Number(saldo),
  }));
}
