import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useCondominioStore } from '@/stores/condominioStore'
import { useEffect } from 'react'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/contas', label: 'Contas e Lançamentos' },
  { to: '/necessidades', label: 'Necessidades / Cotações' },
  { to: '/compromissos', label: 'Decisões / Compromissos' },
  { to: '/pagamentos', label: 'Pagamentos / Fila' },
  { to: '/acerto', label: 'Área de Acerto' },
  { to: '/reservas', label: 'Reservas' },
  { to: '/documentos', label: 'Documentos' },
  { to: '/admin', label: 'Condomínios / Usuários' },
]

export function AppShell() {
  const usuario = useAuthStore((s) => s.usuario)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const { condominios, condominioAtivoId, setCondominioAtivo, setCondominios } =
    useCondominioStore()

  // Placeholder: carregar condomínios reais quando API estiver pronta
  useEffect(() => {
    if (condominios.length === 0) {
      setCondominios([
        { id: 'demo-1', nome: 'Residencial Exemplo', ativo: true },
        { id: 'demo-2', nome: 'Edifício Horizonte', ativo: true },
      ])
    }
  }, [condominios.length, setCondominios])

  useEffect(() => {
    if (!condominioAtivoId && condominios.length > 0) {
      setCondominioAtivo(condominios[0].id)
    }
  }, [condominioAtivoId, condominios, setCondominioAtivo])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">SindFiscal</div>
        <nav className="sidebar-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <p className="muted" style={{ padding: '0 0.5rem', fontSize: '0.8rem' }}>
            {usuario?.nome}
          </p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <select
            className="select-condominio"
            value={condominioAtivoId ?? ''}
            onChange={(e) => setCondominioAtivo(e.target.value || null)}
            aria-label="Condomínio ativo"
          >
            {condominios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="badge">{usuario?.papel ?? '—'}</span>
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
