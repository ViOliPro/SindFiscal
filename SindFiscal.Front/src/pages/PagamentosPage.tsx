import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import {
  adiarCompromisso,
  listarCompromissos,
  listarContas,
  listarPagamentos,
  registrarPagamento,
  reordenarFila,
} from '@/services/api'
import {
  STATUS_COMPROMISSO_LABEL,
  TIPO_PAGAMENTO_LABEL,
  type CompromissoFinanceiro,
  type TipoPagamento,
} from '@/types'
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

const pagamentoSchema = z.object({
  fundoResponsavelId: z.string().min(1, 'Selecione um fundo'),
  tipo: z.enum(['entrada', 'adiantamento', 'parcela', 'total']),
  valor: z.coerce.number().min(0.01, 'Valor deve ser positivo'),
  data: z.string().min(1, 'Informe a data'),
})
type PagamentoForm = z.infer<typeof pagamentoSchema>

/** RF13, RN11 — fila de execução manual, reordenável (sem critério automático). */
function FilaExecucao({
  condominioId,
  compromissos,
}: {
  condominioId: string
  compromissos: CompromissoFinanceiro[]
}) {
  const qc = useQueryClient()
  const emFila = [...compromissos]
    .filter((c) => c.status === 'em_fila_execucao')
    .sort((a, b) => (a.prioridadeFila ?? 0) - (b.prioridadeFila ?? 0))

  const invalidar = () => qc.invalidateQueries({ queryKey: ['compromissos', condominioId] })

  const reordenarM = useMutation({
    mutationFn: (ids: string[]) => reordenarFila(condominioId, ids),
    onSuccess: invalidar,
  })
  const adiarM = useMutation({
    mutationFn: (id: string) => adiarCompromisso(condominioId, id),
    onSuccess: invalidar,
  })

  function mover(index: number, direcao: -1 | 1) {
    const alvo = index + direcao
    if (alvo < 0 || alvo >= emFila.length) return
    const nova = [...emFila]
    const tmp = nova[index]
    nova[index] = nova[alvo]
    nova[alvo] = tmp
    reordenarM.mutate(nova.map((c) => c.id))
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        RF13, RN11 — ordem 100% manual, sem critério automático. Use as setas para reordenar.
      </p>
      {emFila.length === 0 && <p className="muted">Nenhum compromisso na fila de execução.</p>}
      {emFila.map((c, i) => (
        <div
          key={c.id}
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
          <span>
            <strong>#{i + 1}</strong> — {c.categoria} — {formatMoney(c.valorAprovado)}
          </span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button type="button" className="btn btn-ghost" onClick={() => mover(i, -1)} disabled={i === 0}>
              ↑
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => mover(i, 1)}
              disabled={i === emFila.length - 1}
            >
              ↓
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => adiarM.mutate(c.id)} disabled={adiarM.isPending}>
              Adiar
            </button>
          </div>
        </div>
      ))}
      <ErroApi error={reordenarM.error || adiarM.error} />
    </div>
  )
}

/** RF11, RN16 — pagamentos de um compromisso, com saldo remanescente calculado no backend. */
function DetalhePagamentos({ condominioId, compromisso }: { condominioId: string; compromisso: CompromissoFinanceiro }) {
  const qc = useQueryClient()

  const contasQ = useQuery({
    queryKey: ['contas', condominioId],
    queryFn: () => listarContas(condominioId),
  })
  const pagamentosQ = useQuery({
    queryKey: ['pagamentos', condominioId, compromisso.id],
    queryFn: () => listarPagamentos(condominioId, compromisso.id),
  })

  const form = useForm<PagamentoForm>({ resolver: zodResolver(pagamentoSchema) })
  const registrarM = useMutation({
    mutationFn: (d: PagamentoForm) =>
      registrarPagamento(condominioId, compromisso.id, {
        fundoResponsavelId: d.fundoResponsavelId,
        tipo: d.tipo,
        valor: d.valor,
        data: d.data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pagamentos', condominioId, compromisso.id] })
      qc.invalidateQueries({ queryKey: ['compromissos', condominioId] })
      form.reset()
    },
  })

  return (
    <div
      style={{
        marginTop: '0.5rem',
        padding: '1rem',
        background: 'var(--color-bg)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Saldo remanescente: <strong>{formatMoney(compromisso.saldoRemanescente)}</strong> de{' '}
        {formatMoney(compromisso.valorAprovado)}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {pagamentosQ.data?.map((p) => (
          <div key={p.id} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>{TIPO_PAGAMENTO_LABEL[p.tipo]} — {p.data}</span>
            <strong>{formatMoney(p.valor)}</strong>
          </div>
        ))}
        {pagamentosQ.data?.length === 0 && <p className="muted" style={{ fontSize: '0.85rem' }}>Nenhum pagamento registrado ainda.</p>}
      </div>

      <form
        onSubmit={form.handleSubmit((d) => registrarM.mutate(d))}
        style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', alignItems: 'end' }}
      >
        <div className="form-field">
          <label>Fundo responsável</label>
          <select className="select-condominio" style={{ width: '100%' }} {...form.register('fundoResponsavelId')}>
            <option value="">Selecione…</option>
            {contasQ.data?.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Tipo</label>
          <select className="select-condominio" style={{ width: '100%' }} {...form.register('tipo')}>
            {(Object.keys(TIPO_PAGAMENTO_LABEL) as TipoPagamento[]).map((t) => (
              <option key={t} value={t}>{TIPO_PAGAMENTO_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Valor</label>
          <input type="number" step="0.01" {...form.register('valor')} />
        </div>
        <div className="form-field">
          <label>Data</label>
          <input type="date" {...form.register('data')} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={registrarM.isPending}>
          Registrar pagamento
        </button>
        <ErroApi error={form.formState.errors.fundoResponsavelId?.message ?? form.formState.errors.valor?.message} />
        <ErroApi error={registrarM.error} />
      </form>
    </div>
  )
}

function ListaParaPagamento({ condominioId, compromissos }: { condominioId: string; compromissos: CompromissoFinanceiro[] }) {
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const candidatos = compromissos.filter((c) =>
    ['aguardando_execucao', 'em_fila_execucao', 'em_execucao'].includes(c.status),
  )

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {candidatos.length === 0 && <p className="muted">Nenhum compromisso aguardando pagamento.</p>}
      {candidatos.map((c) => (
        <div key={c.id} style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <strong>{c.categoria}</strong>
              <div className="muted" style={{ fontSize: '0.8rem' }}>{formatMoney(c.valorAprovado)}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="badge">{STATUS_COMPROMISSO_LABEL[c.status]}</span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '0.8rem' }}
                onClick={() => setExpandidoId(expandidoId === c.id ? null : c.id)}
              >
                {expandidoId === c.id ? 'Ocultar' : 'Pagamentos'}
              </button>
            </div>
          </div>
          {expandidoId === c.id && <DetalhePagamentos condominioId={condominioId} compromisso={c} />}
        </div>
      ))}
    </div>
  )
}

export function PagamentosPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const [aba, setAba] = useState<'pagamentos' | 'fila'>('pagamentos')

  const compromissosQ = useQuery({
    queryKey: ['compromissos', condominioId],
    queryFn: () => listarCompromissos(condominioId!),
    enabled: !!condominioId,
  })

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Pagamentos e Fila de Execução</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1>Pagamentos e Fila de Execução</h1>
        <p>RF11 / RF13 — pagamentos parciais e priorização manual</p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button type="button" className={`btn ${aba === 'pagamentos' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAba('pagamentos')}>
          Pagamentos
        </button>
        <button type="button" className={`btn ${aba === 'fila' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setAba('fila')}>
          Fila de Execução
        </button>
      </div>

      {compromissosQ.isLoading && <p className="muted">Carregando…</p>}
      {aba === 'pagamentos' && compromissosQ.data && (
        <ListaParaPagamento condominioId={condominioId} compromissos={compromissosQ.data} />
      )}
      {aba === 'fila' && compromissosQ.data && (
        <FilaExecucao condominioId={condominioId} compromissos={compromissosQ.data} />
      )}
    </div>
  )
}
