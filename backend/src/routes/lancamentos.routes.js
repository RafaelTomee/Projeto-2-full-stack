import { Router } from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import { conflito, erroValidacao, naoEncontrado } from '../middlewares/erros.js';
import { Lancamento } from '../models/Lancamento.js';

const router = Router();
const TIPOS = new Set(['entrada', 'saida']);
const TIPOS_FONTE = {
  entrada: new Set(['renda', 'conta']),
  saida: new Set(['conta', 'cartao_credito']),
};
const DESCRICAO_MAX = 120;
const VALOR_MAX = 9999999999.99;
const NAO_ENCONTRADO = 'Lançamento não encontrado.';
const PARCELA_BLOQUEIO = 'Exclua o parcelamento e crie de novo para alterar estes dados.';

function idValido(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Corpo: nada de Number(true) ou Number([5]). Strings numéricas estritas são aceitas.
function idCorpo(valor) {
  if (typeof valor === 'number' && Number.isInteger(valor) && valor > 0) return valor;
  if (typeof valor === 'string' && /^\d+$/.test(valor.trim())) {
    const id = Number(valor.trim());
    return id > 0 ? id : null;
  }
  return null;
}

function valorCorpo(valor) {
  let numero = null;
  if (typeof valor === 'number' && Number.isFinite(valor)) numero = valor;
  else if (typeof valor === 'string' && /^\d+(\.\d{1,2})?$/.test(valor.trim())) {
    numero = Number(valor.trim());
  }
  if (numero === null) return null;
  return Math.round((numero + Number.EPSILON) * 100) / 100;
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
  let descricao = '';
  const data = corpo?.data;
  const valor = valorCorpo(corpo?.valor);
  const categoriaId = idCorpo(corpo?.categoriaId);
  const fonteDestinoId = idCorpo(corpo?.fonteDestinoId);

  if (!TIPOS.has(tipo)) campos.tipo = "O tipo deve ser 'entrada' ou 'saida'.";
  if (corpo?.descricao === undefined || corpo?.descricao === null) {
    campos.descricao = 'A descrição é obrigatória.';
  } else if (typeof corpo.descricao !== 'string') {
    campos.descricao = 'A descrição deve ser um texto.';
  } else {
    descricao = corpo.descricao.trim();
    if (!descricao) campos.descricao = 'A descrição é obrigatória.';
    else if (descricao.length > DESCRICAO_MAX) {
      campos.descricao = `A descrição deve ter no máximo ${DESCRICAO_MAX} caracteres.`;
    }
  }
  // Arredonda antes de validar: 0.004 vira 0.00 e cai em campos.valor,
  // não no CHECK do banco (que devolveria 400 sem campos).
  if (valor === null || valor <= 0 || valor > VALOR_MAX) {
    campos.valor = 'Informe um valor maior que zero.';
  }
  if (!dataValida(data)) campos.data = 'Informe uma data válida no formato AAAA-MM-DD.';
  if (categoriaId === null) campos.categoriaId = 'Informe uma categoria.';
  if (fonteDestinoId === null) campos.fonteDestinoId = 'Informe uma fonte/destino.';
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
  if (!TIPOS_FONTE[tipo].has(fonte.tipo)) {
    throw erroValidacao({
      fonteDestinoId: 'Uma entrada deve usar renda ou conta; uma saída deve usar conta ou cartão de crédito.',
    });
  }

  return {
    tipo,
    descricao,
    valor,
    data,
    categoriaId,
    fonteDestinoId,
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
    res.status(201).json(await Lancamento.criar(req.usuarioId, dados));
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

    if (atual.grupoParcelamento || atual.totalParcelas > 1) {
      const mudouDadosDaCompra =
        dados.tipo !== atual.tipo ||
        dados.valor !== atual.valor ||
        dados.data !== atual.data ||
        dados.fonteDestinoId !== atual.fonteDestinoId;
      if (mudouDadosDaCompra) throw conflito(PARCELA_BLOQUEIO);
      if (atual.grupoParcelamento) {
        const grupo = await Lancamento.atualizarGrupo(
          atual.grupoParcelamento,
          req.usuarioId,
          dados,
        );
        return res.json(grupo.find((item) => item.id === atual.id) ?? grupo[0]);
      }
    }

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
    if (atual.grupoParcelamento) {
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
