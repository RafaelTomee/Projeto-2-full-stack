import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { testarConexao } from './config/db.js';
import { exigirSegredoJwt } from './config/jwt.js';
import authRoutes from './routes/auth.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Rota de teste (pode ser removida depois)
app.get('/api/saude', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

// TODO: registrar as demais rotas (categorias, fontes-destinos, lancamentos, relatorios)
// TODO: middleware de erros centralizado

try {
  exigirSegredoJwt();
} catch (erro) {
  console.error(erro.message);
  process.exit(1);
}

try {
  await testarConexao();
  console.log('Conectado ao banco de dados.');
} catch (erro) {
  console.error('Falha ao conectar no banco:', erro.message);
  console.error('Confira o DATABASE_URL no .env e rode "npm run db:create".');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
