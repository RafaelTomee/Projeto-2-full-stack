# Projeto 2 — Aplicação Full Stack de Controle Financeiro

Disciplina: Programação Web Full Stack — Engenharia de Software (UTFPR)

Aplicação de controle financeiro pessoal: o usuário se cadastra, faz login e registra entradas e saídas, organizadas por categoria e por fonte/destino. A partir desses dados, a aplicação gera relatórios por categoria, por fonte/destino e a previsão das faturas dos cartões de crédito.

## Integrantes

| Integrante | GitHub | Área principal |
|---|---|---|
| Rafael Tomé | [@RafaelTomee](https://github.com/RafaelTomee) | A: autenticação, banco, segurança e documentação |
| Silvio Henrique | [@silvioGPS](https://github.com/silvioGPS) | B: categorias, fontes/destinos e lançamentos |
| Julio Cezar | [@JuliooCezar](https://github.com/JuliooCezar) | C: relatórios, faturas e dashboard |

O quadro de tarefas está na aba **Projects** do repositório; cada tarefa é uma issue.

## Decisões técnicas

### Banco de dados

**PostgreSQL.** Escolhido porque o modelo é relacional (usuários, categorias, fontes/destinos e lançamentos com chaves estrangeiras), porque dá para garantir unicidade (`UNIQUE`), `CHECK` e transações no próprio banco, e porque as agregações dos relatórios (`GROUP BY`, `SUM`) são feitas direto em SQL.

### Bibliotecas

Lista para conhecimento e aprovação do professor.

**Back-end**

| Biblioteca | Uso |
|---|---|
| express | Servidor HTTP e rotas |
| cors | Libera apenas a origem do front-end |
| dotenv | Variáveis de ambiente (`.env`) |
| pg | Driver do PostgreSQL e pool de conexões |
| bcrypt | Hash e salt das senhas |
| jsonwebtoken | Geração e validação do JWT |
| express-rate-limit | Limite de tentativas na rota de login |

**Front-end** (propostas, a confirmar quando o front for criado)

| Biblioteca | Uso |
|---|---|
| react + vite | SPA |
| react-router-dom | Roteamento e rotas protegidas |
| axios | Cliente HTTP único, com tratamento de 401 |
| recharts | Gráficos dos relatórios |

### Outras decisões

- Back-end em ES Modules (`"type": "module"`).
- Valores monetários em `NUMERIC(12,2)` no banco, nunca `float`.
- E-mail gravado em minúsculas e CPF apenas com dígitos, para a unicidade funcionar de verdade.
- Controladores ficam dentro dos arquivos de `routes/`; o acesso ao banco fica somente em `models/`.
- _(A completar)_ Cálculo das faturas: decisão entre calcular na leitura ou gravar a data de vencimento em cada parcela.
- _(A completar)_ Local das funções utilitárias puras (`cpfValido`, `calcularFatura`).

## Estrutura do projeto

```
.
├── backend/
│   ├── package.json
│   ├── .env.example           modelo das variáveis de ambiente
│   ├── database/
│   │   ├── schema.sql         criação das tabelas
│   │   └── setup.js           cria o banco e aplica o schema (npm run db:create)
│   └── src/
│       ├── server.js          app Express, middlewares e rotas
│       ├── routes/            rotas + controladores
│       ├── models/            acesso ao banco e regras de persistência
│       ├── middlewares/       autenticação JWT, validação, erros
│       └── config/            conexão/pool do banco, configurações
├── frontend/
│   └── src/
│       ├── components/        componentes e páginas
│       ├── contexts/          AuthContext e demais contextos
│       └── services/          cliente HTTP (único ponto de acesso à API)
└── README.md
```

## Como rodar

### Pré-requisitos

- Node.js 20 ou superior
- PostgreSQL instalado e em execução

### 1. Back-end

```bash
cd backend
npm install
cp .env.example .env      # no Windows (PowerShell): Copy-Item .env.example .env
```

Edite o `.env` com os seus dados:

| Variável | Descrição | Exemplo |
|---|---|---|
| `PORT` | Porta da API | `3000` |
| `FRONTEND_URL` | Origem permitida no CORS | `http://localhost:5173` |
| `DATABASE_URL` | Conexão com o PostgreSQL | `postgresql://postgres:senha@localhost:5432/financas` |
| `JWT_SECRET` | Segredo do JWT (string longa e aleatória) | — |
| `JWT_EXPIRES_IN` | Validade do token | `1h` |

Crie o banco e as tabelas (pode ser executado mais de uma vez):

```bash
npm run db:create
```

Suba a API:

```bash
npm run dev               # http://localhost:3000
```

Teste: `GET http://localhost:3000/api/saude` deve responder `{ "status": "ok" }`.

> O arquivo `.env` não vai para o Git. Cada integrante cria o seu.

### 2. Seed (dados de demonstração)

_Em breve:_ `npm run db:seed` (2 usuários e 3 meses de lançamentos).

### 3. Front-end

_Em breve._

## Rotas da API

Todas as rotas abaixo de `/api`, exceto cadastro e login, exigem o cabeçalho `Authorization: Bearer <token>`. Status: planejadas (as rotas ainda estão em desenvolvimento).

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/cadastro` | Cadastra usuário |
| POST | `/api/auth/login` | Autentica e devolve o JWT |
| GET | `/api/auth/me` | Dados do usuário logado |
| GET, POST | `/api/categorias` | Lista / cria categorias |
| PUT, DELETE | `/api/categorias/:id` | Edita / exclui categoria |
| GET, POST | `/api/fontes-destinos` | Lista / cria fontes e destinos |
| PUT, DELETE | `/api/fontes-destinos/:id` | Edita / exclui fonte/destino |
| GET, POST | `/api/lancamentos` | Lista com filtros e paginação / cria (com parcelas) |
| GET, PUT, DELETE | `/api/lancamentos/:id` | Detalha / edita / exclui (`?todasParcelas=true`) |
| GET | `/api/relatorios/categorias` | Relatório por categoria |
| GET | `/api/relatorios/fontes-destinos` | Relatório por fonte/destino |
| GET | `/api/relatorios/faturas` | Previsão de faturas dos cartões |
| GET | `/api/saude-financeira` | Desafio (opcional) |

Padrão de resposta de erro, igual em todas as rotas:

```json
{
  "erro": "Dados inválidos.",
  "campos": { "valor": "O valor deve ser maior que zero." }
}
```

## Fluxo de trabalho do grupo

1. Cada tarefa é uma issue no quadro (Projects).
2. Uma branch por tarefa, a partir da `main`: `feat/nome-curto`, `fix/nome-curto` ou `docs/nome-curto`.
3. Commits pequenos e frequentes, com mensagens no padrão `tipo: descrição` (`feat`, `fix`, `docs`, `chore`).
4. Pull Request para a `main` com `Closes #N` na descrição; outro integrante revisa antes do merge.
5. Sem commit direto na `main` depois do setup inicial.

## Checklist de entrega

- [ ] Banco, bibliotecas e decisões comunicados ao professor
- [ ] README completo (seed, front-end e decisões finais)
- [ ] `.env` fora do repositório e `.env.example` versionado
- [ ] Commits de todos os integrantes
- [ ] Ensaio da apresentação (10 minutos)
