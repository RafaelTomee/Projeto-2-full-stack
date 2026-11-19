import 'dotenv/config';
import jwt from 'jsonwebtoken';

const ALGORITMO = 'HS256';
const SEGREDO_EXEMPLO = 'troque-por-um-segredo-longo-e-aleatorio';

// Chamada na subida do servidor: sem segredo, o servidor nem inicia.
export function exigirSegredoJwt() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não está definido no .env.');
  }
  if (process.env.JWT_SECRET === SEGREDO_EXEMPLO) {
    console.warn('Aviso: JWT_SECRET ainda está com o valor de exemplo. Troque por um segredo próprio.');
  }
}

function segredo() {
  const valor = process.env.JWT_SECRET;
  if (!valor) throw new Error('JWT_SECRET não está definido no .env.');
  return valor;
}

// Gera o token do usuário. O id vai no campo padrão "sub" do JWT.
// Validade vem de JWT_EXPIRES_IN (padrão: 1h).
export function gerarToken(usuarioId) {
  return jwt.sign({}, segredo(), {
    algorithm: ALGORITMO,
    subject: String(usuarioId),
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
}

// Devolve o id do usuário (número) ou lança erro se o token for inválido,
// adulterado ou estiver expirado. Aceita só o algoritmo esperado (HS256).
export function verificarToken(token) {
  const payload = jwt.verify(token, segredo(), { algorithms: [ALGORITMO] });
  const id = Number(payload.sub);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Token sem usuário válido.');
  }
  return id;
}
