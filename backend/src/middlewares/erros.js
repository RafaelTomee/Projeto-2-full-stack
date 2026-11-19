// Padrão único de erro da API:
//
//   { "erro": "Mensagem geral.", "campos": { "valor": "Mensagem do campo." } }
//
// "campos" só aparece quando o erro é de campos específicos do formulário.
//
// COMO USAR NAS ROTAS (Express 5 já repassa erros de funções async):
//
//   import { erroValidacao, naoEncontrado, conflito } from '../middlewares/erros.js';
//
//   throw erroValidacao({ valor: 'O valor deve ser maior que zero.' });   // 400
//   throw naoEncontrado('Lançamento não encontrado.');                     // 404
//   throw conflito('Categoria já existe.', { nome: 'Já existe.' });        // 409
//
// Tudo que for lançado (ou passado em next(erro)) cai no tratarErros, no fim do server.js.

export class ErroHttp extends Error {
  constructor(status, mensagem, campos) {
    super(mensagem);
    this.name = 'ErroHttp';
    this.status = status;
    this.campos = campos;
  }
}

// 400: dados inválidos. "campos" é um objeto { nomeDoCampo: 'mensagem' }.
export const erroValidacao = (campos, mensagem = 'Dados inválidos.') =>
  new ErroHttp(400, mensagem, campos);

// 404: o recurso não existe (ou é de outro usuário: para ele "não existe").
export const naoEncontrado = (mensagem = 'Recurso não encontrado.') =>
  new ErroHttp(404, mensagem);

// 409: conflito (duplicidade, exclusão bloqueada por vínculos...).
export const conflito = (mensagem, campos) => new ErroHttp(409, mensagem, campos);

// ---------------------------------------------------------------------------
// Rota inexistente -> 404 em JSON (em vez da página HTML padrão do Express).
export function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: 'Rota não encontrada.' });
}

// Erros do PostgreSQL que não foram tratados na rota. É uma rede de segurança:
// o ideal continua sendo validar antes, mas assim um id "abc" na URL vira 400
// e não 500. Nunca devolvemos a mensagem original do banco.
const ERROS_POSTGRES = {
  '23505': [409, 'Já existe um registro com esses dados.'],                 // UNIQUE
  '23503': [409, 'Operação não permitida: o registro está relacionado a outros dados.'], // FK
  '23502': [400, 'Dados inválidos.'],                                        // NOT NULL
  '23514': [400, 'Dados inválidos.'],                                        // CHECK
  '22P02': [400, 'Dados inválidos.'],                                        // texto inválido p/ o tipo (ex.: id "abc")
  '22003': [400, 'Dados inválidos.'],                                        // número fora do intervalo
  '22001': [400, 'Dados inválidos.'],                                        // texto maior que a coluna
  '22007': [400, 'Dados inválidos.'],                                        // data em formato inválido
  '22008': [400, 'Dados inválidos.'],                                        // data fora do intervalo
};

// ---------------------------------------------------------------------------
// Middleware final (tem 4 parâmetros: é assim que o Express o reconhece).
// Deve ser o ÚLTIMO app.use do server.js.
export function tratarErros(erro, req, res, next) {
  // Se a resposta já começou a ser enviada, só o Express pode encerrar a conexão.
  if (res.headersSent) return next(erro);

  // 1) Erros que nós mesmos lançamos.
  if (erro instanceof ErroHttp) {
    const corpo = { erro: erro.message };
    if (erro.campos) corpo.campos = erro.campos;
    return res.status(erro.status).json(corpo);
  }

  // 2) JSON quebrado, corpo grande demais etc. (vêm do express.json()).
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }
  if (erro.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Corpo da requisição muito grande.' });
  }
  if (Number.isInteger(erro.status) && erro.status >= 400 && erro.status < 500) {
    return res.status(erro.status).json({ erro: 'Requisição inválida.' });
  }

  // 3) Erros do PostgreSQL conhecidos.
  const pg = ERROS_POSTGRES[erro.code];
  if (pg) {
    return res.status(pg[0]).json({ erro: pg[1] });
  }

  // 4) Qualquer outra coisa: 500 genérico. O detalhe vai só para o log do
  //    servidor (sem corpo da requisição, que pode ter senha). Nunca para o cliente.
  console.error(`[erro 500] ${req.method} ${req.originalUrl}`, erro);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}
