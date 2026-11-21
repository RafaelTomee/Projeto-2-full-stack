// Helpers puros da tela de lançamentos. A API usa UTC e camelCase na resposta.
export function periodoPadrao(agora = new Date()) {
  const ano = agora.getUTCFullYear();
  const mes = agora.getUTCMonth();
  return {
    inicio: new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10),
    fim: new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10),
  };
}

// Remove filtros vazios para que a API aplique seus próprios padrões.
export function filtrosParaParams(filtros = {}) {
  return Object.fromEntries(
    Object.entries(filtros).filter(
      ([, valor]) => valor !== '' && valor !== null && valor !== undefined,
    ),
  );
}

export function lancamentoParaFormulario(lancamento = {}) {
  return {
    id: lancamento.id ?? null,
    tipo: lancamento.tipo ?? 'saida',
    descricao: lancamento.descricao ?? '',
    valor: Number(lancamento.valor ?? 0),
    data: lancamento.data ?? '',
    categoriaId: lancamento.categoriaId ?? '',
    fonteDestinoId: lancamento.fonteDestinoId ?? '',
    totalParcelas: Number(lancamento.totalParcelas ?? 1),
    parcelaAtual: Number(lancamento.parcelaAtual ?? 1),
  };
}

export function lancamentoParaPayload(formulario = {}) {
  return {
    tipo: formulario.tipo,
    descricao: String(formulario.descricao ?? '').trim(),
    valor: Number(formulario.valor),
    data: formulario.data,
    categoriaId: Number(formulario.categoriaId),
    fonteDestinoId: Number(formulario.fonteDestinoId),
    totalParcelas: Number(formulario.totalParcelas) || 1,
  };
}

export function rotuloParcela(lancamento = {}) {
  const atual = Number(lancamento.parcelaAtual ?? 1);
  const total = Number(lancamento.totalParcelas ?? 1);
  return total > 1 ? `${atual}/${total}` : '';
}
