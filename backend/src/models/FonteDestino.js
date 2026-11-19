import { query } from '../config/db.js';

const exec = (client) => client ?? { query };

const PADRAO = [
  { nome: 'Conta corrente', tipo: 'conta' },
  { nome: 'Dinheiro', tipo: 'conta' },
  { nome: 'Salário', tipo: 'renda' },
];

export const FonteDestino = {
  // Cria as fontes/destinos iniciais do usuário (usa o client da transação).
  async criarPadrao(usuarioId, client) {
    await exec(client).query(
      `INSERT INTO fontes_destinos (usuario_id, nome, tipo)
       SELECT $1, t.nome, t.tipo
         FROM unnest($2::text[], $3::text[]) AS t(nome, tipo)`,
      [usuarioId, PADRAO.map((f) => f.nome), PADRAO.map((f) => f.tipo)],
    );
  },

  // TODO (Pessoa B): listar, criar, editar e excluir.
};
