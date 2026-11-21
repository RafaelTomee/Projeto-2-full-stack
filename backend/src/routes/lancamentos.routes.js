import { Router } from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import { erroValidacao, naoEncontrado } from '../middlewares/erros.js';
import { Lancamento } from '../models/Lancamento.js';

const router = Router();
const TIPOS = new Set(['entrada', 'saida']);
const DESCRICAO_MAX = 120;
const VALOR_MAX = 9999999999.99;
const NAO_ENCONTRADO = 'Lançamento não encontrado.';

function idValido(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function dataValida(valor) {
  const texto = String(valor ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const data = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}

async function validarCorpo(corpo, usuarioId) {
  const campos = {};
  const tipo = corpo?.tipo;
  const descricao = String(corpo?.descricao ?? '').trim();
  const valor = Number(corpo?.valor);
  const data = corpo?.data;
  const categoriaId = Number(corpo?.categoriaId);
  const fonteDestinoId = Number(corpo?.fonteDestinoId);
  const totalParcelas = Number(corpo?.totalParcelas ?? 1);

  if (!TIPOS.has(tipo)) campos.tipo = "O tipo deve ser 'entrada' ou 'saida'.";
  if (!descricao) campos.descricao = 'A descrição é obrigatória.';
  else if (descricao.length > DESCRICAO_MAX) {
    campos.descricao = `A descrição deve ter no máximo ${DESCRICAO_MAX} caracteres.`;
  }
  if (!Number.isFinite(valor) || valor <= 0 || valor > VALOR_MAX) {
    campos.valor = 'Informe um valor maior que zero.';
  }
  if (!dataValida(data)) campos.data = 'Informe uma data válida no formato AAAA-MM-DD.';
  if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
    campos.categoriaId = 'Informe uma categoria.';
  }
  if (!Number.isInteger(fonteDestinoId) || fonteDestinoId <= 0) {
    campos.fonteDestinoId = 'Informe uma fonte/destino.';
  }
  if (!Number.isInteger(totalParcelas) || totalParcelas < 1 || totalParcelas > 48) {
    campos.totalParcelas = 'Informe entre 1 e 48 parcelas.';
  }
  if (Object.keys(campos).length > 0) throw erroValidacao(campos);

  const categoria = await Lancamento.categoriaDoUsuario(categoriaId, usuarioId);
  if (!categoria) throw naoEncontrado('Categoria não encontrada.');
  if (categoria.tipo !== tipo) {
    throw erroValidacao({
      categoriaId: 'A categoria deve ter o mesmo tipo do lançamento.',
    });
  }

  const fonte = await Lancamento.fonteDoUsuario(fonteDestinoId, usuarioId);
  if (!fonte) throw naoEncontrado('Fonte/destino não encontrado.');
  if (totalParcelas > 1 && fonte.tipo !== 'cartao_credito') {
    throw erroValidacao({
      totalParcelas: 'O parcelamento só é permitido em cartão de crédito.',
    });
  }

  return {
    tipo,
    descricao,
    valor: Math.round((valor + Number.EPSILON) * 100) / 100,
    data,
    categoriaId,
    fonteDestinoId,
    totalParcelas,
  };
}

router.get('/:id', autenticar, async (req, res, next) => {
  try {
    const id = idValido(req.params.id);
    const lancamento = id ? await Lancamento.buscarPorId(id, req.usuarioId) : null;
    if (!lancamento) throw naoEncontrado(NAO_ENCONTRADO);
    res.json(lancamento);
  } catch (erro) {
    next(erro);
  }
});

router.post('/', autenticar, async (req, res, next) => {
  try {
    const dados = await validarCorpo(req.body, req.usuarioId);
    const criado = dados.totalParcelas > 1
      ? (await Lancamento.criarParcelados(req.usuarioId, dados))[0]
      : await Lancamento.criar(req.usuarioId, dados);
    res.status(201).json(criado);
  } catch (erro) {
    next(erro);
  }
});

router.put('/:id', autenticar, async (req, res, next) => {
  try {
    const id = idValido(req.params.id);
    const atual = id ? await Lancamento.buscarPorId(id, req.usuarioId) : null;
    if (!atual) throw naoEncontrado(NAO_ENCONTRADO);
    const dados = await validarCorpo(req.body, req.usuarioId);
    res.json(await Lancamento.atualizar(atual.id, req.usuarioId, dados));
  } catch (erro) {
    next(erro);
  }
});

router.delete('/:id', autenticar, async (req, res, next) => {
  try {
    const id = idValido(req.params.id);
    const atual = id ? await Lancamento.buscarPorId(id, req.usuarioId) : null;
    if (!atual) throw naoEncontrado(NAO_ENCONTRADO);
    if (req.query.todasParcelas === 'true' && atual.grupoParcelamento) {
      await Lancamento.excluirGrupo(atual.grupoParcelamento, req.usuarioId);
    } else {
      await Lancamento.excluir(atual.id, req.usuarioId);
    }
    res.status(204).send();
  } catch (erro) {
    next(erro);
  }
});

export default router;
