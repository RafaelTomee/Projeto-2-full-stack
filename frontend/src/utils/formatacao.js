const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function paraNumero(valor) {
  if (typeof valor === 'number') return valor;
  const texto = String(valor ?? '').trim();
  if (!texto) return Number.NaN;
  // "1.234,56" é pt-BR; "1234.56" também é aceito (vindo de JSON, por exemplo).
  return texto.includes(',')
    ? Number(texto.replace(/\./g, '').replace(',', '.'))
    : Number(texto);
}

export function formatarMoeda(valor) {
  const numero = paraNumero(valor);
  return formatadorMoeda.format(Number.isFinite(numero) ? numero : 0);
}

export function formatarData(valor) {
  if (!valor) return '';
  const texto = String(valor);
  const éIso = /^\d{4}-\d{2}-\d{2}$/.test(texto);
  const data = éIso ? new Date(`${texto}T00:00:00Z`) : new Date(texto);
  if (Number.isNaN(data.getTime())) return '';
  if (éIso && data.toISOString().slice(0, 10) !== texto) return '';
  return formatadorData.format(data);
}

// O CampoMoeda trata cada dígito digitado como 1 centavo.
export function textoParaCentavos(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '');
  return digitos ? Number(digitos) : 0;
}
