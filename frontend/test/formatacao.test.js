import test from 'node:test';
import assert from 'node:assert/strict';
import { formatarData, formatarMoeda, textoParaCentavos } from '../src/utils/formatacao.js';

test('formatarMoeda: pt-BR com BRL', () => {
  assert.equal(formatarMoeda(1234.5), 'R$\u00A01.234,50');
  assert.equal(formatarMoeda(0), 'R$\u00A00,00');
  assert.equal(formatarMoeda('1234,56'), 'R$\u00A01.234,56');
  assert.equal(formatarMoeda('1.234,56'), 'R$\u00A01.234,56');
  assert.equal(formatarMoeda('1234.56'), 'R$\u00A01.234,56');
  assert.equal(formatarMoeda('1.234'), 'R$\u00A01.234,00');
  assert.equal(formatarMoeda('lixo'), '—');
});

test('formatarData: AAAA-MM-DD vira DD/MM/AAAA sem deslocar o dia', () => {
  assert.equal(formatarData('2026-11-20'), '20/11/2026');
  assert.equal(formatarData('2026-01-05'), '05/01/2026');
  assert.equal(formatarData(''), '');
  assert.equal(formatarData('2026-02-30'), '');
  assert.equal(formatarData('lixo'), '');
});

test('formatarData: timestamp usa o fuso local', () => {
  const timestamp = '2026-11-20T01:00:00Z';
  const esperado = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(timestamp));
  assert.equal(formatarData(timestamp), esperado);
});

test('textoParaCentavos: cada dígito conta como 1 centavo', () => {
  assert.equal(textoParaCentavos('R$ 1.234,56'), 123456);
  assert.equal(textoParaCentavos('0,01'), 1);
  assert.equal(textoParaCentavos('abc'), 0);
  assert.equal(textoParaCentavos(''), 0);
  assert.equal(textoParaCentavos('12345678901234567890'), 123456789012);
  assert.equal(textoParaCentavos('999999999999999'), 999999999999);
});
