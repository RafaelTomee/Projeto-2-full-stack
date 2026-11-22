import { calcularFatura } from '../config/faturas.js';
import { query } from '../config/db.js';

function diaNoMes(ano, mes, dia) {
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(dia, ultimoDia)));
}

function iso(data) {
  return data.toISOString().slice(0, 10);
}

function hojeNoBrasil() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function montarCartao(cartao, lancamentos, meses, hoje) {
  const [ano, mes] = hoje.split('-').map(Number);
  const fechamento = cartao.dia_fechamento;
  const vencimento = cartao.dia_vencimento;
  const deslocamento = vencimento <= fechamento ? 1 : 0;
  const passouVencimento = iso(diaNoMes(ano, mes - 1, vencimento)) < hoje;
  const primeiroMes = mes - 1 + Number(passouVencimento);

  const faturas = Array.from({ length: meses + 1 }, (_, indice) => ({
    fechamento: iso(diaNoMes(ano, primeiroMes + indice - deslocamento, fechamento)),
    vencimento: iso(diaNoMes(ano, primeiroMes + indice, vencimento)),
    lancamentos: [],
    totalCentavos: 0,
  }));

  const porVencimento = new Map(faturas.map((fatura) => [fatura.vencimento, fatura]));
  let utilizado = 0;

  for (const lancamento of lancamentos) {
    const { vencimento: dataVencimento } = calcularFatura(lancamento.data, {
      diaFechamento: fechamento,
      diaVencimento: vencimento,
    }, lancamento.parcela_atual);
    const centavos = Math.round(Number(lancamento.valor) * 100);

    if (dataVencimento >= hoje) utilizado += centavos;

    const fatura = porVencimento.get(dataVencimento);
    if (!fatura) continue;

    const parcela = lancamento.total_parcelas > 1
      ? `${lancamento.parcela_atual}/${lancamento.total_parcelas}`
      : null;

    fatura.lancamentos.push({
      id: lancamento.id,
      descricao: lancamento.descricao,
      rotulo: parcela ? `${lancamento.descricao} — ${parcela}` : lancamento.descricao,
      data: lancamento.data,
      parcelaAtual: lancamento.parcela_atual,
      totalParcelas: lancamento.total_parcelas,
      valor: centavos / 100,
    });
    fatura.totalCentavos += centavos;
  }

  const limite = Math.round(Number(cartao.limite) * 100);

  return {
    id: cartao.id,
    nome: cartao.nome,
    limite: limite / 100,
    limiteUtilizado: utilizado / 100,
    limiteDisponivel: Math.max(0, limite - utilizado) / 100,
    faturas: faturas.map(({ totalCentavos, ...fatura }) => ({
      ...fatura,
      referencia: fatura.vencimento.slice(0, 7),
      total: totalCentavos / 100,
    })),
  };
}

export async function preverFaturas(usuarioId, meses) {
  const { rows } = await query(`
    SELECT f.id, f.nome, f.limite, f.dia_fechamento, f.dia_vencimento,
      l.id AS lancamento_id, l.descricao, l.data::text, l.valor,
      l.parcela_atual, l.total_parcelas
    FROM fontes_destinos f
    LEFT JOIN lancamentos l ON l.fonte_destino_id = f.id
      AND l.usuario_id = f.usuario_id AND l.tipo = 'saida'
    WHERE f.usuario_id = $1 AND f.tipo = 'cartao_credito'
    ORDER BY f.nome, f.id, l.data, l.id
  `, [usuarioId]);

  const cartoes = new Map();
  for (const linha of rows) {
    if (!cartoes.has(linha.id)) {
      cartoes.set(linha.id, { cartao: linha, lancamentos: [] });
    }

    if (linha.lancamento_id !== null) {
      cartoes.get(linha.id).lancamentos.push({ ...linha, id: linha.lancamento_id });
    }
  }

  const hoje = hojeNoBrasil();
  return Array.from(cartoes.values(), ({ cartao, lancamentos }) =>
    montarCartao(cartao, lancamentos, meses, hoje),
  );
}
