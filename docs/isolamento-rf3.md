# Isolamento entre usuários (RF3)

**Regra:** cada usuário só enxerga e altera os próprios dados. O id de um recurso de
outro usuário se comporta como id inexistente (**404**, nunca 403, para não revelar que existe).
Sem token ou com token inválido: **401**. Nenhuma resposta contém `senha_hash`.

## Como a API garante isso

1. O dono vem **sempre do token** (`req.usuarioId`), nunca do corpo, da query ou da URL.
2. Todo SQL de `categorias`, `fontes_destinos` e `lancamentos` filtra por `usuario_id`
   (leitura, edição e exclusão) ou grava `usuario_id` (inserção).
3. Ao criar/editar um lançamento, a categoria e a fonte/destino informadas também
   precisam ser do próprio usuário (senão 400/404).
4. SQL 100% parametrizado (`$1, $2…`). Os únicos trechos interpolados são constantes
   internas (lista de colunas) e fragmentos montados pelo código com placeholders.
5. `senha_hash` só é lido no login (`Usuario.buscarPorEmail`) e nunca sai em resposta.

## As três camadas de verificação

| Camada | Arquivo | Como rodar | O que prova |
|---|---|---|---|
| Teste automatizado (caixa-preta) | `backend/test/isolamento.test.js` | `npm run test:rf3` (também roda em `npm test`) | Sobe a API real em um banco temporário, cria A e B e prova 404/401, vazamentos em listas/relatórios, `usuarioId` forjado no corpo, injeção de SQL e ausência de `senha_hash`/500 em todas as respostas |
| Auditoria estática | `backend/scripts/auditar-rotas.mjs` | `npm run audit:rotas` | Toda rota usa `autenticar`; toda consulta SQL de tabela de dono tem `usuario_id`; sem interpolação insegura; `senha_hash` fora de lugar; dono lido do corpo |
| Coleção Postman/Insomnia | `postman/isolamento-rf3.postman_collection.json` + `postman/local.postman_environment.json` | Importar no Postman/Insomnia ou `npx newman run postman/isolamento-rf3.postman_collection.json -e postman/local.postman_environment.json` | Roteiro manual/demonstrável com 2 usuários (a ser usado na apresentação) |

Por que três? O teste de caixa-preta só vê o que a API devolve. Se a rota já chama
`buscarPorId(id, req.usuarioId)` antes de `UPDATE`/`DELETE`, um `UPDATE` sem `usuario_id`
no model **não muda nenhuma resposta**, mas deixaria o sistema a um refactor de distância
de um vazamento. A auditoria estática pega esse caso; o teste pega o que a leitura do código
não mostra.

## Coleção Postman: roteiro

0. **Preparação**: A e B se cadastram e fazem login pela API (e-mail/CPF gerados a cada execução); B cria categoria, fonte e lançamento "SEGREDO-B"; A cria os dele.
1. **Sem token → 401**: todas as rotas protegidas, mais token adulterado e token lixo.
2. **A ataca B**: GET/PUT/DELETE de categoria, fonte e lançamento de B → **404**; A tenta usar categoria/fonte de B ao criar/editar → recusado; `usuarioId` forjado no corpo é ignorado.
3. **Listagens e relatórios de A** (inclui filtros e injeção de SQL) não contêm nada de B.
4. **B continua intacto** depois dos ataques.
5. **`senha_hash`**: `/me` e cadastro duplicado, além de um teste global que roda em **todas** as respostas (sem `senha_hash`, sem hash bcrypt, sem 5xx).

Resultado esperado: 51 requisições, 199 asserções, 0 falhas.

## Validação por mutação (o teste realmente pega vazamentos?)

Foram injetadas 20 falhas deliberadas de isolamento (uma por vez) numa cópia do backend:

| Grupo | Mutantes | Teste (`test:rf3`) | Auditoria | Postman |
|---|---|---|---|---|
| Leitura/listagem sem `usuario_id` (categorias, fontes, lançamentos) | 8 | 8/8 | 8/8 | 4/4 testados |
| `UPDATE`/`DELETE` sem `usuario_id` no model | 6 | 0/6 (equivalentes na API, protegidos pelo `buscarPorId` da rota) | **6/6** | n/a |
| Criar lançamento com categoria/fonte de outro usuário | 2 | 2/2 | 2/2 | 2/2 |
| Relatórios e faturas sem `usuario_id` | 3 | 3/3 | 0/3 | 1/1 testado |
| `/me` devolvendo `senha_hash` | 1 | 1/1 | 1/1 | 1/1 |
| Rota sem `autenticar` | 1 | 1/1 | 1/1 | 1/1 |
| `usuarioId` lido do corpo | 1 | 1/1 | 1/1 | 1/1 |

Juntos, teste + auditoria detectam **20/20**.

## Checklist da issue #11

- [x] Coleção com 2 usuários: A tenta GET/PUT/DELETE em ids de B (categorias, fontes, lançamentos) → 404
- [x] Requisição sem token → 401
- [x] Revisão de todas as rotas: filtro por `usuario_id = req.usuarioId` e SQL parametrizado (`npm run audit:rotas`)
- [x] Nenhuma resposta contém `senha_hash`
- [x] Coleção exportada para `postman/`
