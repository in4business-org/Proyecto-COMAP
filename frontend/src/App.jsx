import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import { Layout } from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Empresas from './pages/Empresas'
import EmpresaDetail from './pages/EmpresaDetail'
import ProyectoDetail from './pages/ProyectoDetail'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Todas las rutas debajo de ProtectedRoute requieren login */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/empresas" element={<Empresas />} />
              <Route path="/empresas/:empresaId" element={<EmpresaDetail />} />
              <Route path="/empresas/:empresaId/proyectos/:proyectoId" element={<ProyectoDetail />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
