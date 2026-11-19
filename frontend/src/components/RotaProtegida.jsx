import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

// Envolve as rotas que exigem login. Sem sessão, manda para /login e guarda
// a página pedida em state.de, para voltar a ela depois de entrar.
export default function RotaProtegida() {
  const { autenticado } = useAuth()
  const location = useLocation()

  if (!autenticado) {
    return <Navigate to="/login" replace state={{ de: location }} />
  }
  return <Outlet />
}
