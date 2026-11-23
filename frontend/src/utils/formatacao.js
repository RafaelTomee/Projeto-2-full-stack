const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

// Datas AAAA-MM-DD (campo data) não têm fuso: usar UTC evita deslocar o dia.
const formatadorDataIso = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const MAX_DIGITOS_MOEDA = 12; // 9999999999,99 em centavos (limite da API)

function paraNumero(valor) {
  if (typeof valor === 'number') return valor;
  const texto = String(valor ?? '').trim();
  if (!texto) return Number.NaN;
  if (texto.includes(',')) {
    // pt-BR: "1.234,56". Ponto sem vírgula é decimal estrito ("1234.56").
    if (!/^(?:\d{1,3}(\.\d{3})*|\d+),\d{1,2}$/.test(texto)) return Number.NaN;
    return Number(texto.replace(/\./g, '').replace(',', '.'));
  }
  // "1.234" sem vírgula é mil (pt-BR), não 1,234; "1234.56" é decimal estrito.
  if (/^\d{1,3}(\.\d{3})+$/.test(texto)) return Number(texto.replace(/\./g, ''));
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) return Number.NaN;
  return Number(texto);
}

export function formatarMoeda(valor) {
  const numero = paraNumero(valor);
  return Number.isFinite(numero) ? formatadorMoeda.format(numero) : '—';
}

export function formatarData(valor) {
  if (!valor) return '';
  const texto = String(valor);
  const éIso = /^\d{4}-\d{2}-\d{2}$/.test(texto);
  const data = éIso ? new Date(`${texto}T00:00:00Z`) : new Date(texto);
  if (Number.isNaN(data.getTime())) return '';
  if (éIso && data.toISOString().slice(0, 10) !== texto) return '';
  // Timestamps usam o fuso local do usuário; datas sem hora ficam em UTC.
  return (éIso ? formatadorDataIso : formatadorData).format(data);
}

// O CampoMoeda trata cada dígito digitado como 1 centavo e limita a 12 dígitos
// (acima disso o número perde precisão e a API recusa com 400).
export function textoParaCentavos(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '').slice(0, MAX_DIGITOS_MOEDA);
  if (!digitos) return 0;
  return Math.min(Number(digitos), 10 ** MAX_DIGITOS_MOEDA - 1);
}
