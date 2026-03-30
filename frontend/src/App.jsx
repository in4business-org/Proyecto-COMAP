import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import { Layout } from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Empresas from './pages/Empresas'
import EmpresaDetail from './pages/EmpresaDetail'
import ProyectoDetail from './pages/ProyectoDetail'
import UserSettings from './pages/UserSettings'
import OrgSettings from './pages/OrgSettings'
import InboxPage from './pages/Inbox'

export default function App() {
  return (
    <ThemeProvider>
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
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/settings/user" element={<UserSettings />} />
              <Route path="/settings/organization" element={<OrgSettings />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}
