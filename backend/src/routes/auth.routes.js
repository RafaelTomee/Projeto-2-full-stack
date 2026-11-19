import { Router } from 'express';
import bcrypt from 'bcrypt';
import { comTransacao } from '../config/db.js';
import { gerarToken } from '../config/jwt.js';
import { autenticar } from '../middlewares/autenticar.js';
import { limitarLogin } from '../middlewares/limitarLogin.js';
import { validarCadastro } from '../middlewares/validarCadastro.js';
import { normalizarEmail, SENHA_MAX } from '../models/validacoes.js';
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

const MSG_CREDENCIAIS = 'E-mail ou senha inválidos.'; // genérica: não revela se o e-mail existe

// Hash descartável: quando o e-mail não existe, comparamos mesmo assim para o
// tempo de resposta ser parecido e não denunciar quais e-mails estão cadastrados.
const HASH_FALSO = bcrypt.hashSync('hash-para-igualar-o-tempo-de-resposta', 10);

// POST /api/auth/login
router.post('/login', limitarLogin, async (req, res, next) => {
  const { email, senha } = req.body ?? {};

  const campos = {};
  if (typeof email !== 'string' || !email.trim()) campos.email = 'O e-mail é obrigatório.';
  if (typeof senha !== 'string' || !senha) campos.senha = 'A senha é obrigatória.';
  if (Object.keys(campos).length > 0) {
    return res.status(400).json({ erro: 'Dados inválidos.', campos });
  }

  try {
    const usuario = await Usuario.buscarPorEmail(normalizarEmail(email));
    const senhaConfere =
      senha.length <= SENHA_MAX && (await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FALSO));

    if (!usuario || !senhaConfere) {
      return res.status(401).json({ erro: MSG_CREDENCIAIS });
    }

    return res.json({
      token: gerarToken(usuario.id),
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
    });
  } catch (erro) {
    return next(erro);
  }
});

// GET /api/auth/me — dados do usuário logado
router.get('/me', autenticar, async (req, res, next) => {
  try {
    const usuario = await Usuario.buscarPorId(req.usuarioId);
    if (!usuario) {
      // Token válido, mas o usuário não existe mais.
      return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
    return res.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      criadoEm: usuario.criado_em,
    });
  } catch (erro) {
    return next(erro);
  }
});

export default router;
