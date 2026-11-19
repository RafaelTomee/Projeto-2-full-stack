import { rateLimit } from 'express-rate-limit';

// Limita tentativas de login por IP: no máximo 10 tentativas que falharam
// (400 ou 401) a cada 15 minutos. Logins bem-sucedidos não contam.
// O contador fica em memória: reiniciar o servidor zera.
export const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ erro: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }),
});
