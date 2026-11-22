import { query } from '../config/db.js';

export async function consultarRelatorioCategoria(usuarioId, inicio, fim) {
  const { rows } = await query(`
    WITH periodo AS (
      SELECT $2::date AS inicio, $3::date AS fim
    ),
    limites AS (
      SELECT inicio, fim,
        inicio - (fim - inicio + 1) AS inicio_anterior,
        inicio - 1 AS fim_anterior
      FROM periodo
    ),
    totais AS (
      SELECT c.id, c.nome, l.tipo,
        COALESCE(SUM(l.valor) FILTER (WHERE l.data >= p.inicio), 0) AS total,
        COALESCE(SUM(l.valor) FILTER (WHERE l.data < p.inicio), 0) AS total_anterior
      FROM lancamentos l
      JOIN categorias c ON c.id = l.categoria_id AND c.usuario_id = l.usuario_id
      CROSS JOIN limites p
      WHERE l.usuario_id = $1
        AND l.data BETWEEN p.inicio_anterior AND p.fim
      GROUP BY c.id, c.nome, l.tipo
    )
    SELECT t.*, p.inicio_anterior::text, p.fim_anterior::text,
      COALESCE(
        ROUND(100 * t.total / NULLIF(SUM(t.total) OVER (PARTITION BY t.tipo), 0), 2),
        0
      ) AS percentual,
      t.total - t.total_anterior AS variacao,
      ROUND(100 * (t.total - t.total_anterior) / NULLIF(t.total_anterior, 0), 2)
        AS variacao_percentual
    FROM limites p
    LEFT JOIN totais t ON TRUE
    ORDER BY t.tipo, t.total DESC, t.nome, t.id
  `, [usuarioId, inicio, fim]);

  const entradas = [];
  const saidas = [];

  for (const linha of rows) {
    if (linha.id === null) continue;

    const categoria = {
      categoriaId: linha.id,
      nome: linha.nome,
      total: Number(linha.total),
      percentual: Number(linha.percentual),
      totalAnterior: Number(linha.total_anterior),
      variacao: Number(linha.variacao),
      variacaoPercentual: linha.variacao_percentual === null
        ? null
        : Number(linha.variacao_percentual),
    };

    (linha.tipo === 'entrada' ? entradas : saidas).push(categoria);
  }

  return {
    periodo: { inicio, fim },
    periodoAnterior: {
      inicio: rows[0].inicio_anterior,
      fim: rows[0].fim_anterior,
    },
    entradas,
    saidas,
  };
}
