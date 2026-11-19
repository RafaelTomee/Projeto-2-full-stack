import test from 'node:test';
import assert from 'node:assert/strict';
import { lerPayload, msParaExpirar, tokenExpirado } from '../src/services/token.js';
import { fazerToken } from '../test-helpers/helpers.js';

test('lerPayload: lê o conteúdo do JWT e devolve null para lixo', () => {
  assert.equal(lerPayload(fazerToken(60, '42')).sub, '42');
  assert.equal(lerPayload('lixo'), null);
  assert.equal(lerPayload(''), null);
  assert.equal(lerPayload(undefined), null);
});

test('tokenExpirado: token válido não expirou; vencido, ilegível ou sem exp, sim', () => {
  assert.equal(tokenExpirado(fazerToken(3600)), false);
  assert.equal(tokenExpirado(fazerToken(-10)), true);
  assert.equal(tokenExpirado('lixo'), true);
});

test('msParaExpirar: aproxima o tempo restante e nunca é negativo', () => {
  const ms = msParaExpirar(fazerToken(3600));
  assert.ok(ms > 3_590_000 && ms <= 3_600_000);
  assert.equal(msParaExpirar(fazerToken(-100)), 0);
});
