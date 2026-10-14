import { useCondominioStore } from '@/stores/condominioStore'
import { useQuery } from '@tanstack/react-query'
import { obterDashboard } from '@/services/api'

function formatMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function DashboardPage() {
  const condominio = useCondominioStore((s) => s.condominioAtivo())
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)

  const dashQ = useQuery({
    queryKey: ['dashboard', condominioId],
    queryFn: () => obterDashboard(condominioId!),
    enabled: !!condominioId,
  })

  const d = dashQ.data

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

      {dashQ.isLoading && <p className="muted">Carregando indicadores…</p>}
      {dashQ.error && (
        <p className="muted" style={{ color: 'var(--color-danger)' }}>
          {(dashQ.error as Error).message}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        }}
      >
        <div className="card">
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Saldo bancário total
          </p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {d ? formatMoney(d.saldoBancarioTotal) : '—'}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Comprometido
          </p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {d ? formatMoney(d.valorComprometidoTotal) : '—'}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Saldo livre
          </p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {d ? formatMoney(d.saldoLivre) : '—'}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            % comprometido
          </p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {d ? `${d.percentualComprometido.toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Em fila de execução
          </p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {d ? formatMoney(d.valorEmFilaDeExecucao) : '—'}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Itens área de acerto
          </p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {d ? d.itensPendentesNaAreaDeAcerto : '—'}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Em análise / orçamento
          </p>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {d ? d.itensEmAnaliseOuOrcamento : '—'}
          </p>
        </div>
        <div className="card">
          <p className="muted" style={{ fontSize: '0.8rem' }}>
            Arrecadação extra
          </p>
          <p
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              marginTop: '0.35rem',
              color: d?.necessidadeDeArrecadacaoExtra
                ? 'var(--color-warning)'
                : 'var(--color-success)',
            }}
          >
            {d ? (d.necessidadeDeArrecadacaoExtra ? 'Sim' : 'Não') : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}
