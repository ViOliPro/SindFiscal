import { useCondominioStore } from '@/stores/condominioStore'
import { useQuery } from '@tanstack/react-query'
import { listarContas } from '@/services/api'

function formatMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function DashboardPage() {
  const condominio = useCondominioStore((s) => s.condominioAtivo())
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)

  const contasQ = useQuery({
    queryKey: ['contas', condominioId],
    queryFn: () => listarContas(condominioId!),
    enabled: !!condominioId,
  })

  const saldoTotal =
    contasQ.data?.reduce((acc, c) => acc + c.saldoAtual, 0) ?? null

  return (
    <div>
      <header className="page-header">
        <h1>Dashboard</h1>
        <p>
          {condominio
            ? `Visão geral — ${condominio.nome}`
            : 'Selecione ou crie um condomínio em Admin'}
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        }}
      >
        <div className="card">
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Saldo consolidado
          </p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {saldoTotal === null ? '—' : formatMoney(saldoTotal)}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Contas / fundos
          </p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {contasQ.data?.length ?? '—'}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Fonte de verdade
          </p>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.35rem' }}>
            Manual
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <p className="muted">
          Indicadores avançados (fila, comprometimento, alertas — RF17) entram
          nas próximas fases. Fundação: Auth + Condomínios + Contas/Lançamentos.
        </p>
      </div>
    </div>
  )
}
