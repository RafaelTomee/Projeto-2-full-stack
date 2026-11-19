import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpfValido,
  emailValido,
  senhaValida,
  normalizarCpf,
  normalizarEmail,
} from '../src/models/validacoes.js';

test('cpfValido: aceita CPF válido, com e sem pontuação', () => {
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('52998224725'), true);
});

test('cpfValido: rejeita dígito verificador errado', () => {
  assert.equal(cpfValido('529.982.247-24'), false);
  assert.equal(cpfValido('529.982.247-35'), false);
});

test('cpfValido: rejeita sequências repetidas', () => {
  assert.equal(cpfValido('111.111.111-11'), false);
  assert.equal(cpfValido('00000000000'), false);
});

test('cpfValido: rejeita tamanho errado e valores vazios', () => {
  assert.equal(cpfValido('1234567890'), false);
  assert.equal(cpfValido('529982247250'), false);
  assert.equal(cpfValido(''), false);
  assert.equal(cpfValido(undefined), false);
  assert.equal(cpfValido(null), false);
});

test('normalizarCpf: mantém só os dígitos', () => {
  assert.equal(normalizarCpf('529.982.247-25'), '52998224725');
  assert.equal(normalizarCpf(' 529 982 247 25 '), '52998224725');
});

test('normalizarEmail: trim e minúsculas', () => {
  assert.equal(normalizarEmail('  Ana@Email.COM '), 'ana@email.com');
  assert.equal(normalizarEmail('Ana@Email.com'), normalizarEmail('ana@email.com'));
});

test('emailValido', () => {
  assert.equal(emailValido('ana@email.com'), true);
  assert.equal(emailValido('  Ana@Email.com '), true);
  assert.equal(emailValido('ana@email'), false);
  assert.equal(emailValido('ana email@x.com'), false);
  assert.equal(emailValido('@email.com'), false);
  assert.equal(emailValido(''), false);
  assert.equal(emailValido(`${'a'.repeat(160)}@x.com`), false);
});

test('senhaValida: mínimo 8, com letras e números', () => {
  assert.equal(senhaValida('abc12345'), true);
  assert.equal(senhaValida('Senha123'), true);
  assert.equal(senhaValida('abc1234'), false);        // 7 caracteres
  assert.equal(senhaValida('abcdefgh'), false);       // sem número
  assert.equal(senhaValida('12345678'), false);       // sem letra
  assert.equal(senhaValida(`a1${'x'.repeat(71)}`), false); // passa de 72
  assert.equal(senhaValida(12345678), false);         // não é texto
});
