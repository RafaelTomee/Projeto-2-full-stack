import { Router } from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import { conflito, erroValidacao, naoEncontrado } from '../middlewares/erros.js';
import { Categoria } from '../models/Categoria.js';

const router = Router();
const TIPOS = new Set(['entrada', 'saida']);
const NOME_MAX = 60;
const MSG_DUPLICADO = 'Já existe uma categoria com este nome e tipo.';
const MSG_VINCULO = 'Não é possível excluir esta categoria: existem lançamentos vinculados a ela.';

const conflitoNome = () => conflito(MSG_DUPLICADO, { nome: MSG_DUPLICADO });
const conflitoVinculo = () => conflito(MSG_VINCULO);

function validarCorpo(corpo) {
  const campos = {};
  const nome = String(corpo?.nome ?? '').trim();
  const tipo = corpo?.tipo;

  if (!nome) campos.nome = 'O nome é obrigatório.';
  else if (nome.length > NOME_MAX) campos.nome = `O nome deve ter no máximo ${NOME_MAX} caracteres.`;
  if (!TIPOS.has(tipo)) campos.tipo = "O tipo deve ser 'entrada' ou 'saida'.";

  if (Object.keys(campos).length > 0) throw erroValidacao(campos);
  return { nome, tipo };
}

function ehDuplicado(erro) {
  return erro?.code === '23505' && (erro.constraint ?? '').includes('categorias');
}

function ehVinculo(erro) {
  return erro?.code === '23503' && (erro.constraint ?? '').includes('categoria');
}

router.get('/', autenticar, async (req, res, next) => {
  try {
    res.json(await Categoria.listar(req.usuarioId));
  } catch (erro) {
    next(erro);
  }
});

router.get('/:id', autenticar, async (req, res, next) => {
  try {
    const categoria = await Categoria.buscarPorId(req.params.id, req.usuarioId);
    if (!categoria) throw naoEncontrado('Categoria não encontrada.');
    res.json(categoria);
  } catch (erro) {
    next(erro);
  }
});

router.post('/', autenticar, async (req, res, next) => {
  try {
    const dados = validarCorpo(req.body);
    if (await Categoria.existeComNome(req.usuarioId, dados.nome, dados.tipo)) {
      throw conflitoNome();
    }
    res.status(201).json(await Categoria.criar(req.usuarioId, dados));
  } catch (erro) {
    if (ehDuplicado(erro)) return next(conflitoNome());
    next(erro);
  }
});

router.put('/:id', autenticar, async (req, res, next) => {
  try {
    const dados = validarCorpo(req.body);
    const atual = await Categoria.buscarPorId(req.params.id, req.usuarioId);
    if (!atual) throw naoEncontrado('Categoria não encontrada.');
    if (await Categoria.existeComNome(req.usuarioId, dados.nome, dados.tipo, atual.id)) {
      throw conflitoNome();
    }
    res.json(await Categoria.atualizar(atual.id, req.usuarioId, dados));
  } catch (erro) {
    if (ehDuplicado(erro)) return next(conflitoNome());
    next(erro);
  }
});

router.delete('/:id', autenticar, async (req, res, next) => {
  try {
    const atual = await Categoria.buscarPorId(req.params.id, req.usuarioId);
    if (!atual) throw naoEncontrado('Categoria não encontrada.');
    if (await Categoria.temLancamentos(atual.id, req.usuarioId)) {
      throw conflitoVinculo();
    }
    await Categoria.excluir(atual.id, req.usuarioId);
    res.status(204).send();
  } catch (erro) {
    if (ehVinculo(erro)) return next(conflitoVinculo());
    next(erro);
  }
});

export default router;
