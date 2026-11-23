// Seed de demonstração: 2 usuários com 3 meses de lançamentos cada.
// Uso: npm run db:seed        (precisa do banco criado: npm run db:create)
//
// - Pode ser executado várias vezes: apaga e recria só os dois usuários de demonstração
//   (e os dados deles). Contas de outras pessoas nunca são tocadas.
// - As datas são relativas a HOJE: sempre cobre o mês atual e os 2 anteriores.
// - Os dados são determinísticos (sem aleatoriedade): a demonstração é sempre a mesma.
// - Não depende do código dos models/rotas: grava direto no banco, só precisa do schema.sql.
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcrypt';
import pg from 'pg';

export const SENHA_DEMO = 'Senha123';

// ---------------------------------------------------------------------------
// DECISÃO DE MODELAGEM (combinar com B e C): como cada parcela guarda a data.
// Aqui, todas as parcelas guardam a DATA DA COMPRA e a fatura de cada uma é
// calculada com calcularFatura(data, cartao, parcela_atual) (primeira dica do
// enunciado, seção 10.5.9). Se o grupo optar por gravar o vencimento da fatura
// em cada parcela, é só mudar esta função.
export function dataDaParcela(dataCompra /* , numeroParcela, cartao */) {
  return dataCompra;
}

// ---------------------------------------------------------------------------
// Datas e dinheiro

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// "hoje" é uma Date em UTC à meia-noite (só dia, mês e ano importam).
// deslocamento: 0 = mês atual, -1 = mês passado, -2 = retrasado.
// Dias que não existem no mês (31 em fevereiro) viram o último dia; no mês atual,
// dias que ainda não chegaram viram "hoje" (a demonstração nunca tem data futura).
export function dataRelativa(hoje, deslocamento, dia) {
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth() + deslocamento;
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const data = iso(new Date(Date.UTC(ano, mes, Math.min(dia, ultimoDia))));
  return data > iso(hoje) ? iso(hoje) : data;
}

const centavos = (reais) => Math.round(reais * 100);
const emReais = (c) => (c / 100).toFixed(2);

// Divide em centavos; a diferença do arredondamento vai para a primeira parcela.
// Ex.: R$ 100,00 em 3x -> 33,34 + 33,33 + 33,33.
export function dividirEmParcelas(totalCentavos, numeroParcelas) {
  const base = Math.floor(totalCentavos / numeroParcelas);
  const resto = totalCentavos - base * numeroParcelas;
  return Array.from({ length: numeroParcelas }, (_, i) => (i === 0 ? base + resto : base));
}

// ---------------------------------------------------------------------------
// Dados de demonstração
//
// Tipos de lançamento nas listas abaixo:
//   - mensal:    { valores: [mês-2, mês-1, mês atual], dia }  (null = não ocorre naquele mês)
//   - avulso:    { mes: -1, dia, valor }
//   - parcelado: { mes, dia, valor, parcelas }  (só em cartão de crédito)

const E = 'entrada';
const S = 'saida';

const USUARIOS = [
  {
    nome: 'Ana Souza',
    email: 'ana@demo.com',
    cpf: '11144477735',
    categorias: [
      [E, 'Salário'], [E, 'Freelance'], [E, 'Rendimentos'], [E, 'Outros'],
      [S, 'Alimentação'], [S, 'Moradia'], [S, 'Saúde'], [S, 'Mobilidade'],
      [S, 'Lazer'], [S, 'Educação'], [S, 'Outros'],
    ],
    fontes: [
      { nome: 'Salário', tipo: 'renda' },
      { nome: 'Freelance', tipo: 'renda' },
      { nome: 'Conta corrente', tipo: 'conta' },
      { nome: 'Poupança', tipo: 'conta', reserva: true },
      { nome: 'Dinheiro', tipo: 'conta' },
      { nome: 'Nubank', tipo: 'cartao_credito', diaFechamento: 3, diaVencimento: 10, limite: 5000 },
      { nome: 'Visa crédito', tipo: 'cartao_credito', diaFechamento: 25, diaVencimento: 5, limite: 8000 },
    ],
    lancamentos: [
      // Entradas
      { tipo: E, descricao: 'Salário', categoria: 'Salário', fonte: 'Salário', dia: 5, valores: [6500, 6500, 6500] },
      { tipo: E, descricao: 'Projeto freelance', categoria: 'Freelance', fonte: 'Freelance', dia: 15, valores: [1200, 850, 1500] },
      { tipo: E, descricao: 'Rendimentos da poupança', categoria: 'Rendimentos', fonte: 'Poupança', dia: 28, valores: [41.37, 44.02, 46.8] },
      // Saídas na conta corrente / dinheiro
      { tipo: S, descricao: 'Aluguel', categoria: 'Moradia', fonte: 'Conta corrente', dia: 7, valores: [1650, 1650, 1650] },
      { tipo: S, descricao: 'Conta de luz', categoria: 'Moradia', fonte: 'Conta corrente', dia: 12, valores: [182.4, 164.75, 198.3] },
      { tipo: S, descricao: 'Internet', categoria: 'Moradia', fonte: 'Conta corrente', dia: 10, valores: [119.9, 119.9, 119.9] },
      { tipo: S, descricao: 'Mercado (início do mês)', categoria: 'Alimentação', fonte: 'Conta corrente', dia: 6, valores: [412.35, 389.9, 436.2] },
      { tipo: S, descricao: 'Mercado (meio do mês)', categoria: 'Alimentação', fonte: 'Conta corrente', dia: 20, valores: [356.8, 401.15, 372.6] },
      { tipo: S, descricao: 'Feira', categoria: 'Alimentação', fonte: 'Dinheiro', dia: 11, valores: [60, 75, 52.5] },
      { tipo: S, descricao: 'Farmácia', categoria: 'Saúde', fonte: 'Dinheiro', dia: 16, valores: [89.6, null, 134.2] },
      { tipo: S, descricao: 'Reserva mensal', categoria: 'Outros', fonte: 'Poupança', dia: 6, valores: [500, 500, 500] },
      // Saídas no cartão Nubank (fecha dia 3, vence dia 10)
      { tipo: S, descricao: 'Streaming (Netflix e Spotify)', categoria: 'Lazer', fonte: 'Nubank', dia: 2, valores: [55.9, 55.9, 55.9] },
      { tipo: S, descricao: 'Academia', categoria: 'Saúde', fonte: 'Nubank', dia: 4, valores: [119.9, 119.9, 119.9] },
      { tipo: S, descricao: 'Uber', categoria: 'Mobilidade', fonte: 'Nubank', dia: 17, valores: [64.8, 112.3, 87.5] },
      { tipo: S, descricao: 'iFood', categoria: 'Alimentação', fonte: 'Nubank', dia: 22, valores: [78.9, 92.4, 85.7] },
      // Saídas no cartão Visa crédito (fecha dia 25, vence dia 5)
      { tipo: S, descricao: 'Combustível', categoria: 'Mobilidade', fonte: 'Visa crédito', dia: 9, valores: [250, 230, 270] },
      { tipo: S, descricao: 'Restaurantes', categoria: 'Alimentação', fonte: 'Visa crédito', dia: 14, valores: [210, 268.5, 245.9] },
      { tipo: S, descricao: 'Cinema', categoria: 'Lazer', fonte: 'Visa crédito', dia: 19, valores: [68, null, 94] },
      { tipo: S, descricao: 'Viagem de fim de semana', categoria: 'Lazer', fonte: 'Visa crédito', mes: -1, dia: 21, valor: 480 },
      // Compras parceladas
      { tipo: S, descricao: 'Notebook', categoria: 'Educação', fonte: 'Visa crédito', mes: -2, dia: 12, valor: 4299.9, parcelas: 10 },
      { tipo: S, descricao: 'Geladeira', categoria: 'Moradia', fonte: 'Visa crédito', mes: -1, dia: 15, valor: 2400, parcelas: 12 },
      { tipo: S, descricao: 'Tênis de corrida', categoria: 'Saúde', fonte: 'Nubank', mes: -1, dia: 18, valor: 899.9, parcelas: 3 },
      // Casos de fechamento da fatura (para a demonstração das faturas)
      { tipo: S, descricao: 'Livro de Engenharia de Software (compra no dia do fechamento)', categoria: 'Educação', fonte: 'Nubank', mes: -1, dia: 3, valor: 129.9 },
      { tipo: S, descricao: 'Mouse (um dia antes do fechamento)', categoria: 'Educação', fonte: 'Nubank', mes: -1, dia: 2, valor: 89.9 },
      { tipo: S, descricao: 'Jantar de aniversário (compra no dia do fechamento)', categoria: 'Alimentação', fonte: 'Visa crédito', mes: -2, dia: 25, valor: 186 },
      { tipo: S, descricao: 'Cafeteria (um dia antes do fechamento)', categoria: 'Alimentação', fonte: 'Visa crédito', mes: -2, dia: 24, valor: 42.5 },
    ],
  },
  {
    nome: 'Bruno Lima',
    email: 'bruno@demo.com',
    cpf: '12345678909',
    categorias: [
      [E, 'Salário'], [E, 'Outros'],
      [S, 'Alimentação'], [S, 'Moradia'], [S, 'Saúde'], [S, 'Mobilidade'],
      [S, 'Lazer'], [S, 'Educação'], [S, 'Pets'], [S, 'Outros'],
    ],
    fontes: [
      { nome: 'Salário', tipo: 'renda' },
      { nome: 'Conta corrente', tipo: 'conta' },
      { nome: 'Poupança', tipo: 'conta', reserva: true },
      { nome: 'Inter Mastercard', tipo: 'cartao_credito', diaFechamento: 15, diaVencimento: 22, limite: 3000 },
    ],
    lancamentos: [
      { tipo: E, descricao: 'Salário', categoria: 'Salário', fonte: 'Salário', dia: 5, valores: [3800, 3800, 3950] },
      { tipo: E, descricao: 'Rendimentos da poupança', categoria: 'Outros', fonte: 'Poupança', dia: 28, valores: [22.1, 24.35, 26.9] },
      { tipo: E, descricao: 'Venda de bicicleta usada', categoria: 'Outros', fonte: 'Conta corrente', mes: -1, dia: 19, valor: 650 },
      { tipo: S, descricao: 'Aluguel', categoria: 'Moradia', fonte: 'Conta corrente', dia: 6, valores: [1100, 1100, 1100] },
      { tipo: S, descricao: 'Condomínio', categoria: 'Moradia', fonte: 'Conta corrente', dia: 8, valores: [380, 380, 380] },
      { tipo: S, descricao: 'Mercado', categoria: 'Alimentação', fonte: 'Conta corrente', dia: 10, valores: [520.4, 498.75, 547.3] },
      { tipo: S, descricao: 'Transporte público', categoria: 'Mobilidade', fonte: 'Conta corrente', dia: 3, valores: [220, 220, 220] },
      { tipo: S, descricao: 'Plano de saúde', categoria: 'Saúde', fonte: 'Conta corrente', dia: 9, valores: [289.9, 289.9, 289.9] },
      { tipo: S, descricao: 'Reserva mensal', categoria: 'Outros', fonte: 'Poupança', dia: 6, valores: [300, 300, 300] },
      { tipo: S, descricao: 'Lanches e restaurantes', categoria: 'Alimentação', fonte: 'Inter Mastercard', dia: 18, valores: [150, 180, 120] },
      { tipo: S, descricao: 'Ração e veterinário', categoria: 'Pets', fonte: 'Inter Mastercard', dia: 13, valores: [145, 310, 145] },
      { tipo: S, descricao: 'Streaming', categoria: 'Lazer', fonte: 'Inter Mastercard', dia: 20, valores: [39.9, 39.9, 39.9] },
      { tipo: S, descricao: 'Smartphone', categoria: 'Outros', fonte: 'Inter Mastercard', mes: -2, dia: 16, valor: 2199.9, parcelas: 12 },
      { tipo: S, descricao: 'Presente de aniversário (compra no dia do fechamento)', categoria: 'Lazer', fonte: 'Inter Mastercard', mes: -1, dia: 15, valor: 150 },
      { tipo: S, descricao: 'Lanche (um dia antes do fechamento)', categoria: 'Alimentação', fonte: 'Inter Mastercard', mes: -1, dia: 14, valor: 38 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Expande a especificação em linhas prontas para inserir (uma por lançamento/parcela).

export function montarLancamentos(usuario, hoje) {
  const fontes = new Map(usuario.fontes.map((f) => [f.nome, f]));
  const categorias = new Set(usuario.categorias.map(([tipo, nome]) => `${nome}|${tipo}`));
  const linhas = [];

  const adicionar = (item, mes, dia, valor) => {
    if (valor == null) return; // não ocorre neste mês
    const fonte = fontes.get(item.fonte);
    if (!fonte) throw new Error(`Seed: fonte/destino "${item.fonte}" não existe para ${usuario.nome}.`);
    if (!categorias.has(`${item.categoria}|${item.tipo}`)) {
      throw new Error(`Seed: categoria "${item.categoria}" (${item.tipo}) não existe para ${usuario.nome}.`);
    }
    const data = dataRelativa(hoje, mes, dia);
    const total = centavos(valor);

    if (item.parcelas > 1) {
      if (fonte.tipo !== 'cartao_credito') throw new Error(`Seed: "${item.descricao}" parcelado fora de cartão.`);
      const grupo = randomUUID();
      dividirEmParcelas(total, item.parcelas).forEach((c, i) => {
        linhas.push({
          ...item, fonteObj: fonte, data: dataDaParcela(data, i + 1, fonte), centavos: c,
          parcelaAtual: i + 1, totalParcelas: item.parcelas, grupo,
        });
      });
    } else {
      linhas.push({ ...item, fonteObj: fonte, data, centavos: total, parcelaAtual: 1, totalParcelas: 1, grupo: null });
    }
  };

  for (const item of usuario.lancamentos) {
    if (item.valores) {
      item.valores.forEach((valor, i) => adicionar(item, i - 2, item.dia, valor)); // -2, -1, 0
    } else {
      adicionar(item, item.mes ?? 0, item.dia, item.valor);
    }
  }

  // Ordem cronológica: os ids acompanham a data e a listagem do banco fica natural.
  return linhas.sort((a, b) => a.data.localeCompare(b.data) || a.parcelaAtual - b.parcelaAtual);
}

// ---------------------------------------------------------------------------
// Grava tudo numa transação. "client" é um pg.Client (ou PoolClient) já conectado.

export async function executarSeed(client, { hoje = hojeEmUtc() } = {}) {
  const emails = USUARIOS.map((u) => u.email);
  const senhaHash = await bcrypt.hash(SENHA_DEMO, 10);
  const resumo = [];

  await client.query('BEGIN');
  try {
    // Recria só os usuários de demonstração (idempotente). Os lançamentos são apagados
    // antes porque referenciam categorias e fontes sem ON DELETE CASCADE.
    await client.query(
      'DELETE FROM lancamentos WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = ANY($1))',
      [emails],
    );
    await client.query('DELETE FROM usuarios WHERE email = ANY($1)', [emails]);

    for (const usuario of USUARIOS) {
      const { rows: [{ id: usuarioId }] } = await client.query(
        'INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ($1, $2, $3, $4) RETURNING id',
        [usuario.nome, usuario.email, usuario.cpf, senhaHash],
      );

      const idCategoria = new Map();
      for (const [tipo, nome] of usuario.categorias) {
        const { rows } = await client.query(
          'INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id',
          [usuarioId, nome, tipo],
        );
        idCategoria.set(`${nome}|${tipo}`, rows[0].id);
      }

      const idFonte = new Map();
      for (const f of usuario.fontes) {
        const { rows } = await client.query(
          `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [usuarioId, f.nome, f.tipo, f.diaFechamento ?? null, f.diaVencimento ?? null, f.limite ?? null, f.reserva ?? false],
        );
        idFonte.set(f.nome, rows[0].id);
      }

      const linhas = montarLancamentos(usuario, hoje);
      for (const l of linhas) {
        await client.query(
          `INSERT INTO lancamentos
             (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id,
              parcela_atual, total_parcelas, grupo_parcelamento)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            usuarioId, l.tipo, l.descricao, emReais(l.centavos), l.data,
            idCategoria.get(`${l.categoria}|${l.tipo}`), idFonte.get(l.fonte),
            l.parcelaAtual, l.totalParcelas, l.grupo,
          ],
        );
      }

      resumo.push({
        id: usuarioId, nome: usuario.nome, email: usuario.email, cpf: usuario.cpf,
        categorias: usuario.categorias.length, fontes: usuario.fontes.length, lancamentos: linhas.length,
      });
    }

    await client.query('COMMIT');
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  }
  return resumo;
}

// Dia de hoje (no fuso do computador) normalizado como Date UTC à meia-noite.
function hojeEmUtc() {
  const agora = new Date();
  return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}

const mascararCpf = (c) => `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;

// ---------------------------------------------------------------------------
// Execução pela linha de comando (npm run db:seed). Importar este arquivo não executa nada.

async function principal() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não definida. Copie .env.example para .env e preencha.');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const resumo = await executarSeed(client);

    console.log('Seed concluído. Usuários de demonstração:\n');
    for (const u of resumo) {
      console.log(`  ${u.nome.padEnd(11)} ${u.email.padEnd(15)} CPF ${mascararCpf(u.cpf)}  ` +
        `${u.categorias} categorias, ${u.fontes} fontes/destinos, ${u.lancamentos} lançamentos`);
    }
    console.log(`\nSenha dos dois usuários: ${SENHA_DEMO}`);
  } catch (erro) {
    if (erro.code === '23505') {
      console.error('Não foi possível criar os usuários de demonstração: o CPF ou o e-mail deles já pertence a outra conta.');
      console.error(`Detalhe: ${erro.detail ?? erro.message}`);
    } else if (erro.code === '42P01' || erro.code === '3D000') {
      console.error('O banco ou as tabelas não existem. Rode antes: npm run db:create');
    } else {
      console.error('Erro ao executar o seed:', erro.message);
    }
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
