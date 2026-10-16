import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { AdminPage } from '@/pages/AdminPage'
import { AcessosPage } from '@/pages/AcessosPage'
import { AcessoUsuarioPage } from '@/pages/AcessoUsuarioPage'
import { ContasPage } from '@/pages/ContasPage'
import { CompromissosPage } from '@/pages/CompromissosPage'
import { NecessidadesPage } from '@/pages/NecessidadesPage'
import { PagamentosPage } from '@/pages/PagamentosPage'
import { AcertoPage } from '@/pages/AcertoPage'
import { DespesasFuturasPage } from '@/pages/DespesasFuturasPage'
import { PendenciasPage } from '@/pages/PendenciasPage'
import { ReceitasRecorrentesPage } from '@/pages/ReceitasRecorrentesPage'
import { useAuthStore } from '@/stores/authStore'

function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <header className="page-header">
        <h1>{title}</h1>
        <p>Módulo em construção — próximas fases.</p>
      </header>
      <div className="card empty-state">
        <p>Esta tela será implementada nas próximas sessões.</p>
      </div>
    </div>
  )
}

export default function App() {
  const token = useAuthStore((s) => s.token)

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={token ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="contas" element={<ContasPage />} />
          <Route path="necessidades" element={<NecessidadesPage />} />
          <Route path="compromissos" element={<CompromissosPage />} />
          <Route path="pagamentos" element={<PagamentosPage />} />
          <Route path="despesas-futuras" element={<DespesasFuturasPage />} />
          <Route path="pendencias" element={<PendenciasPage />} />
          <Route path="acerto" element={<AcertoPage />} />
          <Route path="receitas-recorrentes" element={<ReceitasRecorrentesPage />} />
          <Route path="reservas" element={<Placeholder title="Reservas de Área Comum" />} />
          <Route path="documentos" element={<Placeholder title="Documentos" />} />
          <Route path="acessos" element={<AcessosPage />} />
          <Route path="acessos/:usuarioId" element={<AcessoUsuarioPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
