import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

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
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <>
      <header className="layout-cabecalho">
        <strong className="layout-marca">Controle Financeiro</strong>
        <button
          type="button"
          className="layout-menu-botao"
          aria-expanded={menuAberto}
          aria-controls="layout-nav"
          onClick={() => setMenuAberto((aberto) => !aberto)}
        >
          Menu
        </button>
        <nav
          id="layout-nav"
          className={menuAberto ? 'aberto' : undefined}
          aria-label="Navegação principal"
        >
          {LINKS.map((l) => (
            <NavLink
              key={l.para}
              to={l.para}
              end={l.fim}
              onClick={() => setMenuAberto(false)}
            >
              {l.texto}
            </NavLink>
          ))}
        </nav>
        <div className="layout-usuario">
          <span>{usuario?.nome ?? 'Usuário'}</span>
          <button type="button" onClick={logout}>Sair</button>
        </div>
      </header>
      <main className="layout-conteudo">
        <Outlet />
      </main>
    </>
  )
}
