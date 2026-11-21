import { Router } from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import { conflito, erroValidacao, naoEncontrado } from '../middlewares/erros.js';
import { FonteDestino } from '../models/FonteDestino.js';

const router = Router();
const TIPOS = new Set(['renda', 'conta', 'cartao_credito']);
const NOME_MAX = 60;
const MSG_DUPLICADO = 'Já existe uma fonte/destino com este nome.';
const MSG_VINCULO = 'Não é possível excluir esta fonte/destino: existem lançamentos vinculados a ela.';
const MSG_TIPO_VINCULO = 'Não é possível alterar o tipo desta fonte/destino: existem lançamentos vinculados a ela.';

const conflitoNome = () => conflito(MSG_DUPLICADO, { nome: MSG_DUPLICADO });
const conflitoVinculo = () => conflito(MSG_VINCULO);
const conflitoTipo = () => conflito(MSG_TIPO_VINCULO, { tipo: MSG_TIPO_VINCULO });

// Só números (ou strings numéricas simples) entram: true viraria 1 e [5] viraria 5
// se passassem por Number() direto.
function numeroValido(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'string' && /^\d+(\.\d{1,2})?$/.test(valor.trim())) return Number(valor.trim());
  return null;
}

function diaValido(valor) {
  const dia = numeroValido(valor);
  return dia !== null && Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null;
}

function validarCorpo(corpo) {
  const campos = {};
  let nome = '';
  const tipo = corpo?.tipo;

  if (corpo?.nome === undefined || corpo?.nome === null) {
    campos.nome = 'O nome é obrigatório.';
  } else if (typeof corpo.nome !== 'string') {
    campos.nome = 'O nome deve ser um texto.';
  } else {
    nome = corpo.nome.trim();
    if (!nome) campos.nome = 'O nome é obrigatório.';
    else if (nome.length > NOME_MAX) campos.nome = `O nome deve ter no máximo ${NOME_MAX} caracteres.`;
  }
  if (!TIPOS.has(tipo)) campos.tipo = "O tipo deve ser 'renda', 'conta' ou 'cartao_credito'.";

  let diaFechamento = null;
  let diaVencimento = null;
  let limite = null;

  if (tipo === 'cartao_credito') {
    diaFechamento = diaValido(corpo?.diaFechamento);
    diaVencimento = diaValido(corpo?.diaVencimento);
    const limiteInformado = numeroValido(corpo?.limite);
    limite = limiteInformado === null ? null : Math.round(limiteInformado * 100) / 100;

    if (diaFechamento === null) campos.diaFechamento = 'Informe o dia de fechamento (1 a 31).';
    if (diaVencimento === null) campos.diaVencimento = 'Informe o dia de vencimento (1 a 31).';
    if (limite === null || limite <= 0) {
      campos.limite = 'Informe um limite maior que zero.';
    }
  }

  if (Object.keys(campos).length > 0) throw erroValidacao(campos);
  return { nome, tipo, diaFechamento, diaVencimento, limite };
}

function ehDuplicado(erro) {
  return erro?.code === '23505' && (erro.constraint ?? '').includes('fontes_destinos');
}

function ehVinculo(erro) {
  return erro?.code === '23503' && (erro.constraint ?? '').includes('fonte');
}

router.get('/', autenticar, async (req, res, next) => {
  try {
    res.json(await FonteDestino.listar(req.usuarioId));
  } catch (erro) {
    next(erro);
  }
});

router.get('/:id', autenticar, async (req, res, next) => {
  try {
    const fonte = await FonteDestino.buscarPorId(req.params.id, req.usuarioId);
    if (!fonte) throw naoEncontrado('Fonte/destino não encontrado.');
    res.json(fonte);
  } catch (erro) {
    next(erro);
  }
});

router.post('/', autenticar, async (req, res, next) => {
  try {
    const dados = validarCorpo(req.body);
    if (await FonteDestino.existeComNome(req.usuarioId, dados.nome)) {
      throw conflitoNome();
    }
    res.status(201).json(await FonteDestino.criar(req.usuarioId, dados));
  } catch (erro) {
    if (ehDuplicado(erro)) return next(conflitoNome());
    next(erro);
  }
});

router.put('/:id', autenticar, async (req, res, next) => {
  try {
    const dados = validarCorpo(req.body);
    const atual = await FonteDestino.buscarPorId(req.params.id, req.usuarioId);
    if (!atual) throw naoEncontrado('Fonte/destino não encontrado.');
    if (atual.tipo !== dados.tipo && (await FonteDestino.temLancamentos(atual.id, req.usuarioId))) {
      throw conflitoTipo();
    }
    if (await FonteDestino.existeComNome(req.usuarioId, dados.nome, atual.id)) {
      throw conflitoNome();
    }
    res.json(await FonteDestino.atualizar(atual.id, req.usuarioId, dados));
  } catch (erro) {
    if (ehDuplicado(erro)) return next(conflitoNome());
    next(erro);
  }
});

router.delete('/:id', autenticar, async (req, res, next) => {
  try {
    const atual = await FonteDestino.buscarPorId(req.params.id, req.usuarioId);
    if (!atual) throw naoEncontrado('Fonte/destino não encontrado.');
    if (await FonteDestino.temLancamentos(atual.id, req.usuarioId)) {
      throw conflitoVinculo();
    }
    await FonteDestino.excluir(atual.id, req.usuarioId);
    res.status(204).send();
  } catch (erro) {
    if (ehVinculo(erro)) return next(conflitoVinculo());
    next(erro);
  }
});

export default router;
