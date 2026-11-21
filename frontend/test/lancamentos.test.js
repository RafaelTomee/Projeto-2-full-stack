import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filtrosParaParams,
  lancamentoParaFormulario,
  lancamentoParaPayload,
  periodoPadrao,
  rotuloParcela,
} from '../src/utils/lancamentos.js';

test('periodoPadrao: primeiro e último dia do mês, em UTC', () => {
  assert.deepEqual(periodoPadrao(new Date('2026-02-15T12:00:00Z')), {
    inicio: '2026-02-01',
    fim: '2026-02-28',
  });
  assert.deepEqual(periodoPadrao(new Date('2024-02-15T12:00:00Z')), {
    inicio: '2024-02-01',
    fim: '2024-02-29',
  });
  assert.deepEqual(periodoPadrao(new Date('2026-12-31T12:00:00Z')), {
    inicio: '2026-12-01',
    fim: '2026-12-31',
  });
});

test('filtrosParaParams: omite valores vazios e mantém a página', () => {
  assert.deepEqual(
    filtrosParaParams({
      inicio: '2026-11-01',
      fim: '2026-11-30',
      tipo: '',
      categoriaId: '',
      fonteDestinoId: null,
      pagina: 2,
    }),
    { inicio: '2026-11-01', fim: '2026-11-30', pagina: 2 },
  );
});

test('lançamento: API (camelCase) -> formulário -> payload', () => {
  const formulario = lancamentoParaFormulario({
    id: 7,
    tipo: 'saida',
    descricao: 'Cartão',
    valor: 123.45,
    data: '2026-11-20',
    categoriaId: 3,
    fonteDestinoId: 5,
    parcelaAtual: 3,
    totalParcelas: 10,
  });
  assert.equal(formulario.valor, 123.45);
  assert.equal(formulario.totalParcelas, 10);
  assert.deepEqual(lancamentoParaPayload({ ...formulario, descricao: '  Cartão  ' }), {
    tipo: 'saida',
    descricao: 'Cartão',
    valor: 123.45,
    data: '2026-11-20',
    categoriaId: 3,
    fonteDestinoId: 5,
    totalParcelas: 10,
  });
});

test('rotuloParcela: só aparece para parcelamentos', () => {
  assert.equal(rotuloParcela({ parcelaAtual: 3, totalParcelas: 10 }), '3/10');
  assert.equal(rotuloParcela({ parcelaAtual: 1, totalParcelas: 1 }), '');
  assert.equal(rotuloParcela(), '');
});
