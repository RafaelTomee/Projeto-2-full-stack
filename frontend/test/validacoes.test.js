import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cpfValido,
  emailValido,
  mascararCpf,
  senhaValida,
  somenteDigitos,
  validarCadastro,
  validarCampoCadastro,
  validarLogin,
} from '../src/services/validacoes.js';

test('mascararCpf: formata progressivamente enquanto digita', () => {
  assert.equal(mascararCpf(''), '');
  assert.equal(mascararCpf('5'), '5');
  assert.equal(mascararCpf('529'), '529');
  assert.equal(mascararCpf('5299'), '529.9');
  assert.equal(mascararCpf('529982'), '529.982');
  assert.equal(mascararCpf('5299822'), '529.982.2');
  assert.equal(mascararCpf('529982247'), '529.982.247');
  assert.equal(mascararCpf('5299822472'), '529.982.247-2');
  assert.equal(mascararCpf('52998224725'), '529.982.247-25');
});

test('mascararCpf: ignora letras, reaplica a máscara e limita a 11 dígitos', () => {
  assert.equal(mascararCpf('529.982.247-25'), '529.982.247-25');
  assert.equal(mascararCpf('abc529xyz982'), '529.982');
  assert.equal(mascararCpf('529982247259999'), '529.982.247-25');
});

test('somenteDigitos', () => {
  assert.equal(somenteDigitos('529.982.247-25'), '52998224725');
  assert.equal(somenteDigitos(undefined), '');
});

test('cpfValido: mesmos casos do back-end', () => {
  assert.equal(cpfValido('529.982.247-25'), true);
  assert.equal(cpfValido('52998224725'), true);
  assert.equal(cpfValido('529.982.247-24'), false);
  assert.equal(cpfValido('111.111.111-11'), false);
  assert.equal(cpfValido('1234567890'), false);
  assert.equal(cpfValido(''), false);
});

test('emailValido e senhaValida', () => {
  assert.equal(emailValido('ana@email.com'), true);
  assert.equal(emailValido('  ana@email.com '), true);
  assert.equal(emailValido('ana@email'), false);
  assert.equal(emailValido('ana email@x.com'), false);
  assert.equal(senhaValida('Senha123'), true);
  assert.equal(senhaValida('abc1234'), false);
  assert.equal(senhaValida('abcdefgh'), false);
  assert.equal(senhaValida('12345678'), false);
  assert.equal(senhaValida(`a1${'x'.repeat(71)}`), false);
});

const valido = {
  nome: 'Ana Souza',
  email: 'ana@email.com',
  cpf: '529.982.247-25',
  senha: 'Senha123',
  confirmacaoSenha: 'Senha123',
};

test('validarCadastro: formulário válido não tem erros', () => {
  assert.deepEqual(validarCadastro(valido), {});
});

test('validarCadastro: formulário vazio acusa todos os campos obrigatórios', () => {
  const erros = validarCadastro({});
  assert.deepEqual(Object.keys(erros), ['nome', 'email', 'cpf', 'senha', 'confirmacaoSenha']);
  assert.equal(erros.nome, 'O nome é obrigatório.');
  assert.equal(erros.cpf, 'O CPF é obrigatório.');
});

test('validarCadastro: mensagens por tipo de problema (iguais às do servidor)', () => {
  assert.equal(validarCadastro({ ...valido, nome: '   ' }).nome, 'O nome é obrigatório.');
  assert.equal(validarCadastro({ ...valido, nome: 'a'.repeat(121) }).nome, 'O nome deve ter no máximo 120 caracteres.');
  assert.equal(validarCadastro({ ...valido, email: 'ana@email' }).email, 'Informe um e-mail válido.');
  assert.equal(validarCadastro({ ...valido, cpf: '529.982.247-24' }).cpf, 'Informe um CPF válido.');
  assert.equal(validarCadastro({ ...valido, senha: 'abc12', confirmacaoSenha: 'abc12' }).senha, 'A senha deve ter entre 8 e 72 caracteres.');
  assert.equal(validarCadastro({ ...valido, senha: 'abcdefgh', confirmacaoSenha: 'abcdefgh' }).senha, 'A senha deve conter letras e números.');
  assert.equal(validarCadastro({ ...valido, confirmacaoSenha: 'Outra1234' }).confirmacaoSenha, 'A confirmação de senha não confere.');
  assert.equal(validarCadastro({ ...valido, confirmacaoSenha: '' }).confirmacaoSenha, 'Confirme a senha.');
});

test('validarCampoCadastro: valida um campo isolado (usado ao sair do campo)', () => {
  assert.equal(validarCampoCadastro('cpf', valido), '');
  assert.equal(validarCampoCadastro('cpf', { ...valido, cpf: '111.111.111-11' }), 'Informe um CPF válido.');
  assert.equal(validarCampoCadastro('inexistente', valido), '');
});

test('validarLogin', () => {
  assert.deepEqual(validarLogin({ email: 'ana@email.com', senha: 'x' }), {});
  assert.deepEqual(Object.keys(validarLogin({})), ['email', 'senha']);
  assert.equal(validarLogin({ email: 'ana', senha: 'x' }).email, 'Informe um e-mail válido.');
});
