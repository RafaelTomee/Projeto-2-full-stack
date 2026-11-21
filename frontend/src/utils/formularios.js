const LIMITE_DIAS = 31;

export function categoriaParaFormulario(categoria = {}) {
  return {
    id: categoria.id ?? null,
    nome: categoria.nome ?? '',
    tipo: categoria.tipo ?? 'entrada',
  };
}

export function categoriaParaPayload(formulario = {}) {
  return {
    nome: String(formulario.nome ?? '').trim(),
    tipo: formulario.tipo,
  };
}

export function fonteParaFormulario(fonte = {}) {
  const cartao = fonte.tipo === 'cartao_credito';
  return {
    id: fonte.id ?? null,
    nome: fonte.nome ?? '',
    tipo: fonte.tipo ?? 'conta',
    diaFechamento: cartao ? Number(fonte.dia_fechamento ?? 0) : null,
    diaVencimento: cartao ? Number(fonte.dia_vencimento ?? 0) : null,
    limite: cartao ? Number(fonte.limite ?? 0) : 0,
    reserva: Boolean(fonte.reserva),
  };
}

export function fonteParaPayload(formulario = {}) {
  const nome = String(formulario.nome ?? '').trim();
  const tipo = formulario.tipo;

  if (tipo !== 'cartao_credito') {
    return { nome, tipo, diaFechamento: null, diaVencimento: null, limite: null };
  }

  const dia = (valor) => {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero >= 1 && numero <= LIMITE_DIAS ? numero : null;
  };

  return {
    nome,
    tipo,
    diaFechamento: dia(formulario.diaFechamento),
    diaVencimento: dia(formulario.diaVencimento),
    limite: Number(formulario.limite),
  };
}
