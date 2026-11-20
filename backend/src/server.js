import 'dotenv/config';
import express from 'express';
import { criarCors } from './config/cors.js';
import { testarConexao } from './config/db.js';
import { exigirSegredoJwt } from './config/jwt.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';
import authRoutes from './routes/auth.routes.js';
import categoriasRoutes from './routes/categorias.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(criarCors());
app.use(express.json());

// Rota de teste (pode ser removida depois)
app.get('/api/saude', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
// Cada pessoa descomenta/cria a sua linha aqui (uma por linha, para evitar conflito no Git):
app.use('/api/categorias', categoriasRoutes);
// app.use('/api/fontes-destinos', fontesDestinosRoutes);     // Pessoa B
// app.use('/api/lancamentos', lancamentosRoutes);            // Pessoa B
// app.use('/api/relatorios', relatoriosRoutes);              // Pessoa C
// app.use('/api/saude-financeira', saudeFinanceiraRoutes);   // Pessoa C (desafio)

// ATENÇÃO: registre novas rotas ACIMA destas duas linhas. Elas precisam ser as últimas.
app.use(rotaNaoEncontrada);
app.use(tratarErros);

try {
  exigirSegredoJwt();
} catch (erro) {
  console.error(erro.message);
  process.exit(1);
}

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
