# Seed de demonstração

Cria 2 usuários com 3 meses de lançamentos cada, para desenvolver e demonstrar o projeto sem cadastrar tudo à mão.

```bash
cd backend
npm run db:create   # se ainda não criou o banco
npm run db:seed
```

Pode rodar quantas vezes quiser: o seed apaga e recria **só** os dois usuários de demonstração (e os dados deles). Contas de outras pessoas nunca são tocadas. Os dados são fixos (sem aleatoriedade) e as datas são relativas a hoje, então sempre cobrem o mês atual e os dois anteriores.

## Usuários

| Usuário | E-mail | CPF | Senha |
|---|---|---|---|
| Ana Souza | `ana@demo.com` | 111.444.777-35 | `Senha123` |
| Bruno Lima | `bruno@demo.com` | 123.456.789-09 | `Senha123` |

Os dois têm dados diferentes de propósito, para a demonstração do isolamento (RF3): categorias, fontes/destinos e valores não coincidem (ex.: só a Ana tem "Freelance" e só o Bruno tem "Pets").

## O que cada um tem

**Ana** (82 lançamentos): salário, freelance e rendimentos; aluguel e contas; mercado, restaurantes, transporte, saúde e lazer. Fontes/destinos: Salário, Freelance, Conta corrente, Poupança (reserva), Dinheiro e **2 cartões**:

| Cartão | Fecha | Vence | Limite |
|---|---|---|---|
| Nubank | dia 3 | dia 10 | R$ 5.000 |
| Visa crédito | dia 25 | dia 5 | R$ 8.000 |

**Bruno** (48 lançamentos): salário, aluguel, condomínio, mercado, pets. Fontes/destinos: Salário, Conta corrente, Poupança (reserva) e 1 cartão (Inter Mastercard, fecha dia 15, vence dia 22, limite R$ 3.000).

## Casos preparados para a demonstração

**Compras parceladas** (parcelas gravadas com o mesmo `grupo_parcelamento`):

| Usuário | Compra | Parcelas | Cartão |
|---|---|---|---|
| Ana | Notebook, R$ 4.299,90 | 10x de R$ 429,99 | Visa |
| Ana | Geladeira, R$ 2.400,00 | 12x de R$ 200,00 | Visa |
| Ana | Tênis de corrida, R$ 899,90 | 3x: R$ 299,98 + 299,96 + 299,96 (diferença de centavos na 1ª) | Nubank |
| Bruno | Smartphone, R$ 2.199,90 | 12x | Inter |

**Fechamento da fatura** (a descrição do lançamento indica o caso). Compra no dia do fechamento cai na fatura do mês seguinte; um dia antes, na fatura do mês corrente:

| Descrição | Cartão | Resultado esperado |
|---|---|---|
| "... (compra no dia do fechamento)" | Nubank (dia 3), Visa (dia 25), Inter (dia 15) | fatura do mês seguinte |
| "... (um dia antes do fechamento)" | os mesmos | fatura do mesmo mês |

## Para demonstrar o isolamento (RF3)

1. Entre como Ana e liste os lançamentos; anote o id de um deles.
2. Entre como Bruno e peça esse id (`GET /api/lancamentos/<id>`): deve responder **404**.
3. Tente `PUT` e `DELETE` nesse id com o token do Bruno: também 404.

## Decisão de modelagem: data das parcelas

Todas as parcelas de uma compra guardam a **data da compra** (primeira dica do enunciado, seção 10.5.9); a fatura de cada uma é calculada com `calcularFatura(data, cartao, parcela_atual)`. Se o grupo preferir gravar em cada parcela a data de vencimento da fatura, altere só a função `dataDaParcela` em `backend/database/seed.js` (e o modelo de lançamentos, para os dois ficarem iguais).

## Detalhes técnicos

- `seed.js` grava direto no banco com SQL, numa transação (ou entra tudo, ou nada), e não depende do código de `models/` nem de `routes/`. Só precisa do `schema.sql`.
- Parcelas divididas em centavos, com a diferença na primeira.
- Datas futuras não existem: dias do mês atual que ainda não chegaram viram "hoje".
- Teste: `backend/test/seed.test.js` cria um banco temporário (e apaga depois), então `npm test` nunca altera os seus dados de demonstração.
- Se o CPF ou o e-mail de demonstração já pertencer a outra conta, o seed avisa e não grava nada.
