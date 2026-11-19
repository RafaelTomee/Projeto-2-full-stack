import { Route, Routes } from 'react-router-dom'
import Cadastro from './components/Cadastro.jsx'
import Categorias from './components/Categorias.jsx'
import Dashboard from './components/Dashboard.jsx'
import Faturas from './components/Faturas.jsx'
import FontesDestinos from './components/FontesDestinos.jsx'
import Lancamentos from './components/Lancamentos.jsx'
import Layout from './components/Layout.jsx'
import Login from './components/Login.jsx'
import NaoEncontrada from './components/NaoEncontrada.jsx'
import Relatorios from './components/Relatorios.jsx'
import RotaProtegida from './components/RotaProtegida.jsx'
import SaudeFinanceira from './components/SaudeFinanceira.jsx'

// Para criar uma tela nova: crie o componente em components/ e registre uma <Route>
// DENTRO do grupo protegido abaixo (uma linha por tela, para evitar conflito no Git).
export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />

      {/* Protegidas: sem login, redireciona para /login */}
      <Route element={<RotaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="lancamentos" element={<Lancamentos />} />
          <Route path="categorias" element={<Categorias />} />
          <Route path="fontes-destinos" element={<FontesDestinos />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="faturas" element={<Faturas />} />
          <Route path="saude-financeira" element={<SaudeFinanceira />} />
          <Route path="*" element={<NaoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  )
}
