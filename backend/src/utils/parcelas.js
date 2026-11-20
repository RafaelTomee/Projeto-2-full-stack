export function dividirEmCentavos(valor, totalParcelas) {
  if (!Number.isInteger(totalParcelas) || totalParcelas < 1 || totalParcelas > 48) {
    throw new Error('O total de parcelas deve estar entre 1 e 48.');
  }

  const total = Math.round((valor + Number.EPSILON) * 100);
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('O valor deve ser maior que zero.');
  }

  const base = Math.floor(total / totalParcelas);
  const sobra = total % totalParcelas;
  return Array.from({ length: totalParcelas }, (_, indice) => base + (indice === 0 ? sobra : 0));
}
