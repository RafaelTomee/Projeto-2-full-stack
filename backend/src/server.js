import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Rota de teste (pode ser removida depois)
app.get('/api/saude', (req, res) => {
  res.json({ status: 'ok' });
});

// TODO: registrar as rotas (auth, categorias, fontes-destinos, lancamentos, relatorios)
// TODO: middleware de erros centralizado

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
