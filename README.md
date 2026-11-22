# Projeto 2 — Aplicação Full Stack de Controle Financeiro

Disciplina: Programação Web Full Stack — Engenharia de Software (UTFPR)

Aplicação de controle financeiro pessoal: o usuário se cadastra, faz login e registra entradas e saídas, organizadas por categoria e por fonte/destino. A partir desses dados, a aplicação gera relatórios por categoria, por fonte/destino e a previsão das faturas dos cartões de crédito.

## Integrantes

| Integrante | GitHub | Área principal |
|---|---|---|
| Rafael Tomé | [@RafaelTomee](https://github.com/RafaelTomee) | A: autenticação, banco, segurança, erros e documentação |
| Silvio Henrique | [@silvioGPS](https://github.com/silvioGPS) | B: categorias, fontes/destinos e lançamentos |
| Julio Cezar | [@JuliooCezar](https://github.com/JuliooCezar) | C: relatórios, faturas e dashboard |

O quadro de tarefas está na aba **Projects** do repositório; cada tarefa é uma issue.

## Status

- [x] Estrutura do repositório e banco de dados (PostgreSQL)
- [x] Validações de cadastro (CPF, e-mail, senha)
- [x] Cadastro, login (JWT), `/me` e rate limit no login
- [x] Middleware de erros centralizado e CORS restrito
- [x] Front: Vite, rotas protegidas, cliente HTTP único e AuthContext
- [ ] CRUD de categorias, fontes/destinos e lançamentos (com parcelamento)
- [ ] Relatórios por categoria e por fonte/destino
- [ ] Previsão de faturas dos cartões
- [ ] Seed de demonstração
- [ ] Desafio: saúde financeira (opcional)

## Decisões técnicas

### Banco de dados

**PostgreSQL.** Escolhido porque o modelo é relacional (usuários, categorias, fontes/destinos e lançamentos com chaves estrangeiras), porque dá para garantir unicidade (`UNIQUE`), `CHECK` e transações no próprio banco, e porque as agregações dos relatórios (`GROUP BY`, `SUM`) são feitas direto em SQL.

### Bibliotecas

Lista para conhecimento e aprovação do professor.

**Back-end**

| Biblioteca | Uso |
|---|---|
| express (v5) | Servidor HTTP e rotas |
| cors | Libera apenas a origem do front-end |
| dotenv | Variáveis de ambiente (`.env`) |
| pg | Driver do PostgreSQL e pool de conexões |
| bcrypt | Hash e salt das senhas |
| jsonwebtoken | Geração e validação do JWT |
| express-rate-limit | Limite de tentativas na rota de login |

**Front-end**

| Biblioteca | Uso |
|---|---|
| react + vite | SPA |
| react-router-dom | Roteamento e rotas protegidas |
| axios | Cliente HTTP único, com tratamento de 401 |
| recharts _(proposta)_ | Gráficos dos relatórios, a instalar após aprovação |

Os testes usam o runner nativo do Node (`node:test`), sem biblioteca extra, e o lint do front usa o `oxlint` que acompanha o template do Vite.

### Outras decisões

- Back-end em ES Modules (`"type": "module"`).
- Valores monetários em `NUMERIC(12,2)` no banco, nunca `float`.
- E-mail gravado em minúsculas (`trim().toLowerCase()`) e CPF apenas com dígitos, para a unicidade funcionar de verdade.
- Unicidade de e-mail e CPF garantida pelo banco (`UNIQUE`); o servidor traduz a violação (código `23505`) em resposta 409 com a mensagem no campo correto.
- Cadastro em transação: usuário, categorias padrão e fontes/destinos padrão são gravados juntos, ou nenhum.
- Senha com hash bcrypt (custo 10), limitada a 72 caracteres (o bcrypt ignora o que passa disso).
- JWT assinado com HS256, validade de 1 hora (`JWT_EXPIRES_IN`), id do usuário no campo `sub`. O servidor não sobe sem `JWT_SECRET`.
- Login com mensagem genérica ("E-mail ou senha inválidos") e comparação de hash mesmo quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails estão cadastrados.
- Rate limit no login: 10 tentativas com falha por IP a cada 15 minutos (logins bem-sucedidos não contam).
- Controladores ficam dentro dos arquivos de `routes/`; o acesso ao banco fica somente em `models/`.
- Funções utilitárias puras ficam em `backend/src/models/` (ex.: `validacoes.js`).
- Front: o token fica no `localStorage`; ao expirar (ou ao receber 401), o app volta ao login automaticamente.
- _(A completar)_ Cálculo das faturas: calcular na leitura ou gravar a data de vencimento em cada parcela (e justificativa).

## Estrutura do projeto

```
.
├── backend/
│   ├── package.json
│   ├── .env.example           modelo das variáveis de ambiente
│   ├── database/
│   │   ├── schema.sql         criação das tabelas
│   │   └── setup.js           cria o banco e aplica o schema (npm run db:create)
│   ├── src/
│   │   ├── server.js          app Express, middlewares e rotas
│   │   ├── routes/            rotas + controladores (auth.routes.js...)
│   │   ├── models/            acesso ao banco, regras de persistência e utilitários puros
│   │   ├── middlewares/       autenticar, validarCadastro, limitarLogin, erros
│   │   └── config/            db.js (pool), jwt.js, cors.js
│   └── test/                  testes (node:test)
├── frontend/
│   ├── package.json
│   ├── .env.example           VITE_API_URL (opcional)
│   ├── README.md              guia do front (como chamar a API, criar telas)
│   ├── src/
│   │   ├── main.jsx, App.jsx  providers e rotas
│   │   ├── components/        telas e componentes
│   │   ├── contexts/          AuthContext
│   │   └── services/          api.js (único acesso à API), authStorage.js, token.js
│   └── test/                  testes dos serviços
├── docs/
│   └── padrao-de-erros.md     padrão de resposta de erro da API
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
| `FRONTEND_URL` | Origem(ns) permitida(s) no CORS, separadas por vírgula | `http://localhost:5173` |
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

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

A API precisa estar no ar. Cadastre um usuário em `/cadastro` e faça login. Detalhes e exemplos em [`frontend/README.md`](frontend/README.md).

### Testes e verificações

```bash
cd backend && npm test    # testes de integração precisam do banco configurado; sem ele, são ignorados
cd frontend && npm test   # testes dos serviços (api.js, token, sessão)
cd frontend && npm run lint && npm run build
```

## Rotas da API

Todas as rotas abaixo de `/api`, exceto cadastro e login, exigem o cabeçalho `Authorization: Bearer <token>`.

| Método | Rota | Descrição | Status |
|---|---|---|---|
| POST | `/api/auth/cadastro` | Cadastra usuário | Pronta |
| POST | `/api/auth/login` | Autentica e devolve o JWT | Pronta |
| GET | `/api/auth/me` | Dados do usuário logado | Pronta |
| GET, POST | `/api/categorias` | Lista / cria categorias | Planejada |
| PUT, DELETE | `/api/categorias/:id` | Edita / exclui categoria | Planejada |
| GET, POST | `/api/fontes-destinos` | Lista / cria fontes e destinos | Planejada |
| PUT, DELETE | `/api/fontes-destinos/:id` | Edita / exclui fonte/destino | Planejada |
| GET, POST | `/api/lancamentos` | Lista com filtros e paginação / cria (com parcelas) | Planejada |
| GET, PUT, DELETE | `/api/lancamentos/:id` | Detalha / edita / exclui (`?todasParcelas=true`) | Planejada |
| GET | `/api/relatorios/categorias` | Relatório por categoria | Planejada |
| GET | `/api/relatorios/fontes-destinos` | Relatório por fonte/destino | Planejada |
| GET | `/api/relatorios/faturas` | Previsão de faturas dos cartões | Planejada |
| GET | `/api/saude-financeira` | Desafio (opcional) | Planejada |

### Parcelamento em cartão

- `POST /api/lancamentos` com `totalParcelas` entre 2 e 48 cria as parcelas em uma transação (se uma falha, nenhuma é gravada). `totalParcelas` deve ser número inteiro; parcelamento só para `saida` em cartão de crédito e cada parcela deve valer pelo menos R$ 0,01.
- Cada parcela guarda a **data da compra** (igual ao seed). A data da fatura é calculada pelos dias de fechamento/vencimento do cartão; a modelagem (manter data da compra ou gravar data da fatura) ainda será decidida com o time C.
- `PUT` numa parcela altera só `descricao` e `categoriaId`. Mudar valor, data, tipo ou fonte responde **409**: exclua e recrie o parcelamento.
- `DELETE /api/lancamentos/:id?todasParcelas=true` exclui o grupo inteiro. Sem esse parâmetro (ou com qualquer outro valor) exclui apenas a parcela; o valor precisa ser exatamente `true`.
- `limite` do cartão é informativo: a API não bloqueia compras acima dele (o enunciado não exige esse controle).
- Por compatibilidade com o contrato atual, `POST` devolve a primeira parcela; devolver `{ parcelas: [...] }` depende de alinhamento com o front e com o C.

## Padrão de erros da API

Toda resposta de erro segue o mesmo formato, e o front-end trata todas do mesmo jeito:

```json
{
  "erro": "Dados inválidos.",
  "campos": { "valor": "O valor deve ser maior que zero." }
}
```

`campos` é opcional e só aparece em erros de formulário. Status usados: 400, 401, 404, 409, 413, 429 e 500 (genérico, sem vazar detalhes). Tabela completa e como lançar erros nas rotas: [`docs/padrao-de-erros.md`](docs/padrao-de-erros.md).

## Como proteger uma rota (para quem cria rotas)

```js
import { autenticar } from '../middlewares/autenticar.js';
import { erroValidacao, naoEncontrado } from '../middlewares/erros.js';

router.get('/categorias', autenticar, async (req, res) => {
  // req.usuarioId é o id do usuário logado (número). Use SEMPRE ele no WHERE:
  //   SELECT ... FROM categorias WHERE usuario_id = $1
  // Nunca pegue o id do usuário do corpo da requisição ou da URL.
});
```

Registre a rota em `backend/src/server.js`, acima de `rotaNaoEncontrada` e `tratarErros`, que precisam ser as últimas.

## Fluxo de trabalho do grupo

1. Cada tarefa é uma issue no quadro (Projects).
2. Uma branch por tarefa, a partir da `dev`: `feat/nome-curto`, `fix/nome-curto` ou `docs/nome-curto`.
3. Commits pequenos e frequentes, com mensagens no padrão `tipo: descrição` (`feat`, `fix`, `docs`, `chore`).
4. Pull Request para a `dev` com `Closes #N` na descrição; outro integrante revisa antes do merge.
5. A `dev` é integrada à `main` nos marcos do projeto, por Pull Request.
6. Sem commit direto na `main` ou na `dev`.

## Saúde financeira

A rota `GET /api/saude-financeira` exige autenticação. O back-end calcula os indicadores com os lançamentos do usuário autenticado e usa o horário de Brasília para determinar o mês de referência.

- **Taxa de poupança:** diferença entre receitas e despesas do mês, dividida pelas receitas e expressa em percentual. Abaixo de 10%, a API sugere revisar as despesas.
- **Comprometimento com cartões:** despesas registradas no cartão no mês, divididas pelas receitas e expressas em percentual. Acima de 30%, a API sugere revisar os gastos no cartão.
- **Parcelas futuras:** soma das saídas parceladas registradas para os próximos três meses.
- **Projeção de saldo:** parte do saldo líquido do mês atual e acumula as entradas e saídas já registradas para cada um dos próximos três meses. Se algum saldo projetado ficar abaixo de zero, a API retorna `temSaldoNegativo: true` e sugere conferir as entradas e contas desses meses.
- **Mês sem receitas:** a API retorna `null` nos dois indicadores percentuais e sugere registrar as entradas.

Os limites de 10% e 30% são critérios educativos do projeto. As informações não constituem recomendação financeira profissional.
