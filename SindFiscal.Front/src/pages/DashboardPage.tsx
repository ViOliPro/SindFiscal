import { useCondominioStore } from '@/stores/condominioStore'

export function DashboardPage() {
  const condominio = useCondominioStore((s) => s.condominioAtivo())

  return (
    <div>
      <header className="page-header">
        <h1>Dashboard</h1>
        <p>
          {condominio
            ? `Visão geral — ${condominio.nome}`
            : 'Selecione um condomínio para começar'}
        </p>
      </header>

      <div className="card">
        <p className="muted">
          Indicadores de caixa, comprometimento, fila de execução e alertas
          aparecerão aqui (RF17). Fase atual: fundação (Auth + shell +
          seleção de condomínio).
        </p>
      </div>
    </div>
  )
}
