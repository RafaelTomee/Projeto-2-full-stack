import { Router } from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import { erroValidacao } from '../middlewares/erros.js';
import { preverFaturas } from '../models/Fatura.js';

const router = Router();

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
