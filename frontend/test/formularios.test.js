import test from 'node:test';
import assert from 'node:assert/strict';
import {
  categoriaParaFormulario,
  categoriaParaPayload,
  fonteParaFormulario,
  fonteParaPayload,
} from '../src/utils/formularios.js';

test('categoria: API -> formulário -> payload', () => {
  const formulario = categoriaParaFormulario({ id: 3, nome: 'Salário', tipo: 'entrada' });
  assert.deepEqual(formulario, { id: 3, nome: 'Salário', tipo: 'entrada' });
  assert.deepEqual(categoriaParaPayload({ nome: '  Mercado  ', tipo: 'saida' }), {
    nome: 'Mercado',
    tipo: 'saida',
  });
});

test('fonte: campos extras da API só aparecem para cartão', () => {
  assert.deepEqual(fonteParaFormulario({
    id: 1,
    nome: 'Cartão X',
    tipo: 'cartao_credito',
    dia_fechamento: 5,
    dia_vencimento: 12,
    limite: 2500.5,
    reserva: false,
  }), {
    id: 1,
    nome: 'Cartão X',
    tipo: 'cartao_credito',
    diaFechamento: 5,
    diaVencimento: 12,
    limite: 2500.5,
    reserva: false,
  });

  assert.equal(
    fonteParaFormulario({
      id: 4,
      nome: 'Cartão camel',
      tipo: 'cartao_credito',
      diaFechamento: 7,
      diaVencimento: 15,
      limite: 100,
    }).diaFechamento,
    7,
  );

  assert.deepEqual(fonteParaFormulario({ id: 2, nome: 'Conta', tipo: 'conta' }), {
    id: 2,
    nome: 'Conta',
    tipo: 'conta',
    diaFechamento: null,
    diaVencimento: null,
    limite: 0,
    reserva: false,
  });
});

test('fonte: payload envia os nomes esperados pela API', () => {
  assert.deepEqual(
    fonteParaPayload({
      nome: '  Cartão X  ',
      tipo: 'cartao_credito',
      diaFechamento: '5',
      diaVencimento: '12',
      limite: 1000,
    }),
    {
      nome: 'Cartão X',
      tipo: 'cartao_credito',
      diaFechamento: 5,
      diaVencimento: 12,
      limite: 1000,
    },
  );

  assert.deepEqual(fonteParaPayload({ nome: 'Conta', tipo: 'conta', limite: 50 }), {
    nome: 'Conta',
    tipo: 'conta',
    diaFechamento: null,
    diaVencimento: null,
    limite: null,
  });

  assert.equal(
    fonteParaPayload({ nome: 'X', tipo: 'cartao_credito', diaFechamento: 32, diaVencimento: 0, limite: 10 }).diaFechamento,
    null,
  );
});
