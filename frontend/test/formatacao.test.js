import test from 'node:test';
import assert from 'node:assert/strict';
import { formatarData, formatarMoeda, textoParaCentavos } from '../src/utils/formatacao.js';

test('formatarMoeda: pt-BR com BRL', () => {
  assert.equal(formatarMoeda(1234.5), 'R$\u00A01.234,50');
  assert.equal(formatarMoeda(0), 'R$\u00A00,00');
  assert.equal(formatarMoeda('1234,56'), 'R$\u00A01.234,56');
  assert.equal(formatarMoeda('1.234,56'), 'R$\u00A01.234,56');
  assert.equal(formatarMoeda('lixo'), 'R$\u00A00,00');
});

test('formatarData: AAAA-MM-DD vira DD/MM/AAAA sem deslocar o dia', () => {
  assert.equal(formatarData('2026-11-20'), '20/11/2026');
  assert.equal(formatarData('2026-01-05'), '05/01/2026');
  assert.equal(formatarData(''), '');
  assert.equal(formatarData('2026-02-30'), '');
  assert.equal(formatarData('lixo'), '');
});

test('textoParaCentavos: cada dígito conta como 1 centavo', () => {
  assert.equal(textoParaCentavos('R$ 1.234,56'), 123456);
  assert.equal(textoParaCentavos('0,01'), 1);
  assert.equal(textoParaCentavos('abc'), 0);
  assert.equal(textoParaCentavos(''), 0);
});
