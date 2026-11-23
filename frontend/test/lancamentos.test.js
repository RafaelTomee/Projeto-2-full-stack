import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filtrosParaParams,
  fontesParaTipo,
  foraDoPeriodo,
  hojeIso,
  isoLocal,
  lancamentoParaFormulario,
  lancamentoParaPayload,
  paginaAjustada,
  periodoPadrao,
  rotuloParcela,
} from '../src/utils/lancamentos.js';

test('periodoPadrao: primeiro e último dia do mês, na data local', () => {
  assert.deepEqual(periodoPadrao(new Date(2026, 1, 15, 12)), {
    inicio: '2026-02-01',
    fim: '2026-02-28',
  });
  assert.deepEqual(periodoPadrao(new Date(2024, 1, 15, 12)), {
    inicio: '2024-02-01',
    fim: '2024-02-29',
  });
  assert.deepEqual(periodoPadrao(new Date(2026, 11, 31, 12)), {
    inicio: '2026-12-01',
    fim: '2026-12-31',
  });
});

test('periodoPadrao/isoLocal: perto da meia-noite não troca o dia nem o mês', () => {
  const ultimoDia = new Date(2026, 10, 30, 23, 30);
  assert.equal(isoLocal(ultimoDia), '2026-11-30');
  assert.deepEqual(periodoPadrao(ultimoDia), {
    inicio: '2026-11-01',
    fim: '2026-11-30',
  });
  const agora = new Date();
  assert.equal(hojeIso(), isoLocal(agora));
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

test('fontesParaTipo: entrada só em renda/conta, saída só em conta/cartão', () => {
  const fontes = [
    { id: 1, tipo: 'renda' },
    { id: 2, tipo: 'conta' },
    { id: 3, tipo: 'cartao_credito' },
  ];
  assert.deepEqual(fontesParaTipo(fontes, 'entrada').map((f) => f.id), [1, 2]);
  assert.deepEqual(fontesParaTipo(fontes, 'saida').map((f) => f.id), [2, 3]);
  assert.deepEqual(fontesParaTipo(fontes, 'outro'), []);
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

test('paginaAjustada: excluir o último item da última página volta uma página', () => {
  assert.equal(paginaAjustada(2, 1), 1);
  assert.equal(paginaAjustada(3, 5), 3);
  assert.equal(paginaAjustada(0, 2), 1);
  assert.equal(paginaAjustada(1, 0), 1);
  assert.equal(paginaAjustada('2', '1'), 1);
});

test('foraDoPeriodo: avisa quando o lançamento salvo não aparece no filtro', () => {
  assert.equal(foraDoPeriodo('2026-10-15', '2026-11-01', '2026-11-30'), true);
  assert.equal(foraDoPeriodo('2026-11-15', '2026-11-01', '2026-11-30'), false);
  assert.equal(foraDoPeriodo('2026-10-15', '', '2026-11-30'), false);
});
