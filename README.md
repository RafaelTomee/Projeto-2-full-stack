# Projeto 2 — Aplicação Full Stack de Controle Financeiro

Disciplina: Programação Web Full Stack — Engenharia de Software

## Tecnologias

- Back-end: Node.js + Express
- Front-end: React (Vite)
- Banco de dados: PostgreSQL
- Autenticação: JWT + bcrypt

## Como rodar (em construção)

### Back-end

```bash
cd backend
cp .env.example .env   # preencha as variáveis
npm install
npm run dev            # http://localhost:3000
```

Teste: `GET http://localhost:3000/api/saude` deve responder `{ "status": "ok" }`.

### Front-end

Em breve.

## Fluxo de trabalho do grupo

- Uma branch por task (ex.: `feat/ddl-banco`), nomeada a partir da issue.
- Pull Request para a `main` com `Closes #N` na descrição.
- Nada de commit direto na `main` depois do setup inicial.

> Este README será completado na task final (instruções de banco, seed, rotas e decisões do projeto).
