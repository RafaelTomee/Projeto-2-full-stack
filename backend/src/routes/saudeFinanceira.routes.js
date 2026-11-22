import { Router } from 'express';
import { autenticar } from '../middlewares/autenticar.js';
import { consultarSaudeFinanceira } from '../models/SaudeFinanceira.js';

const router = Router();

router.get('/', autenticar, async (req, res) => {
  res.json(await consultarSaudeFinanceira(req.usuarioId));
});

export default router;
