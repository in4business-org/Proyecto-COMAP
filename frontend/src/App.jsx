import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Empresas from './pages/Empresas'
import EmpresaDetail from './pages/EmpresaDetail'
import ProyectoDetail from './pages/ProyectoDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/empresas/:empresaId" element={<EmpresaDetail />} />
          <Route path="/empresas/:empresaId/proyectos/:proyectoId" element={<ProyectoDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
