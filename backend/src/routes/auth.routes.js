import { Router } from 'express';
import bcrypt from 'bcrypt';
import { comTransacao } from '../config/db.js';
import { validarCadastro } from '../middlewares/validarCadastro.js';
import { Usuario } from '../models/Usuario.js';
import { Categoria } from '../models/Categoria.js';
import { FonteDestino } from '../models/FonteDestino.js';

const router = Router();

const CODIGO_UNIQUE_VIOLATION = '23505'; // PostgreSQL (MySQL: ER_DUP_ENTRY, MongoDB: 11000)

// POST /api/auth/cadastro
router.post('/cadastro', validarCadastro, async (req, res, next) => {
  // req.body já foi validado e normalizado pelo middleware.
  const { nome, email, cpf, senha } = req.body;

  try {
    // O hash é feito antes da transação, para não segurar uma conexão do pool
    // enquanto o bcrypt trabalha.
    const senhaHash = await bcrypt.hash(senha, 10);

    // Usuário + categorias e fontes/destinos padrão: tudo ou nada.
    const usuario = await comTransacao(async (client) => {
      const novo = await Usuario.criar({ nome, email, cpf, senhaHash }, client);
      await Categoria.criarPadrao(novo.id, client);
      await FonteDestino.criarPadrao(novo.id, client);
      return novo;
    });

    return res.status(201).json({ id: usuario.id, nome: usuario.nome, email: usuario.email });
  } catch (erro) {
    // A garantia de unicidade vem do banco (UNIQUE), não de uma consulta prévia.
    if (erro.code === CODIGO_UNIQUE_VIOLATION) {
      const restricao = erro.constraint ?? '';
      const campo = restricao.includes('cpf') ? 'cpf' : restricao.includes('email') ? 'email' : null;
      if (campo) {
        return res.status(409).json({
          erro: 'Usuário já cadastrado.',
          campos: { [campo]: `Já existe um usuário com este ${campo === 'cpf' ? 'CPF' : 'e-mail'}.` },
        });
      }
    }
    return next(erro); // demais erros: middleware de erro (500)
  }
});

export default router;
