import { verificarToken } from '../config/jwt.js';

// Protege uma rota: exige "Authorization: Bearer <token>" válido.
// Em caso de sucesso, disponibiliza o id do usuário em req.usuarioId (número).
// Ausente, inválido ou expirado -> 401.
//
// Uso:  router.get('/categorias', autenticar, async (req, res) => { ... req.usuarioId ... });
export function autenticar(req, res, next) {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  if (esquema?.toLowerCase() !== 'bearer' || !token) {
    return res.status(401).json({ erro: 'Token não informado.' });
  }
  try {
    req.usuarioId = verificarToken(token);
    return next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}
