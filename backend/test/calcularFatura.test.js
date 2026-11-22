import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularFatura } from '../src/config/faturas.js';

const nubank = { diaFechamento: 3, diaVencimento: 10 };
const visa = { diaFechamento: 25, diaVencimento: 5 };

const casos = [
  {
    nome: 'compra antes do fechamento entra na fatura do mês',
    compra: '2026-11-02', cartao: nubank, parcela: 1,
    fechamento: '2026-11-03', vencimento: '2026-11-10', referencia: '2026-11',
  },
  {
    nome: 'compra no dia do fechamento entra na fatura seguinte',
    compra: '2026-11-03', cartao: nubank, parcela: 1,
    fechamento: '2026-12-03', vencimento: '2026-12-10', referencia: '2026-12',
  },
  {
    nome: 'compra após o fechamento passa para o próximo ciclo na virada do ano',
    compra: '2026-12-28', cartao: visa, parcela: 1,
    fechamento: '2027-01-25', vencimento: '2027-02-05', referencia: '2027-02',
  },
  {
    nome: 'terceira parcela avança dois ciclos',
    compra: '2026-12-20', cartao: visa, parcela: 3,
    fechamento: '2027-02-25', vencimento: '2027-03-05', referencia: '2027-03',
  },
  {
    nome: 'fechamento no dia 31 é ajustado para fevereiro bissexto',
    compra: '2028-02-28', cartao: { diaFechamento: 31, diaVencimento: 5 }, parcela: 1,
    fechamento: '2028-02-29', vencimento: '2028-03-05', referencia: '2028-03',
  },
  {
    nome: 'compra no fechamento ajustado de fevereiro passa para março',
    compra: '2028-02-29', cartao: { diaFechamento: 31, diaVencimento: 5 }, parcela: 1,
    fechamento: '2028-03-31', vencimento: '2028-04-05', referencia: '2028-04',
  },
];

for (const { nome, compra, cartao, parcela, ...esperado } of casos) {
  test(nome, () => {
    assert.deepEqual(calcularFatura(compra, cartao, parcela), esperado);
  });
}
