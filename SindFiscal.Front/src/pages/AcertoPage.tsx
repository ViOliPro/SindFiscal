import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import {
  acumularAporte,
  compensarAporte,
  confirmarExecucaoTransferencia,
  consolidarTransferencias,
  listarAreaDeAcerto,
  listarContas,
} from '@/services/api'
import { MOTIVO_TRANSFERENCIA_LABEL, STATUS_TRANSFERENCIA_LABEL, type Transferencia } from '@/types'
import { useCondominioStore } from '@/stores/condominioStore'
import { ApiError } from '@/lib/api'

function formatMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ErroApi({ error }: { error: unknown }) {
  if (!error) return null
  const msg =
    typeof error === 'string'
      ? error
      : error instanceof ApiError
        ? error.message
        : 'Erro inesperado.'
  return (
    <p className="muted" style={{ color: 'var(--color-danger, #c0392b)', fontSize: '0.85rem' }}>
      {msg}
    </p>
  )
}

const dataExecucaoSchema = z.object({ dataExecucao: z.string().min(1, 'Informe a data') })
type DataExecucaoForm = z.infer<typeof dataExecucaoSchema>

const compensarSchema = z.object({
  valorAExecutar: z.coerce.number().min(0.01, 'Valor deve ser positivo'),
})
type CompensarForm = z.infer<typeof compensarSchema>

/** Uma linha da área de acerto — checkbox pra consolidar (RN17) + confirmar execução manual. */
function ItemTransferencia({
  condominioId,
  item,
  selecionado,
  onToggleSelecionar,
}: {
  condominioId: string
  item: Transferencia
  selecionado: boolean
  onToggleSelecionar: () => void
}) {
  const qc = useQueryClient()
  const form = useForm<DataExecucaoForm>({ resolver: zodResolver(dataExecucaoSchema) })
  const confirmarM = useMutation({
    mutationFn: (d: DataExecucaoForm) =>
      confirmarExecucaoTransferencia(condominioId, item.id, d.dataExecucao),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['area-de-acerto', condominioId] }),
  })

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.6rem 0.75rem',
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        gap: '0.5rem',
        flexWrap: 'wrap',
      }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
        {item.status === 'pendente' && (
          <input type="checkbox" checked={selecionado} onChange={onToggleSelecionar} />
        )}
        <span>
          {item.contaOrigemNome} → {item.contaDestinoNome} — <strong>{formatMoney(item.valor)}</strong>{' '}
          <span className="badge">{STATUS_TRANSFERENCIA_LABEL[item.status]}</span>
        </span>
      </label>
      {item.status === 'pendente' && (
        <form
          onSubmit={form.handleSubmit((d) => confirmarM.mutate(d))}
          style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}
        >
          <input type="date" {...form.register('dataExecucao')} />
          <button type="submit" className="btn btn-ghost" style={{ fontSize: '0.8rem' }} disabled={confirmarM.isPending}>
            Confirmar execução
          </button>
        </form>
      )}
      <ErroApi error={confirmarM.error} />
    </div>
  )
}

function GrupoTransferencias({
  condominioId,
  titulo,
  itens,
}: {
  condominioId: string
  titulo: string
  itens: Transferencia[]
}) {
  const qc = useQueryClient()
  const [selecionados, setSelecionados] = useState<string[]>([])

  const consolidarM = useMutation({
    mutationFn: () => consolidarTransferencias(condominioId, selecionados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['area-de-acerto', condominioId] })
      setSelecionados([])
    },
  })

  function toggle(id: string) {
    setSelecionados((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <h3 style={{ margin: 0 }}>{titulo}</h3>
      {itens.length === 0 && <p className="muted" style={{ fontSize: '0.85rem' }}>Nenhum item pendente.</p>}
      {itens.map((it) => (
        <ItemTransferencia
          key={it.id}
          condominioId={condominioId}
          item={it}
          selecionado={selecionados.includes(it.id)}
          onToggleSelecionar={() => toggle(it.id)}
        />
      ))}
      {selecionados.length >= 2 && (
        <button type="button" className="btn btn-primary" onClick={() => consolidarM.mutate()} disabled={consolidarM.isPending}>
          Consolidar {selecionados.length} itens selecionados (RN17)
        </button>
      )}
      <ErroApi error={consolidarM.error} />
    </div>
  )
}

/** RN20/RN21 — aporte pendente acumulado por fundo, com ação de recalcular e compensar. */
function AportesPorFundo({ condominioId }: { condominioId: string }) {
  const qc = useQueryClient()
  const contasQ = useQuery({ queryKey: ['contas', condominioId], queryFn: () => listarContas(condominioId) })
  const [fundoAbertoId, setFundoAbertoId] = useState<string | null>(null)

  const acumularM = useMutation({
    mutationFn: (fundoId: string) => acumularAporte(condominioId, fundoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contas', condominioId] }),
  })

  const compensarForm = useForm<CompensarForm>({ resolver: zodResolver(compensarSchema) })
  const compensarM = useMutation({
    mutationFn: (d: { fundoId: string; valor: number }) =>
      compensarAporte(condominioId, d.fundoId, d.valor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas', condominioId] })
      qc.invalidateQueries({ queryKey: ['area-de-acerto', condominioId] })
      compensarForm.reset()
    },
  })

  const fundosComRegra = contasQ.data?.filter((c) => c.regraAporteTipo !== null || c.aportePendenteAcumulado > 0) ?? []

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <h3 style={{ margin: 0 }}>Aportes periódicos (RN20/RN21)</h3>
      {fundosComRegra.length === 0 && (
        <p className="muted" style={{ fontSize: '0.85rem' }}>Nenhum fundo com regra de aporte configurada.</p>
      )}
      {fundosComRegra.map((fundo) => (
        <div key={fundo.id} style={{ padding: '0.6rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span>
              <strong>{fundo.nome}</strong> — acumulado pendente: {formatMoney(fundo.aportePendenteAcumulado)}
            </span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => acumularM.mutate(fundo.id)} disabled={acumularM.isPending}>
                Recalcular aporte do período
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '0.8rem' }}
                onClick={() => setFundoAbertoId(fundoAbertoId === fundo.id ? null : fundo.id)}
                disabled={fundo.aportePendenteAcumulado <= 0}
              >
                Compensar
              </button>
            </div>
          </div>
          {fundoAbertoId === fundo.id && (
            <form
              onSubmit={compensarForm.handleSubmit((d) => compensarM.mutate({ fundoId: fundo.id, valor: d.valorAExecutar }))}
              style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'end' }}
            >
              <div className="form-field">
                <label>Valor a compensar (até {formatMoney(fundo.aportePendenteAcumulado)})</label>
                <input type="number" step="0.01" {...compensarForm.register('valorAExecutar')} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={compensarM.isPending}>
                Confirmar
              </button>
            </form>
          )}
          <ErroApi error={compensarM.error} />
        </div>
      ))}
      <ErroApi error={acumularM.error} />
    </div>
  )
}

export function AcertoPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)

  const acertoQ = useQuery({
    queryKey: ['area-de-acerto', condominioId],
    queryFn: () => listarAreaDeAcerto(condominioId!),
    enabled: !!condominioId,
  })

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Área de Acerto</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1>Área de Acerto</h1>
        <p>RF14 — reposição, aporte e destinação de receita entre a conta operacional e os fundos</p>
      </header>

      {acertoQ.isLoading && <p className="muted">Carregando…</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {acertoQ.data && (
          <>
            <GrupoTransferencias
              condominioId={condominioId}
              titulo={`Reposições (${MOTIVO_TRANSFERENCIA_LABEL.reposicao})`}
              itens={acertoQ.data.reposicoes}
            />
            <GrupoTransferencias
              condominioId={condominioId}
              titulo={`Destinações de receita (${MOTIVO_TRANSFERENCIA_LABEL.destinacao_receita})`}
              itens={acertoQ.data.destinacoesReceita}
            />
            <GrupoTransferencias
              condominioId={condominioId}
              titulo={`Aportes pendentes (${MOTIVO_TRANSFERENCIA_LABEL.aporte})`}
              itens={acertoQ.data.aportes}
            />
          </>
        )}
        <AportesPorFundo condominioId={condominioId} />
      </div>
    </div>
  )
}
