function diaNoMes(ano, mes, dia) {
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(dia, ultimoDia)));
}

function iso(data) {
  return data.toISOString().slice(0, 10);
}

export function calcularFatura(dataCompra, cartao, numeroParcela = 1) {
  const [ano, mes, dia] = dataCompra.split('-').map(Number);
  const mesCompra = mes - 1;
  const { diaFechamento, diaVencimento } = cartao;

  const corte = diaNoMes(ano, mesCompra, diaFechamento).getUTCDate();
  const mesFechamento = mesCompra + Number(dia >= corte) + numeroParcela - 1;
  const mesVencimento = mesFechamento + Number(diaVencimento <= diaFechamento);

  const fechamento = iso(diaNoMes(ano, mesFechamento, diaFechamento));
  const vencimento = iso(diaNoMes(ano, mesVencimento, diaVencimento));

  return { referencia: vencimento.slice(0, 7), fechamento, vencimento };
}
