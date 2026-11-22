import { Router } from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import { erroValidacao } from '../middlewares/erros.js';
import { preverFaturas } from '../models/Fatura.js';
import { consultarRelatorioFonteDestino } from '../models/RelatorioFonteDestino.js';
import { consultarRelatorioCategoria } from '../models/RelatorioCategoria.js';

const router = Router();

function dataValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const data = new Date(`${valor}T00:00:00Z`);
  return Number.isFinite(data.getTime())
    && data.getUTCFullYear() >= 1900
    && data.toISOString().slice(0, 10) === valor;
}

function validarPeriodo({ inicio, fim }) {
  const campos = {};

  if (!dataValida(inicio)) campos.inicio = 'Informe uma data válida no formato AAAA-MM-DD.';
  if (!dataValida(fim)) campos.fim = 'Informe uma data válida no formato AAAA-MM-DD.';
  if (Object.keys(campos).length > 0) throw erroValidacao(campos);

  if (inicio > fim) {
    throw erroValidacao({ fim: 'A data final deve ser igual ou posterior à inicial.' });
  }

  return { inicio, fim };
}

router.get('/categorias', autenticar, async (req, res) => {
  const { inicio, fim } = validarPeriodo(req.query);
  res.json(await consultarRelatorioCategoria(req.usuarioId, inicio, fim));
});

router.get('/fontes-destinos', autenticar, async (req, res) => {
  const { inicio, fim } = validarPeriodo(req.query);
  const fontesDestinos = await consultarRelatorioFonteDestino(req.usuarioId, inicio, fim);
  res.json({ inicio, fim, fontesDestinos });
});

router.get('/faturas', autenticar, async (req, res) => {
  const valor = req.query.meses ?? '3';

  if (typeof valor !== 'string' || !/^(?:[0-9]|1[0-2])$/.test(valor)) {
    throw erroValidacao({ meses: 'Informe um número inteiro de 0 a 12.' });
  }

  const meses = Number(valor);
  const cartoes = await preverFaturas(req.usuarioId, meses);
  res.json({ meses, cartoes });
});

export default router;
