# Front-end (React + Vite)

SPA do controle financeiro. Consome a API do `backend/`.

## Como rodar

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

- A API precisa estar no ar (`cd backend && npm run dev`, porta 3000).
- A porta **5173** é fixa: é a origem liberada no CORS da API. Se estiver ocupada, o Vite avisa em vez de trocar de porta.
- Opcional: para mudar o endereço da API, copie `.env.example` para `.env` e ajuste `VITE_API_URL` (o padrão é `http://localhost:3000/api`).
- Outros comandos: `npm run lint`, `npm test` (testes dos serviços) e `npm run build`.

Para entrar na aplicação, cadastre um usuário na tela `/cadastro` e faça login.

## Estrutura

```
src/
├── main.jsx            BrowserRouter + AuthProvider
├── App.jsx             todas as rotas (públicas e protegidas)
├── index.css           estilos mínimos (a Pessoa B evolui junto com o Layout)
├── components/         telas e componentes (páginas inclusive)
│   ├── RotaProtegida   redireciona para /login quem não está autenticado
│   ├── Layout          menu + botão Sair (esqueleto mínimo, a Pessoa B evolui)
│   ├── Login, Cadastro telas de autenticação (máscara de CPF, validação, erros do servidor)
│   ├── CampoForm       campo de formulário reutilizável (rótulo + input + dica + erro)
│   └── Dashboard, Lancamentos, Categorias, FontesDestinos,
│       Relatorios, Faturas, SaudeFinanceira   placeholders para B e C preencherem
├── contexts/
│   └── AuthContext     usuário, token, login, logout, cadastrar
└── services/
    ├── api.js          ÚNICO ponto de acesso à API (axios)
    ├── authStorage.js  sessão no localStorage
    ├── token.js        leitura da validade do JWT
    └── validacoes.js   validações do formulário (CPF, e-mail, senha) e máscara de CPF
```

## Quem faz qual tela

| Tela | Arquivo | Responsável |
|---|---|---|
| Login e cadastro | `Login.jsx`, `Cadastro.jsx` | A (pronto) |
| Lançamentos, Categorias, Fontes/Destinos | `Lancamentos.jsx`, `Categorias.jsx`, `FontesDestinos.jsx` | B |
| Layout e componentes compartilhados | `Layout.jsx` e novos componentes | B |
| Dashboard, Relatórios, Faturas, Saúde financeira | `Dashboard.jsx`, `Relatorios.jsx`, `Faturas.jsx`, `SaudeFinanceira.jsx` | C |

As rotas já estão registradas em `App.jsx`: basta preencher o componente da sua tela.

## Como chamar a API

Sempre pelo `services/api.js`. O cabeçalho `Authorization: Bearer <token>` é adicionado sozinho: **nunca monte esse cabeçalho à mão**, e nunca use `fetch` ou `axios` direto nas telas.

```jsx
import { useEffect, useState } from 'react'
import { api, extrairErro } from '../services/api.js'

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    api
      .get('/categorias')                       // GET http://localhost:3000/api/categorias
      .then(({ data }) => setCategorias(data))
      .catch((e) => setErro(extrairErro(e).mensagem))
      .finally(() => setCarregando(false))
  }, [])

  // ...trate os 3 estados: carregando, erro e lista vazia
}
```

### Erros da API

Todo erro da API tem o formato `{ erro, campos? }` (veja `docs/padrao-de-erros.md`). Use `extrairErro` para ler:

```jsx
try {
  await api.post('/categorias', { nome, tipo })
} catch (e) {
  const { mensagem, campos, status } = extrairErro(e)
  // mensagem: texto geral (mostre no topo do formulário)
  // campos:   { nome: 'Já existe...' } (mostre junto ao campo correspondente)
}
```

`extrairErro` também cobre servidor fora do ar (mensagem amigável, `status: null`).

### Sessão expirada

Se a API responder **401** a uma requisição autenticada, o cliente HTTP encerra a sessão e o app volta ao `/login` sozinho. Você não precisa tratar 401 nas telas. O mesmo acontece quando o token expira com a tela aberta.

## Formulários

Use o `CampoForm` para que todos os formulários tenham o mesmo comportamento (mensagem de erro junto ao campo, acessibilidade). O padrão das telas de `Login.jsx` e `Cadastro.jsx` é um bom modelo:

```jsx
import CampoForm from './CampoForm.jsx'

<CampoForm id="nome" name="nome" rotulo="Nome" value={valores.nome} onChange={alterar} erro={erros.nome} />
```

- Valide no cliente antes de enviar (não gasta requisição), mas **o servidor é quem decide**: mostre `campos` devolvidos pela API em `erro=`.
- Durante o envio, desabilite o formulário (`<fieldset disabled>`) e mostre o estado ("Salvando...").
- `services/validacoes.js` tem `cpfValido`, `emailValido`, `senhaValida` e `mascararCpf` para reaproveitar.

## Usuário logado

```jsx
import { useAuth } from '../contexts/AuthContext.jsx'

const { usuario, autenticado, login, logout, cadastrar } = useAuth()
// usuario: { id, nome, email }
```

## Criar uma tela nova

1. Crie `src/components/MinhaTela.jsx`.
2. Registre uma linha em `App.jsx`, dentro do grupo de rotas protegidas:
   `<Route path="minha-tela" element={<MinhaTela />} />`
3. (Se for aparecer no menu) adicione em `LINKS` no `Layout.jsx`.

## Lembretes do enunciado

- Valores em reais com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` e datas no formato brasileiro.
- Toda tela que usa a API trata carregamento, lista vazia e erro.
- Mensagens de erro do servidor aparecem junto ao campo correspondente.
- Bibliotecas novas (ex.: Recharts, para os gráficos) só depois de aprovadas pelo professor.
