import { query } from '../config/db.js';

const exec = (client) => client ?? { query };

const PADRAO = [
  { nome: 'Salário', tipo: 'entrada' },
  { nome: 'Outros', tipo: 'entrada' },
  { nome: 'Alimentação', tipo: 'saida' },
  { nome: 'Moradia', tipo: 'saida' },
  { nome: 'Saúde', tipo: 'saida' },
  { nome: 'Mobilidade', tipo: 'saida' },
  { nome: 'Lazer', tipo: 'saida' },
  { nome: 'Educação', tipo: 'saida' },
  { nome: 'Outros', tipo: 'saida' },
];

export const Categoria = {
  // Cria as categorias iniciais do usuário. Recebe o client da transação do
  // cadastro, para que usuário e padrões sejam gravados juntos (ou nenhum).
  async criarPadrao(usuarioId, client) {
    await exec(client).query(
      `INSERT INTO categorias (usuario_id, nome, tipo)
       SELECT $1, t.nome, t.tipo
         FROM unnest($2::text[], $3::text[]) AS t(nome, tipo)`,
      [usuarioId, PADRAO.map((c) => c.nome), PADRAO.map((c) => c.tipo)],
    );
  },

  // TODO (Pessoa B): listar, criar, editar e excluir.
};
