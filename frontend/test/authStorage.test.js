import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { instalarLocalStorageFalso, fazerToken } from '../test-helpers/helpers.js';

instalarLocalStorageFalso();
const { CHAVE_AUTH, lerAuth, salvarAuth, limparAuth } = await import('../src/services/authStorage.js');

beforeEach(() => localStorage.clear());

test('salva e lê a sessão', () => {
  const sessao = { token: fazerToken(3600), usuario: { id: 1, nome: 'Ana' } };
  salvarAuth(sessao);
  assert.deepEqual(lerAuth(), sessao);
});

test('sem nada guardado: null', () => {
  assert.equal(lerAuth(), null);
});

test('token expirado é descartado e removido do storage', () => {
  salvarAuth({ token: fazerToken(-5), usuario: { id: 1 } });
  assert.equal(lerAuth(), null);
  assert.equal(localStorage.getItem(CHAVE_AUTH), null);
});

test('JSON corrompido é tratado como sem sessão', () => {
  localStorage.setItem(CHAVE_AUTH, '{quebrado');
  assert.equal(lerAuth(), null);
  assert.equal(localStorage.getItem(CHAVE_AUTH), null);
});

test('limparAuth remove a sessão', () => {
  salvarAuth({ token: fazerToken(3600), usuario: {} });
  limparAuth();
  assert.equal(lerAuth(), null);
});
