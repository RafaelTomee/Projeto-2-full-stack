# Projeto 2 — Aplicação Full Stack de Controle Financeiro

**Disciplina:** Programação Web Full Stack — Engenharia de Software (UTFPR)

Aplicação de controle financeiro pessoal. O usuário pode criar uma conta, entrar no sistema, cadastrar categorias e fontes/destinos, registrar receitas e despesas, parcelar compras em cartões e acompanhar relatórios e previsões de faturas.

## Integrantes

| Integrante | GitHub | Área principal |
|---|---|---|
| Rafael Tomé | [@RafaelTomee](https://github.com/RafaelTomee) | Autenticação, banco, segurança, erros e documentação |
| Silvio Henrique | [@silvioGPS](https://github.com/silvioGPS) | Categorias, fontes/destinos e lançamentos |
| Julio Cezar | [@JuliooCezar](https://github.com/JuliooCezar) | Dashboard, relatórios, faturas e saúde financeira |

As tarefas e seus checklists ficam nas [issues do repositório](https://github.com/RafaelTomee/Projeto-2-full-stack/issues). O quadro de acompanhamento fica na aba **Projects**.

## Funcionalidades

| Funcionalidade | O que está disponível |
|---|---|
| Autenticação | Cadastro, login, consulta do usuário autenticado e rotas protegidas |
| Categorias e fontes/destinos | Cadastro, consulta, edição e exclusão |
| Lançamentos | Entradas e saídas, filtros, paginação, totais e compras parceladas no cartão |
| Dashboard | Entradas, saídas e saldo do mês, gráfico de saídas por categoria, últimos lançamentos e link para faturas. A próxima fatura com valor a vencer vem da API de previsão |
| Relatório por fonte/destino | Filtro de datas, entradas, saídas e saldo. A tela consome os totais agregados pela API de relatórios |
| Relatório por categoria | Filtro de datas, totais, percentuais, comparação com período anterior e gráfico de barras em HTML. A tela consome a API de relatórios |
| Faturas | Tela por cartão com datas, parcelas, totais e limite estimado. A tela exibe os dados da API de previsão |
| Saúde financeira | API e tela implementadas nas branches `feat/api-saude-financeira` e `feat/saude-financeira`, fora da `dev` na versão conferida |
| Dados de demonstração | `npm run db:seed` cria 2 usuários (Ana e Bruno) com 3 meses de lançamentos, compras parceladas e casos de fechamento de fatura |

## Tecnologias

| Camada | Tecnologia | Para quê |
|---|---|---|
| Front-end | React 19, Vite, React Router, Axios | SPA com rotas protegidas e cliente HTTP único (`services/api.js`) |
| Back-end | Node.js 22 (ES Modules), Express 5 | API REST |
| Banco | PostgreSQL (`pg`, SQL puro, sem ORM) | UNIQUE, CHECK e chaves estrangeiras garantem a integridade |
| Segurança | `bcrypt`, `jsonwebtoken`, `express-rate-limit`, `cors` | Hash de senha, JWT, limite de tentativas de login, CORS por origem |
| Testes | `node --test` (back e front), newman/Postman | Unidade, integração e isolamento (RF3) |

## Decisões de projeto

- **Front-end:** React, Vite, React Router e Axios. As telas usam o cliente HTTP compartilhado em `frontend/src/services/api.js`.
- **Back-end:** Node.js com ES Modules, Express, `pg`, `dotenv`, `cors`, `bcrypt`, `jsonwebtoken` e `express-rate-limit`.
- **Banco:** PostgreSQL. Chaves estrangeiras, restrições e índices garantem a integridade dos dados. Os relatórios da API agregam valores com `SUM` e `GROUP BY`.
- **Dinheiro:** o banco armazena valores em `NUMERIC(12,2)`. A divisão de compras parceladas trabalha em centavos.
- **Cadastro:** e-mail normalizado em minúsculas, CPF armazenado só com dígitos e senha com hash bcrypt. O usuário e seus cadastros padrão são inseridos na mesma transação.
- **Sessão:** JWT HS256 com validade padrão de uma hora. O login tem limite de dez tentativas com falha por IP a cada quinze minutos. O front encerra a sessão quando o token expira ou a API responde `401` a uma requisição autenticada.
- **Acesso aos dados:** as rotas protegidas usam `req.usuarioId` para consultar os dados do usuário autenticado.
- **Gráficos:** as barras atuais usam elementos HTML. A adoção de uma biblioteca depende da definição do grupo e da aprovação do professor.

## Estrutura do projeto

```text
.
├── backend/
│   ├── database/
│   │   ├── schema.sql        # DDL: usuarios, categorias, fontes_destinos, lancamentos
│   │   ├── setup.js          # npm run db:create (cria o banco e aplica o schema)
│   │   └── seed.js           # npm run db:seed (dados de demonstração)
│   ├── scripts/
│   │   └── auditar-rotas.mjs # npm run audit:rotas (auditoria de isolamento, RF3)
│   ├── src/
│   │   ├── config/           # db, jwt, cors e faturas.js (calcularFatura, função pura)
│   │   ├── middlewares/      # autenticar, erros, limitarLogin, validarCadastro
│   │   ├── models/           # SQL parametrizado, um arquivo por entidade/relatório
│   │   ├── routes/           # auth, categorias, fontes-destinos, lancamentos, relatórios
│   │   ├── utils/            # parcelas.js (divisão em centavos, função pura)
│   │   └── server.js
│   └── test/                 # node --test
├── frontend/
│   ├── src/
│   │   ├── components/       # telas e componentes (ui/ = componentes compartilhados)
│   │   ├── contexts/         # AuthContext (sessão)
│   │   ├── services/         # api.js (axios), token, validações de formulário
│   │   ├── utils/            # funções puras: formatação, formulários, lançamentos
│   │   ├── App.jsx           # rotas
│   │   └── main.jsx
│   └── test/
├── postman/                  # coleção de isolamento (RF3) + ambiente
├── docs/                     # seed, padrão de erros, isolamento, apresentação, checklist
└── README.md
```

### Onde ficam os utilitários puros

Funções sem acesso a banco, rede ou relógio ficam separadas, para serem testadas sozinhas:

| Função | Arquivo | Teste |
|---|---|---|
| `calcularFatura(data, cartao, parcela)` | `backend/src/config/faturas.js` | `backend/test/calcularFatura.test.js` |
| Divisão do valor em parcelas (centavos) | `backend/src/utils/parcelas.js` | `backend/test/parcelamento.test.js` |
| Validações de cadastro e de lançamento | `backend/src/models/validacoes.js`, `backend/src/middlewares/validarCadastro.js` | `validacoes.test.js`, `validarCadastro.test.js` |
| Formatação, formulários e lançamentos no front | `frontend/src/utils/*.js`, `frontend/src/services/validacoes.js` | `frontend/test/*.test.js` |

## Como rodar (do zero)

**Pré-requisitos:** Node.js 22.12 ou superior, npm e PostgreSQL em execução (um usuário com permissão para criar bancos).

Resumo (cada passo é detalhado abaixo):

1. `git clone` do repositório e `git checkout dev` (ou `main`, após a integração final).
2. **Back-end:** `cd backend` → `npm install` → copiar `.env.example` para `.env` e preencher → `npm run db:create` → `npm run db:seed` (opcional) → `npm run dev`.
3. **Front-end** (outro terminal): `cd frontend` → `npm install` → `npm run dev`.
4. Abrir `http://localhost:5173` e entrar com `ana@demo.com` / `Senha123` (se rodou o seed) ou cadastrar um usuário.

### Back-end

Na raiz do projeto:

```bash
cd backend
npm install
cp .env.example .env
```

No PowerShell, use `Copy-Item .env.example .env` no lugar de `cp`.

Configure o arquivo `.env`:

| Variável | Uso | Exemplo |
|---|---|---|
| `PORT` | Porta da API | `3000` |
| `FRONTEND_URL` | Origem permitida para o front-end | `http://localhost:5173` |
| `DATABASE_URL` | Conexão com o PostgreSQL | `postgresql://postgres:senha@localhost:5432/financas` |
| `JWT_SECRET` | Segredo usado para assinar tokens | Gere um valor longo e aleatório |
| `JWT_EXPIRES_IN` | Validade do token | `1h` |

Com as credenciais do PostgreSQL configuradas, crie o banco, aplique o schema e inicie a API:

```bash
npm run db:create
npm run dev
```

Para verificar se o servidor subiu, abra `http://localhost:3000/api/saude`. A resposta esperada é `{"status":"ok"}`.

O `.env` contém configurações locais e deve ficar fora do Git (só o `.env.example` é versionado).

### Dados de demonstração (seed)

```bash
npm run db:seed
```

Cria dois usuários de demonstração com 3 meses de lançamentos cada. Pode ser executado várias vezes: o seed apaga e recria só esses dois usuários. Detalhes em [`docs/seed.md`](docs/seed.md).

| Usuário | E-mail | Senha |
|---|---|---|
| Ana Souza | `ana@demo.com` | `Senha123` |
| Bruno Lima | `bruno@demo.com` | `Senha123` |

### Front-end

Em outro terminal, a partir da raiz do projeto:

```bash
cd frontend
npm install
npm run dev
```

Abra `http://localhost:5173`. Cadastre um usuário em `/cadastro` e faça login. Se a API estiver em outro endereço, configure `VITE_API_URL` no front-end. O padrão é `http://localhost:3000/api`.

## Rotas da API

Envie `Authorization: Bearer <token>` nas rotas protegidas. O teste de disponibilidade, o cadastro e o login são públicos.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/saude` | Disponibilidade da API |
| POST | `/api/auth/cadastro` | Cadastro de usuário |
| POST | `/api/auth/login` | Login e emissão do JWT |
| GET | `/api/auth/me` | Usuário autenticado |
| GET, POST | `/api/categorias` | Listagem e criação de categorias |
| GET, PUT, DELETE | `/api/categorias/:id` | Detalhe, edição e exclusão de categoria (exclusão bloqueada se houver lançamentos: 409) |
| GET, POST | `/api/fontes-destinos` | Listagem e criação de fontes/destinos |
| GET, PUT, DELETE | `/api/fontes-destinos/:id` | Detalhe, edição e exclusão de fonte/destino |
| GET, POST | `/api/lancamentos` | Listagem paginada ou criação de lançamento |
| GET, PUT, DELETE | `/api/lancamentos/:id` | Detalhe, edição ou exclusão de lançamento |
| GET | `/api/relatorios/categorias?inicio=AAAA-MM-DD&fim=AAAA-MM-DD` | Relatório por categoria e comparação com o período anterior |
| GET | `/api/relatorios/fontes-destinos?inicio=AAAA-MM-DD&fim=AAAA-MM-DD` | Relatório por fonte/destino |
| GET | `/api/relatorios/faturas?meses=3` | Fatura atual e previsão dos próximos ciclos por cartão |
| GET | `/api/saude-financeira` | Indicadores, projeção e dicas. Disponível na branch da API de saúde financeira |

### Relatórios

Os relatórios por categoria e por fonte/destino incluem as datas inicial e final. Datas inválidas, ausentes ou em ordem invertida retornam `400`.

- **Por categoria:** a resposta contém `periodo`, `periodoAnterior`, `entradas` e `saidas`. Cada grupo traz `total` e `categorias`. As saídas vêm do maior total para o menor e incluem participação percentual, valor anterior e variação percentual. A variação é `null` quando o valor anterior é zero. O período anterior termina na véspera do início do período selecionado e tem a mesma quantidade de dias.
- **Por fonte/destino:** a resposta contém `inicio`, `fim` e `fontesDestinos`, com entradas e saídas por cadastro. O saldo do período é calculado para o tipo `conta`. Para os demais tipos, `saldo` é `null`.

### Parcelamento e previsão de faturas

- Uma saída parcelada deve estar ligada a um cartão de crédito. `totalParcelas` aceita números inteiros de 2 a 48 para compras parceladas. Cada parcela vale pelo menos R$ 0,01.
- As parcelas de uma compra são criadas na mesma transação e compartilham um identificador de grupo.
- **Modelagem escolhida:** o banco guarda a data da compra e o número da parcela. O fechamento e o vencimento são calculados na leitura, usando os dias configurados no cartão. Isso evita armazenar uma data derivada em cada lançamento.
- No `PUT` de uma parcela, podem ser alteradas a descrição e a categoria. Para mudar valor, data, tipo ou fonte, exclua e recrie o parcelamento.
- `DELETE /api/lancamentos/:id` exclui uma parcela. Use `?todasParcelas=true` para excluir o grupo inteiro.
- `GET /api/relatorios/faturas?meses=3` retorna a fatura atual e as três seguintes por padrão. Cada fatura contém fechamento, vencimento, lançamentos e total. Uma compra parcelada aparece com a indicação da parcela, como `Notebook — 3/10`.
- O limite utilizado soma parcelas com vencimento de hoje em diante, inclusive fora dos meses exibidos. O limite disponível é o limite do cartão menos o valor utilizado, com mínimo de zero. O limite é informativo e não bloqueia lançamentos.
- **Regra da #21:** compra no dia do fechamento entra no próximo ciclo. Se o dia configurado não existir no mês, usa-se o último dia daquele mês. A previsão reutiliza a função `calcularFatura`.

### Como as faturas são calculadas (e por quê)

**Regra.** A fatura de uma compra depende do dia de fechamento do cartão. Compra **antes** do fechamento entra na fatura do mês; compra **no dia do fechamento ou depois** entra na fatura do mês seguinte. O vencimento vem do `diaVencimento`: se for menor ou igual ao fechamento, cai no mês seguinte ao fechamento. Se o dia configurado não existir no mês, usa-se o último dia (fevereiro, meses de 30 dias). Cada parcela `n` avança `n - 1` meses.

Exemplo (fecha dia 25, vence dia 5): compra de 24/11 entra na fatura que fecha em 25/11 e vence em 05/12. Compra de 25/11 entra na que fecha em 25/12 e vence em 05/01.

**Modelagem.** Cada parcela guarda a **data da compra** e o seu número (`parcela_atual` de `total_parcelas`). O fechamento e o vencimento **não são gravados**: `calcularFatura(data, cartao, parcela)` calcula na leitura, a partir do cartão.

Por que assim:
- Uma única fonte de verdade: se o dia de fechamento do cartão for corrigido, as faturas se ajustam sem reescrever lançamentos.
- A mesma função alimenta a previsão de faturas, a saúde financeira e o seed, e é testada isoladamente com os exemplos do enunciado.
- A divisão em centavos é feita uma vez, na criação, e a diferença de arredondamento fica na primeira parcela: R$ 100,00 em 3× vira 33,34 + 33,33 + 33,33.

**Consequência a conhecer.** Como todas as parcelas têm a data da compra, os relatórios por categoria e por fonte/destino, que filtram por `data`, contam a compra **inteira no mês em que foi feita** (visão de competência, igual ao SQL de exemplo do enunciado). Já a previsão de faturas distribui cada parcela no seu mês de vencimento (visão de caixa). As duas telas respondem a perguntas diferentes: "quanto gastei neste período" e "quanto vai vencer em cada fatura".

### Saúde financeira

A rota de saúde financeira exige autenticação e calcula os indicadores a partir dos lançamentos do usuário, usando o horário de Brasília para definir o mês de referência.

- **Taxa de poupança:** saldo do mês dividido pelas receitas, em percentual. Abaixo de 10%, a API sugere revisar as despesas.
- **Comprometimento com cartões:** saídas do cartão no mês da fatura divididas pelas receitas, em percentual. Acima de 30%, a API sugere revisar os gastos no cartão.
- **Parcelas futuras:** soma das parcelas com vencimento nos próximos três meses.
- **Projeção:** parte do saldo líquido do mês atual e acumula os movimentos registrados para os próximos três meses. Se algum saldo projetado ficar negativo, a API sinaliza isso e a tela exibe um alerta.
- **Mês sem receitas:** os dois indicadores percentuais retornam `null`, e a API sugere registrar as entradas.

A tela mostra os indicadores, o gráfico de projeção e as dicas. Os limites de 10% e 30% são critérios educativos do projeto. As informações apresentadas não constituem recomendação financeira profissional.

## Padrão de erros

As rotas retornam mensagens no formato abaixo. O campo `campos` é usado quando há erros de validação associados a campos específicos.

```json
{
  "erro": "Dados inválidos.",
  "campos": {
    "fim": "A data final deve ser igual ou posterior à inicial."
  }
}
```

As rotas protegidas usam o middleware `autenticar`. Novas rotas devem ser registradas em `backend/src/server.js` antes de `rotaNaoEncontrada` e `tratarErros`.

## Testes

```bash
cd backend
npm test            # todos os testes (os de banco precisam do PostgreSQL configurado no .env)
npm run test:rf3    # isolamento entre usuários (cria um banco temporário e apaga depois)
npm run audit:rotas # auditoria estática: autenticação, usuario_id e SQL parametrizado
```

```bash
cd frontend
npm test
npm run lint
npm run build
```

- **Isolamento (RF3):** teste automatizado, auditoria estática e coleção Postman. Explicação e resultados em [`docs/isolamento-rf3.md`](docs/isolamento-rf3.md).
- **Faturas:** `calcularFatura.test.js` cobre os exemplos do enunciado e os meses curtos.
- **Segurança:** nenhuma resposta da API contém `senha_hash` (verificado nos testes de isolamento e na coleção Postman).

## Apresentação e entrega

- Roteiro de 10 minutos, com divisão de falas: [`docs/apresentacao.md`](docs/apresentacao.md).
- Checklist final do grupo (seção 10.14), com como verificar cada item: [`docs/checklist-final.md`](docs/checklist-final.md).

## Fluxo de trabalho do grupo

1. Acompanhar a tarefa pela issue correspondente.
2. Criar uma branch a partir da `dev`, como `feat/nome-da-tarefa`.
3. Usar mensagens de commit como `feat:`, `fix:` ou `docs:`.
4. Abrir um Pull Request para a `dev`, mencionar a issue e pedir revisão a outro integrante.
5. Integrar a `dev` à `main` nos marcos do projeto, por Pull Request.
