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
| Dashboard | Entradas, saídas e saldo do mês, gráfico de saídas por categoria, últimos lançamentos e link para faturas. A identificação da próxima fatura a vencer ainda está pendente |
| Relatório por fonte/destino | Filtro de datas, entradas, saídas e saldo. A API agrega os dados no PostgreSQL; a tela ainda consulta as rotas de lançamentos e fontes/destinos |
| Relatório por categoria | Filtro de datas, totais, percentuais, comparação com período anterior e gráfico de barras em HTML. A tela ainda consulta as rotas de lançamentos e categorias |
| Faturas | Tela por cartão com datas, parcelas, totais e limite estimado. A API de previsão também está disponível; a tela ainda calcula as faturas com os lançamentos |
| Saúde financeira | API e tela implementadas nas branches `feat/api-saude-financeira` e `feat/saude-financeira`, fora da `dev` na versão conferida |
| Dados de demonstração | Seed pendente na `dev` |

## Tecnologias e decisões

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
│   │   ├── schema.sql
│   │   └── setup.js
│   ├── src/
│   │   ├── config/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── server.js
│   └── test/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── test/
└── README.md
```

## Como rodar

Instale o Node.js e deixe o PostgreSQL em execução. Use uma versão do Node compatível com o Vite do projeto, como Node 22.12 ou superior na linha 22.

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

O `.env` contém configurações locais e deve ficar fora do Git. Enquanto o seed estiver pendente, cadastre um usuário e crie lançamentos pela interface para demonstrar o sistema.

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
| PUT, DELETE | `/api/categorias/:id` | Edição e exclusão de categoria |
| GET, POST | `/api/fontes-destinos` | Listagem e criação de fontes/destinos |
| PUT, DELETE | `/api/fontes-destinos/:id` | Edição e exclusão de fonte/destino |
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
- **Regra da #21:** compra no dia do fechamento entra no próximo ciclo. Se o dia configurado não existir no mês, usa-se o último dia daquele mês. A previsão da `dev` ainda usa um cálculo próprio e precisa ser ligada à função da #21 para aplicar a mesma regra no dia do corte.

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

No back-end:

```bash
cd backend
npm test
```

Os testes de integração que dependem de PostgreSQL precisam de um banco configurado. A função `calcularFatura` deve ser testada separadamente com os quatro exemplos do enunciado e os casos de fechamento em mês curto. Os arquivos da #21 ainda precisam estar nos caminhos corretos para rodar esse teste na `dev`.

No front-end, a partir da raiz:

```bash
cd frontend
npm test
npm run lint
npm run build
```

As rotas de previsão de faturas e dos dois relatórios foram exercitadas com dados de teste. A validação da previsão com a compra do seed oficial fica pendente até o seed entrar na `dev`.

## Fluxo de trabalho do grupo

1. Acompanhar a tarefa pela issue correspondente.
2. Criar uma branch a partir da `dev`, como `feat/nome-da-tarefa`.
3. Usar mensagens de commit como `feat:`, `fix:` ou `docs:`.
4. Abrir um Pull Request para a `dev`, mencionar a issue e pedir revisão a outro integrante.
5. Integrar a `dev` à `main` nos marcos do projeto, por Pull Request.
