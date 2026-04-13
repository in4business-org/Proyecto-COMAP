import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/layout/Layout'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Empresas = lazy(() => import('./pages/Empresas'))
const EmpresaDetail = lazy(() => import('./pages/EmpresaDetail'))
const ProyectoDetail = lazy(() => import('./pages/ProyectoDetail'))
const UserSettings = lazy(() => import('./pages/UserSettings'))
const OrgSettings = lazy(() => import('./pages/OrgSettings'))
const InboxPage = lazy(() => import('./pages/Inbox'))
const ClienteView = lazy(() => import('./pages/ClienteView'))

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Portal de cliente: acceso público con token */}
          <Route path="/cliente/:token" element={<ClienteView />} />

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
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}
