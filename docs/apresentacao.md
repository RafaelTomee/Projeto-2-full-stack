# Roteiro da apresentação (10 minutos)

Segue a seção 10.11 do enunciado, na ordem dos itens obrigatórios. **Rafael (A)** abre e fecha, **Silvio (B)** cuida do CRUD e da compra parcelada, **Julio (C)** cuida dos relatórios, das faturas e do desafio.

| # | Tempo | Quem | Item da 10.11 |
|---|---|---|---|
| 0 | 0:15 | Rafael | Abertura: o que é o sistema e quem fez o quê |
| 1 | 0:50 | Rafael | Código-fonte: pastas, modelo de dados, arquivos principais |
| 2 | 0:40 | Rafael | Execução pela linha de comando |
| 3 | 1:00 | Rafael | Cadastro e unicidade (e-mail e CPF) |
| 4 | 1:10 | Rafael | Login, isolamento (RF3) e requisição sem token (401) |
| 5 | 2:50 | Silvio | CRUD completo e uma compra parcelada no cartão |
| 6 | 2:30 | Julio | Relatórios: por categoria, por fonte/destino e previsão das faturas |
| 7 | 0:30 | Julio | Desafio: saúde financeira (se estiver na versão entregue) |
| 8 | 0:15 | Rafael | Fechamento |
| | **10:00** | | |

São 10 minutos exatos, sem folga. **Ensaiem com cronômetro.** Se estourar, cortem primeiro o item 7 (30 s), depois mostrem só um relatório no item 6.

## Antes de começar (todo o grupo)

- Banco criado e populado: `npm run db:create` e `npm run db:seed` (usuários `ana@demo.com` e `bruno@demo.com`, senha `Senha123`).
- Back-end (`npm run dev` em `backend/`) e front-end (`npm run dev` em `frontend/`) já rodando, para ninguém esperar subir durante os 10 minutos. No item 2 mostram os comandos e o terminal já ligado.
- Abas prontas: app em `http://localhost:5173`, terminal na pasta do projeto, VS Code no projeto, Postman (ou Insomnia) com `postman/isolamento-rf3.postman_collection.json` importada.
- Uma janela anônima ou navegador sem login salvo.
- **Reserva:** deixem o repositório clonado e testado em uma segunda máquina. Se a internet cair, nada do roteiro depende dela.
- Escolham quem opera o computador em cada bloco. Quem fala não precisa ser quem digita.

---

## 0. Abertura (Rafael, 0:15)

> "Somos o grupo X. Fizemos um controle financeiro pessoal: cadastro e login, categorias, fontes e destinos, lançamentos com compra parcelada no cartão, relatórios e previsão de faturas. Eu fiz autenticação, banco e segurança; o Silvio fez os cadastros e lançamentos; o Julio fez relatórios, faturas e saúde financeira."

## 1. Código-fonte (Rafael, 0:50)

Mostrar no VS Code, na ordem:
1. Raiz: `backend/`, `frontend/`, `docs/`, `postman/`, `README.md`.
2. `backend/database/schema.sql`: quatro tabelas e as restrições (`UNIQUE` de e-mail e CPF, `CHECK` de tipos, chaves estrangeiras, `NUMERIC(12,2)` para dinheiro).
3. `backend/src/`: `routes/` (HTTP), `models/` (SQL parametrizado), `middlewares/autenticar.js`.
4. `backend/src/config/faturas.js` (`calcularFatura`) e `frontend/src/components/`.

Frase-chave: *"Regras ficam no servidor e no banco; o front só mostra e valida para ajudar o usuário."*

## 2. Execução pela linha de comando (Rafael, 0:40)

No terminal, só digitar e explicar (os servidores já estão de pé):

```bash
cd backend
npm run db:create   # cria o banco e aplica o schema
npm run db:seed     # 2 usuários de demonstração com 3 meses de dados
npm run dev         # API em :3000
# outro terminal
cd frontend && npm run dev   # app em :5173
```

Mostrar `http://localhost:3000/api/saude` respondendo `{"status":"ok"}`.

## 3. Cadastro e unicidade (Rafael, 1:00)

1. Em `/cadastro`, cadastrar um usuário novo (nome, e-mail, CPF válido, senha). Entra logado.
2. Sair. Tentar cadastrar de novo com o e-mail **`ANA@demo.com`** (maiúsculas): erro **no campo e-mail**.
3. Tentar com um e-mail novo e o CPF **`123.456.789-09`** (do Bruno, com pontuação): erro **no campo CPF**.

Frase-chave: *"A garantia é do banco (`UNIQUE`). O servidor responde 409 e o front mostra a mensagem no campo certo. E-mail é normalizado em minúsculas e CPF em dígitos."*

## 4. Login, isolamento e token (Rafael, 1:10)

1. Login como `ana@demo.com`. Abrir Lançamentos e anotar o id de um lançamento (aba Network ou o Postman).
2. No Postman, pasta **2. A ataca os recursos de B**: pedir o id da Ana com o token do Bruno → **404** (GET, PUT e DELETE).
3. Pasta **1. Sem token**: a mesma rota sem `Authorization` → **401**.
4. Dizer: *"Id de outro usuário se comporta como inexistente. Toda consulta filtra por `usuario_id` do token. A coleção tem 199 verificações e nenhuma resposta contém `senha_hash`."*

Se faltar tempo: rodar a coleção inteira no Runner e mostrar só o resumo verde.

## 5. CRUD e compra parcelada (Silvio, 2:50)

Logado como **Ana**:
1. **Categoria:** criar, editar o nome, tentar excluir uma categoria que tem lançamentos (mensagem de bloqueio) e excluir uma recém-criada.
2. **Fonte/destino:** criar uma conta; mostrar que um cartão pede fechamento e vencimento.
3. **Lançamento simples:** criar uma saída, editar o valor, excluir. Mostrar que uma saída não aceita categoria de entrada.
4. **Compra parcelada (guardem esta compra, o item 6 usa ela):** saída de **R$ 900,00 em 3×** no cartão **Visa crédito** (fecha dia 25, vence dia 5), com **data do dia 25 do mês** (o dia do fechamento). Abrir a lista: 3 parcelas (`300,00` cada, soma exatamente 900,00). Mostrar que parcelas de R$ 100,00 em 3× dariam `33,34 + 33,33 + 33,33`.

Frase-chave: *"As parcelas são criadas numa transação só, em centavos, com a diferença na primeira."*

## 6. Relatórios e faturas (Julio, 2:30)

1. **Por categoria:** escolher o período, mostrar totais, percentuais e a comparação com o período anterior.
2. **Por fonte/destino:** entradas, saídas e saldo.
3. **Faturas:** abrir a previsão do **Visa crédito** e mostrar **em qual fatura caiu cada parcela** da compra do item 5. A compra feita **no dia do fechamento (25)** entra na fatura do **mês seguinte**; a 2ª e a 3ª parcela avançam um mês cada.
4. Dizer: *"Guardamos a data da compra e calculamos fechamento e vencimento na leitura, com `calcularFatura`. Os relatórios por período contam a compra no mês em que foi feita; a previsão distribui cada parcela no mês do seu vencimento."* (justificativa completa no README)

Na véspera, conferir na tela com a **data real que vão usar**: Visa fecha dia 25 e vence dia 5.

## 7. Desafio: saúde financeira (Julio, 0:30)

Abra **Saúde financeira** na conta da Ana. Depois, compare com a conta do Bruno.

> “A taxa de poupança divide o saldo do mês pela renda. O comprometimento divide as saídas do cartão pela renda. Também somamos as parcelas dos próximos três meses e projetamos o saldo com os lançamentos registrados. A tela alerta se algum mês ficar negativo. Os limites de 10% para poupança e 30% para cartão são critérios educativos do projeto.”

## 8. Fechamento (Rafael, 0:15)

> "Tudo está no repositório, com README que sobe o projeto do zero, testes automatizados e coleção Postman do isolamento. Obrigado."

---

## Perguntas que o professor pode fazer

| Pergunta | Quem responde | Resposta curta |
|---|---|---|
| Por que PostgreSQL e não SQLite? | Rafael | Restrições `UNIQUE`/`CHECK`/FK e `NUMERIC` para dinheiro; o professor foi avisado. |
| Como garantem que não há e-mail duplicado em requisições simultâneas? | Rafael | `UNIQUE` no banco; o servidor trata o erro 23505 e responde 409. Há teste com requisições simultâneas. |
| Por que 404 e não 403 para dado de outro usuário? | Rafael | Não revelar que o id existe. |
| Onde a fatura é calculada? | Julio | `backend/src/config/faturas.js`, função pura, testada com os exemplos do enunciado. |
| Por que a compra parcelada conta inteira no mês nos relatórios? | Julio | Todas as parcelas guardam a data da compra e o relatório filtra por data (competência); a previsão de faturas mostra o caixa por vencimento. |
| Por que guardar a data da compra e não o vencimento da fatura? | Julio | Uma fonte de verdade: se o cartão mudar de dia de fechamento, a fatura se ajusta sozinha. |
| O que acontece com o token expirado? | Rafael | O front encerra a sessão e volta ao login sem erro na tela. |
| Quem fez o quê? | Todos | Cada um fala da sua parte; os commits e PRs mostram a divisão. |
