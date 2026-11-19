import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

// Esqueleto mínimo (menu + sair). A Pessoa B evolui o visual e a navegação.
const LINKS = [
  { para: '/', texto: 'Dashboard', fim: true },
  { para: '/lancamentos', texto: 'Lançamentos' },
  { para: '/categorias', texto: 'Categorias' },
  { para: '/fontes-destinos', texto: 'Fontes/Destinos' },
  { para: '/relatorios', texto: 'Relatórios' },
  { para: '/faturas', texto: 'Faturas' },
  { para: '/saude-financeira', texto: 'Saúde financeira' },
]

export default function Layout() {
  const { usuario, logout } = useAuth()

  return (
    <>
      <header className="layout-cabecalho">
        <strong>Controle Financeiro</strong>
        <nav>
          {LINKS.map((l) => (
            <NavLink key={l.para} to={l.para} end={l.fim}>
              {l.texto}
            </NavLink>
          ))}
        </nav>
        <span>{usuario?.nome}</span>
        <button type="button" onClick={logout}>Sair</button>
      </header>
      <main className="layout-conteudo">
        <Outlet />
      </main>
    </>
  )
}
