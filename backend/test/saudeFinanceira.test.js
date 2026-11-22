import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularSaudeFinanceira, mesEmBrasilia } from '../src/config/saudeFinanceira.js';

test('referência muda à meia-noite em Brasília, e não em UTC', () => {
  assert.equal(mesEmBrasilia(new Date('2027-01-01T02:59:59Z')), '2026-12');
  assert.equal(mesEmBrasilia(new Date('2027-01-01T03:00:00Z')), '2027-01');
});

test('vazio e mês sem receitas não dividem por zero', () => {
  const vazio = calcularSaudeFinanceira([], '2026-11');
  assert.equal(vazio.temLancamentos, false);
  assert.deepEqual(vazio.indicadores, {
    taxaPoupanca: null, comprometimentoCartoes: null, parcelasFuturas: 0,
  });
  assert.deepEqual(vazio.dicas, []);
  const semReceita = calcularSaudeFinanceira([
    { tipo: 'saida', valor: '50.01', data: '2026-11-07', tipo_fonte: 'conta' },
  ], '2026-11');
  assert.equal(semReceita.temLancamentos, true);
  assert.equal(semReceita.indicadores.taxaPoupanca, null);
  assert.deepEqual(semReceita.projecao.map(({ saldo }) => saldo), [-50.01, -50.01, -50.01]);
  assert.equal(semReceita.temSaldoNegativo, true);
});

test('indicadores e projeção usam a fatura, incluindo compra no dia do fechamento', () => {
  const cartao = {
    tipo: 'saida', tipo_fonte: 'cartao_credito',
    dia_fechamento: 10, dia_vencimento: 20,
  };
  const resultado = calcularSaudeFinanceira([
    { tipo: 'entrada', valor: '1000', data: '2026-11-01', tipo_fonte: 'renda' },
    { tipo: 'saida', valor: '500', data: '2026-11-01', tipo_fonte: 'conta' },
    { ...cartao, data: '2026-11-09', valor: '450', parcela_atual: 1, total_parcelas: 1 },
    { ...cartao, data: '2026-11-10', valor: '100', parcela_atual: 1, total_parcelas: 2 },
    { ...cartao, data: '2026-11-10', valor: '100', parcela_atual: 2, total_parcelas: 2 },
  ], '2026-11');
  assert.deepEqual(resultado.indicadores, {
    taxaPoupanca: 5, comprometimentoCartoes: 45, parcelasFuturas: 200,
  });
  assert.deepEqual(resultado.projecao, [
    { mes: '2026-12', saldo: -50 }, { mes: '2027-01', saldo: -150 }, { mes: '2027-02', saldo: -150 },
  ]);
  assert.equal(resultado.temSaldoNegativo, true);
  assert.ok(Object.values(resultado.dicasIndicadores).every(Boolean));
});
