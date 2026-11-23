import { calcularFatura } from './faturas.js';

const LIMITE_POUPANCA = 10;
const LIMITE_CARTAO = 30;
const MESES_PROJECAO = 3;
const formatoBrasilia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
});

export function mesEmBrasilia(instante) {
  const partes = formatoBrasilia.formatToParts(instante);
  const ano = partes.find(({ type }) => type === 'year').value;
  const mes = partes.find(({ type }) => type === 'month').value;
  return `${ano}-${mes}`;
}

export function calcularSaudeFinanceira(lancamentos, mesReferencia) {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  const meses = Array.from({ length: MESES_PROJECAO + 1 }, (_, indice) => ({
    mes: new Date(Date.UTC(ano, mes - 1 + indice, 1)).toISOString().slice(0, 7),
    receitas: 0,
    despesas: 0,
    cartao: 0,
    parcelas: 0,
  }));
  const porMes = new Map(meses.map((periodo) => [periodo.mes, periodo]));
  let temLancamentos = false;

  for (const lancamento of lancamentos) {
    const noCartao = lancamento.tipo === 'saida' && lancamento.tipo_fonte === 'cartao_credito';
    const referencia = noCartao
      ? calcularFatura(lancamento.data, {
        diaFechamento: lancamento.dia_fechamento,
        diaVencimento: lancamento.dia_vencimento,
      }, lancamento.parcela_atual).referencia
      : lancamento.data.slice(0, 7);
    const periodo = porMes.get(referencia);
    if (!periodo) continue;
    temLancamentos = true;
    const valor = Math.round(Number(lancamento.valor) * 100);
    if (lancamento.tipo === 'entrada') {
      periodo.receitas += valor;
      continue;
    }

    periodo.despesas += valor;
    if (noCartao) {
      periodo.cartao += valor;
      if (lancamento.total_parcelas > 1) periodo.parcelas += valor;
    }
  }

  const [atual, ...futuros] = meses;
  let saldo = atual.receitas - atual.despesas;
  const percentual = (valor) => atual.receitas
    ? Math.round(valor * 10000 / atual.receitas) / 100
    : null;
  const taxaPoupanca = percentual(saldo);
  const comprometimentoCartoes = percentual(atual.cartao);
  const parcelasFuturas = futuros.reduce((total, periodo) => total + periodo.parcelas, 0) / 100;

  const projecao = futuros.map((periodo) => {
    saldo += periodo.receitas - periodo.despesas;
    return { mes: periodo.mes, saldo: saldo / 100 };
  });

  const dicasIndicadores = {
    taxaPoupanca: taxaPoupanca !== null && taxaPoupanca < LIMITE_POUPANCA
      ? 'Revise as despesas do mês para identificar oportunidades de economia.'
      : null,
    comprometimentoCartoes: comprometimentoCartoes !== null && comprometimentoCartoes > LIMITE_CARTAO
      ? 'Confira quanto da sua renda está comprometida com compras no cartão.'
      : null,
    parcelasFuturas: parcelasFuturas > 0
      ? 'Confira os vencimentos das parcelas antes de assumir novas compras.'
      : null,
  };

  const temSaldoNegativo = projecao.some((periodo) => periodo.saldo < 0);
  const dicas = Object.values(dicasIndicadores).filter(Boolean);
  if (temLancamentos && !atual.receitas) {
    dicas.push('Registre suas entradas para acompanhar os indicadores percentuais.');
  }
  if (temSaldoNegativo) dicas.push('Confira as entradas e contas dos meses com saldo projetado negativo.');

  return {
    mesReferencia,
    temLancamentos,
    indicadores: { taxaPoupanca, comprometimentoCartoes, parcelasFuturas },
    dicasIndicadores,
    projecao,
    temSaldoNegativo,
    dicas,
  };
}
