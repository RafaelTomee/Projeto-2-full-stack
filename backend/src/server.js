import 'dotenv/config';
import express from 'express';
import { criarCors } from './config/cors.js';
import { testarConexao } from './config/db.js';
import { exigirSegredoJwt } from './config/jwt.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';
import authRoutes from './routes/auth.routes.js';
import categoriasRoutes from './routes/categorias.routes.js';
import fontesDestinosRoutes from './routes/fontesDestinos.routes.js';
import lancamentosRoutes from './routes/lancamentos.routes.js';
import saudeFinanceiraRoutes from './routes/saudeFinanceira.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(criarCors());
app.use(express.json());

app.get('/api/saude', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/fontes-destinos', fontesDestinosRoutes);
app.use('/api/lancamentos', lancamentosRoutes);
// app.use('/api/relatorios', relatoriosRoutes); // Pessoa C
app.use('/api/saude-financeira', saudeFinanceiraRoutes);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

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
