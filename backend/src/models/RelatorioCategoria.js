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
    categorias_agrupadas AS (
      SELECT c.id, c.nome, l.tipo,
        COALESCE(SUM(l.valor) FILTER (WHERE l.data >= p.inicio), 0) AS total,
        COALESCE(SUM(l.valor) FILTER (WHERE l.data < p.inicio), 0) AS anterior
      FROM lancamentos l
      JOIN categorias c ON c.id = l.categoria_id AND c.usuario_id = l.usuario_id
      CROSS JOIN limites p
      WHERE l.usuario_id = $1
        AND l.data BETWEEN p.inicio_anterior AND p.fim
      GROUP BY c.id, c.nome, l.tipo
    ),
    totais AS (
      SELECT c.*, SUM(c.total) OVER (PARTITION BY c.tipo) AS total_tipo
      FROM categorias_agrupadas c
    )
    SELECT t.*, p.inicio_anterior::text, p.fim_anterior::text,
      COALESCE(ROUND(100 * t.total / NULLIF(t.total_tipo, 0), 2), 0) AS percentual,
      ROUND(100 * (t.total - t.anterior) / NULLIF(t.anterior, 0), 2) AS variacao
    FROM limites p
    LEFT JOIN totais t ON TRUE
    ORDER BY t.tipo, t.total DESC, t.nome, t.id
  `, [usuarioId, inicio, fim]);

  const entradas = { total: 0, categorias: [] };
  const saidas = { total: 0, categorias: [] };

  for (const linha of rows) {
    if (linha.id === null) continue;

    const categoria = {
      id: linha.id,
      nome: linha.nome,
      total: Number(linha.total),
      percentual: Number(linha.percentual),
    };

    if (linha.tipo === 'entrada') {
      entradas.total = Number(linha.total_tipo);
      if (categoria.total > 0) entradas.categorias.push(categoria);
    } else {
      saidas.total = Number(linha.total_tipo);
      saidas.categorias.push({
        ...categoria,
        anterior: Number(linha.anterior),
        variacao: linha.variacao === null ? null : Number(linha.variacao),
      });
    }
  }

  return {
    periodo: { inicio, fim },
    periodoAnterior: {
      inicio: rows[0].inicio_anterior,
      fim: rows[0].fim_anterior,
    },
    saidas,
    entradas,
  };
}
