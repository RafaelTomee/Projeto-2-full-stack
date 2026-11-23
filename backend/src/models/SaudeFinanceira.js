import { query } from '../config/db.js';
import { calcularSaudeFinanceira } from '../config/saudeFinanceira.js';

export async function consultarSaudeFinanceira(usuarioId, mesReferencia) {
  const { rows } = await query(`
    SELECT l.tipo, l.valor, l.data::text, l.parcela_atual, l.total_parcelas,
      f.tipo AS tipo_fonte, f.dia_fechamento, f.dia_vencimento
    FROM lancamentos l
    JOIN fontes_destinos f ON f.id = l.fonte_destino_id AND f.usuario_id = l.usuario_id
    WHERE l.usuario_id = $1
      AND l.data < $2::date + interval '4 months'
      AND (
        l.data >= $2::date
        OR (l.tipo = 'saida' AND f.tipo = 'cartao_credito'
          AND l.data >= $2::date - interval '49 months')
      )
  `, [usuarioId, mesReferencia + '-01']);
  return calcularSaudeFinanceira(rows, mesReferencia);
}
