import 'dotenv/config';
import cors from 'cors';

// Origens permitidas: FRONTEND_URL do .env. Aceita mais de uma, separadas por vírgula:
//   FRONTEND_URL=http://localhost:5173,http://127.0.0.1:5173
export function origensPermitidas() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

// CORS restrito ao front-end. Requisições sem cabeçalho Origin (Postman, curl,
// testes) passam normalmente: o CORS só existe para proteger navegadores.
export function criarCors() {
  const permitidas = origensPermitidas();
  return cors({
    origin: (origem, callback) => callback(null, !origem || permitidas.includes(origem)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600, // o navegador pode guardar a resposta do preflight por 10 min
  });
}
