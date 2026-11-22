// Helpers puros da tela de lançamentos. A API responde em camelCase.
// Datas AAAA-MM-DD não têm fuso: usar UTC ou getUTC* aqui desloca o dia/mês
// perto da meia-noite em fusos como o de Brasília.
export function isoLocal(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function hojeIso() {
  return isoLocal(new Date());
}

export function periodoPadrao(agora = new Date()) {
  return {
    inicio: isoLocal(new Date(agora.getFullYear(), agora.getMonth(), 1)),
    fim: isoLocal(new Date(agora.getFullYear(), agora.getMonth() + 1, 0)),
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

const TIPOS_FONTE = {
  entrada: new Set(['renda', 'conta']),
  saida: new Set(['conta', 'cartao_credito']),
};

// A mesma regra do backend (#42): entrada não vai para cartão e saída não
// vai para renda. Evita que o campo de parcelas apareça para entrada.
export function fontesParaTipo(fontes = [], tipo) {
  const permitidos = TIPOS_FONTE[tipo] ?? new Set();
  return fontes.filter((fonte) => permitidos.has(fonte.tipo));
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

// Depois de excluir o único item da última página, a API devolve lista vazia
// com os metadados da página antiga. Voltar para a última página evita que o
// usuário fique "preso" numa página que não existe mais.
export function paginaAjustada(pagina, totalPaginas) {
  const atual = Number(pagina);
  const total = Number(totalPaginas);
  const seguro = (valor) => (Number.isFinite(valor) && valor >= 1 ? Math.floor(valor) : 1);
  return Math.min(seguro(atual), seguro(total));
}

// Datas AAAA-MM-DD comparam corretamente como texto.
export function foraDoPeriodo(data, inicio, fim) {
  if (!data || !inicio || !fim) return false;
  return data < inicio || data > fim;
}
