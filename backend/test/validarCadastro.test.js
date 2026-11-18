import test from 'node:test';
import assert from 'node:assert/strict';
import { validarCadastro } from '../src/middlewares/validarCadastro.js';

// Executa o middleware com req/res falsos e devolve o que ele fez.
function executar(body) {
  const req = { body };
  const resultado = { status: null, json: null, next: false };
  const res = {
    status(codigo) {
      resultado.status = codigo;
      return this;
    },
    json(corpo) {
      resultado.json = corpo;
      return this;
    },
  };
  validarCadastro(req, res, () => {
    resultado.next = true;
  });
  return { req, ...resultado };
}

const valido = {
  nome: '  Ana Souza ',
  email: '  Ana@Email.COM ',
  cpf: '529.982.247-25',
  senha: 'Senha123',
  confirmacaoSenha: 'Senha123',
};

test('cadastro válido: chama next() e normaliza o corpo', () => {
  const r = executar({ ...valido });
  assert.equal(r.next, true);
  assert.equal(r.status, null);
  assert.deepEqual(r.req.body, {
    nome: 'Ana Souza',
    email: 'ana@email.com',
    cpf: '52998224725',
    senha: 'Senha123',
  });
});

test('campos obrigatórios: corpo vazio devolve 400 com todos os campos', () => {
  const r = executar({});
  assert.equal(r.next, false);
  assert.equal(r.status, 400);
  assert.equal(r.json.erro, 'Dados inválidos.');
  assert.deepEqual(Object.keys(r.json.campos).sort(), ['cpf', 'email', 'nome', 'senha']);
});

test('corpo ausente (undefined) não quebra', () => {
  const r = executar(undefined);
  assert.equal(r.status, 400);
});

test('CPF com dígito verificador errado é rejeitado no campo cpf', () => {
  const r = executar({ ...valido, cpf: '529.982.247-24' });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.json.campos), ['cpf']);
});

test('CPF repetido (111.111.111-11) é rejeitado', () => {
  const r = executar({ ...valido, cpf: '111.111.111-11' });
  assert.equal(r.status, 400);
  assert.ok(r.json.campos.cpf);
});

test('e-mail inválido é rejeitado no campo email', () => {
  const r = executar({ ...valido, email: 'ana@email' });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.json.campos), ['email']);
});

test('senha fraca: curta, sem número ou sem letra', () => {
  for (const senha of ['abc1234', 'abcdefgh', '12345678']) {
    const r = executar({ ...valido, senha, confirmacaoSenha: senha });
    assert.equal(r.status, 400, `deveria rejeitar "${senha}"`);
    assert.ok(r.json.campos.senha);
  }
});

test('confirmação de senha diferente é rejeitada', () => {
  const r = executar({ ...valido, confirmacaoSenha: 'Outra1234' });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.json.campos), ['confirmacaoSenha']);
});

test('tipos inesperados (objeto, número) não quebram e são rejeitados', () => {
  const r = executar({ nome: { a: 1 }, email: 123, cpf: [], senha: 12345678 });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.json.campos).sort(), ['cpf', 'email', 'nome', 'senha']);
});

test('a senha não sofre trim', () => {
  const r = executar({ ...valido, senha: ' Senha123 ', confirmacaoSenha: ' Senha123 ' });
  assert.equal(r.next, true);
  assert.equal(r.req.body.senha, ' Senha123 ');
});
