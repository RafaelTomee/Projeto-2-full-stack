import { Router } from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import { consultarSaudeFinanceira } from '../models/SaudeFinanceira.js';

import { mesEmBrasilia } from '../config/saudeFinanceira.js';

const router = Router();

router.get('/', autenticar, async (req, res) => {
  res.json(await consultarSaudeFinanceira(req.usuarioId, mesEmBrasilia(new Date())));
});

export default router;
