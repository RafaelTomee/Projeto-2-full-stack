import { query } from '../config/db.js';

const LIMITE_POUPANCA = 10;
const LIMITE_CARTAO = 30;

export async function consultarSaudeFinanceira(usuarioId) {
  const { rows } = await query(`
    WITH referencia AS (
      SELECT date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date AS mes
    ),
    movimentos AS (
      SELECT
        l.tipo,
        l.valor,
        l.total_parcelas,
        f.tipo = 'cartao_credito' AS cartao,
        CASE
          WHEN l.tipo = 'saida' AND f.tipo = 'cartao_credito' THEN
            date_trunc('month', l.data::timestamp) + make_interval(months =>
              l.parcela_atual - 1
              + CASE WHEN extract(day FROM l.data) > f.dia_fechamento THEN 1 ELSE 0 END
              + CASE WHEN f.dia_vencimento <= f.dia_fechamento THEN 1 ELSE 0 END
            )
          ELSE date_trunc('month', l.data::timestamp)
        END AS mes
      FROM lancamentos l
      JOIN fontes_destinos f ON f.id = l.fonte_destino_id
        AND f.usuario_id = l.usuario_id
      CROSS JOIN referencia r
      WHERE l.usuario_id = $1
        AND l.data < r.mes + interval '4 months'
    )
    SELECT
      to_char(periodo.mes, 'YYYY-MM') AS mes,
      COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'entrada'), 0) AS receitas,
      COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'saida'), 0) AS despesas,
      COALESCE(SUM(m.valor) FILTER (
        WHERE m.tipo = 'saida' AND m.cartao
      ), 0) AS cartao,
      COALESCE(SUM(m.valor) FILTER (
        WHERE m.tipo = 'saida' AND m.cartao AND m.total_parcelas > 1
      ), 0) AS parcelas
    FROM referencia r
    CROSS JOIN LATERAL generate_series(
      r.mes::timestamp, r.mes + interval '3 months', interval '1 month'
    ) AS periodo(mes)
    LEFT JOIN movimentos m ON m.mes = periodo.mes
    GROUP BY periodo.mes
    ORDER BY periodo.mes
  `, [usuarioId]);

  function centavos(valor) {
    return Math.round(Number(valor) * 100);
  }

  const [atual, ...futuros] = rows;
  const receitas = centavos(atual.receitas);
  const despesas = centavos(atual.despesas);
  const cartao = centavos(atual.cartao);
  let saldo = receitas - despesas;

  const taxaPoupanca = receitas ? Math.round(saldo * 10000 / receitas) / 100 : null;
  const comprometimentoCartoes = receitas ? Math.round(cartao * 10000 / receitas) / 100 : null;
  const parcelasFuturas = futuros.reduce((total, mes) => total + centavos(mes.parcelas), 0) / 100;

  const projecao = futuros.map((mes) => {
    saldo += centavos(mes.receitas) - centavos(mes.despesas);
    return { mes: mes.mes, saldo: saldo / 100 };
  });

  const dicas = [];

  if (!receitas) {
    dicas.push('Registre suas entradas para acompanhar os indicadores percentuais.');
  }

  if (taxaPoupanca !== null && taxaPoupanca < LIMITE_POUPANCA) {
    dicas.push('Revise as despesas do mês para identificar oportunidades de economia.');
  }

  if (comprometimentoCartoes !== null && comprometimentoCartoes > LIMITE_CARTAO) {
    dicas.push('Confira quanto dos seus ganhos está comprometido com compras no cartão.');
  }

  const temSaldoNegativo = projecao.some((mes) => mes.saldo < 0);

  if (temSaldoNegativo) {
    dicas.push('Confira as entradas e contas dos meses com saldo projetado negativo.');
  }

  return {
    indicadores: { taxaPoupanca, comprometimentoCartoes, parcelasFuturas },
    projecao,
    temSaldoNegativo,
    dicas,
  };
}
