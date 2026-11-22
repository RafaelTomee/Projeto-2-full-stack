# Checklist final do grupo (seção 10.14)

Reunir os três, abrir este arquivo e marcar cada item **só depois de ver acontecer**. A coluna "Como verificar" diz o que rodar. Rodem tudo na `main` (ou `dev`) atualizada, com o banco criado.

Antes: `cd backend && npm test && npm run test:rf3 && npm run audit:rotas`.

| # | Item | Como verificar | Teste automatizado | OK |
|---|---|---|---|---|
| 1 | Mesmo e-mail com letras maiúsculas diferentes é rejeitado | Cadastrar `ana@demo.com` e depois `ANA@Demo.com`: 409 no campo e-mail | `cadastro.test.js` ("e-mail repetido com maiúsculas diferentes…") | [ ] |
| 2 | Mesmo CPF com e sem pontuação é rejeitado | Cadastrar `11144477735` e depois `111.444.777-35`: 409 no campo cpf | `cadastro.test.js` ("CPF repetido, com e sem pontuação…") | [ ] |
| 3 | Remover a verificação prévia do código não permite duplicatas (a garantia é do banco) | Comentar o `SELECT` de checagem prévia no cadastro (se existir) e rodar o teste: continua 409 por causa do `UNIQUE` | `cadastro.test.js` ("requisições simultâneas…") | [ ] |
| 4 | Nenhuma resposta da API contém `senha_hash` | Rodar a coleção Postman (teste global) e `npm run test:rf3` | `isolamento.test.js` (varredura de todas as respostas) | [ ] |
| 5 | Trocar o id na URL não dá acesso a dados de outro usuário | Coleção Postman, pasta "A ataca os recursos de B": 404 | `isolamento.test.js`, `lancamentos.test.js` | [ ] |
| 6 | Um lançamento de saída não aceita categoria de entrada | Na tela de lançamento, escolher saída e categoria de entrada: 400 no campo | `lancamentos.test.js` ("tipo da categoria diferente…") | [ ] |
| 7 | Compra de R$ 100,00 em 3× gera parcelas que somam exatamente R$ 100,00 | Criar a compra e somar as parcelas (33,34 + 33,33 + 33,33) | `parcelamento.test.js` ("divisão em centavos…", "POST em cartão com 3 parcelas…") | [ ] |
| 8 | Compra feita no dia do fechamento aparece na fatura do mês seguinte | Cartão que fecha dia 25: compra em 25/11 aparece na fatura que fecha em 25/12 | `calcularFatura.test.js` | [ ] |
| 9 | Token expirado leva o usuário de volta ao login sem erros na tela | Usar `JWT_EXPIRES_IN=1m` no `.env`, esperar, clicar em qualquer tela: volta ao login e a tela não quebra | `frontend/test/api.test.js` | [ ] |
| 10 | `.env` não está no repositório; `.env.example` está | `git ls-files | grep -i env` deve listar só `backend/.env.example` | n/a | [ ] |
| 11 | O README permite que outra pessoa suba o projeto do zero | Alguém **de fora do código** clona o repositório em outra pasta e segue só o README | n/a | [ ] |

Item 11: o jeito honesto é clonar em uma pasta limpa (`git clone ... teste-readme`), com um banco novo, e seguir o README à risca. Qualquer passo que faltar vira correção no README.

## Verificar os commits de todos os integrantes

Cada integrante precisa aparecer com commits no repositório.

```bash
git fetch --all
git shortlog -sne --all          # commits por autor (nome e e-mail)
git log --all --format='%an <%ae>' | sort | uniq -c | sort -rn
gh pr list --state merged --limit 100 --json number,title,author --jq '.[] | "\(.number) \(.author.login) \(.title)"'
```

Conferir:
- [ ] Rafael, Silvio e Julio aparecem em `shortlog`, cada um com uma parcela relevante dos commits.
- [ ] Nenhum integrante aparece com dois nomes ou com e-mail que não é o do GitHub. Se aparecer, o GitHub não conta a contribuição: o dono ajusta com `git config user.name` e `git config user.email` nas próximas máquinas e, se for preciso, um `.mailmap` na raiz resolve a exibição.
- [ ] Cada tarefa tem pelo menos um PR do dono dela, e as issues foram fechadas pelos PRs.
- [ ] `dev` e `main` não receberam commits diretos que deveriam ter passado por PR.
