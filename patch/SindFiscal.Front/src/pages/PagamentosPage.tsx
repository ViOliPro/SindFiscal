import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import {
  adiarCompromisso,
  entrarNaFila,
  listarCompromissos,
  listarContas,
  listarPagamentos,
  registrarPagamento,
  reordenarFila,
} from '@/services/api'
import {
  STATUS_COMPROMISSO_LABEL,
  TIPO_PAGAMENTO_LABEL,
  type StatusCompromisso,
  type TipoPagamento,
} from '@/types'
import { useCondominioStore } from '@/stores/condominioStore'

function formatMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ErroApi({ error }: { error: unknown }) {
  if (!error) return null
  const msg =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Erro'
  return <p className="muted" style={{ color: 'var(--color-danger)' }}>{msg}</p>
}

const pagSchema = z.object({
  fundoResponsavelId: z.string().min(1),
  tipo: z.enum(['entrada', 'adiantamento', 'parcela', 'total']),
  valor: z.coerce.number().positive(),
  data: z.string().min(1),
})
type PagForm = z.infer<typeof pagSchema>

export function PagamentosPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const qc = useQueryClient()
  const [tab, setTab] = useState<'fila' | 'pagamentos'>('fila')
  const [compromissoId, setCompromissoId] = useState<string | null>(null)

  const filaQ = useQuery({
    queryKey: ['compromissos', condominioId, 'fila'],
    queryFn: () => listarCompromissos(condominioId!, 'em_fila_execucao'),
    enabled: !!condominioId,
  })
  const todosQ = useQuery({
    queryKey: ['compromissos', condominioId],
    queryFn: () => listarCompromissos(condominioId!),
    enabled: !!condominioId && tab === 'pagamentos',
  })
  const contasQ = useQuery({
    queryKey: ['contas', condominioId],
    queryFn: () => listarContas(condominioId!),
    enabled: !!condominioId,
  })
  const pagQ = useQuery({
    queryKey: ['pagamentos', condominioId, compromissoId],
    queryFn: () => listarPagamentos(condominioId!, compromissoId!),
    enabled: !!condominioId && !!compromissoId,
  })

  const filaOrdenada = useMemo(
    () =>
      [...(filaQ.data ?? [])].sort(
        (a, b) => (a.prioridadeFila ?? 0) - (b.prioridadeFila ?? 0),
      ),
    [filaQ.data],
  )

  const form = useForm<PagForm>({
    resolver: zodResolver(pagSchema),
    defaultValues: { data: new Date().toISOString().slice(0, 10), tipo: 'total' },
  })

  const entrarM = useMutation({
    mutationFn: (id: string) => entrarNaFila(condominioId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compromissos', condominioId] })
    },
  })
  const adiarM = useMutation({
    mutationFn: (id: string) => adiarCompromisso(condominioId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compromissos', condominioId] })
    },
  })
  const reordenarM = useMutation({
    mutationFn: (ids: string[]) => reordenarFila(condominioId!, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compromissos', condominioId] })
    },
  })
  const pagM = useMutation({
    mutationFn: (d: PagForm) =>
      registrarPagamento(condominioId!, compromissoId!, {
        fundoResponsavelId: d.fundoResponsavelId,
        tipo: d.tipo as TipoPagamento,
        valor: d.valor,
        data: d.data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pagamentos', condominioId, compromissoId] })
      qc.invalidateQueries({ queryKey: ['compromissos', condominioId] })
      qc.invalidateQueries({ queryKey: ['area-acerto', condominioId] })
      form.reset({ data: new Date().toISOString().slice(0, 10), tipo: 'total' })
    },
  })

  function mover(idx: number, dir: -1 | 1) {
    const ids = filaOrdenada.map((c) => c.id)
    const j = idx + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[idx], ids[j]] = [ids[j], ids[idx]]
    reordenarM.mutate(ids)
  }

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Pagamentos e Fila</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1>Pagamentos e Fila de Execução</h1>
        <p>RF11 · RF13 — fila 100% manual (RN11)</p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn ${tab === 'fila' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('fila')}
        >
          Fila
        </button>
        <button
          type="button"
          className={`btn ${tab === 'pagamentos' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('pagamentos')}
        >
          Registrar pagamento
        </button>
      </div>

      {tab === 'fila' && (
        <div className="card">
          <h3 style={{ marginBottom: '0.75rem' }}>Fila de execução</h3>
          {filaQ.isLoading && <p className="muted">Carregando…</p>}
          {filaOrdenada.length === 0 && (
            <p className="muted">Nenhum compromisso na fila. Use Compromissos → Entrar na fila.</p>
          )}
          <ul style={{ listStyle: 'none', display: 'grid', gap: '0.5rem' }}>
            {filaOrdenada.map((c, idx) => (
              <li
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span>
                  <span className="badge" style={{ marginRight: '0.5rem' }}>
                    #{c.prioridadeFila ?? idx + 1}
                  </span>
                  {c.categoria} — {formatMoney(c.valorAprovado)}
                  <span className="muted" style={{ marginLeft: '0.5rem' }}>
                    saldo {formatMoney(c.saldoRemanescente)}
                  </span>
                </span>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={idx === 0 || reordenarM.isPending}
                    onClick={() => mover(idx, -1)}
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={idx === filaOrdenada.length - 1 || reordenarM.isPending}
                    onClick={() => mover(idx, 1)}
                    title="Descer"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={adiarM.isPending}
                    onClick={() => adiarM.mutate(c.id)}
                  >
                    Adiar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setCompromissoId(c.id)
                      setTab('pagamentos')
                    }}
                  >
                    Pagar
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <ErroApi error={reordenarM.error} />
          <ErroApi error={adiarM.error} />
        </div>
      )}

      {tab === 'pagamentos' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Compromisso</h3>
            <select
              className="input"
              value={compromissoId ?? ''}
              onChange={(e) => setCompromissoId(e.target.value || null)}
            >
              <option value="">Selecione</option>
              {(todosQ.data ?? filaOrdenada)
                .filter((c) =>
                  ['aguardando_execucao', 'em_fila_execucao', 'em_execucao'].includes(c.status),
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.categoria} — {formatMoney(c.saldoRemanescente)} (
                    {STATUS_COMPROMISSO_LABEL[c.status as StatusCompromisso]})
                  </option>
                ))}
            </select>
            {(todosQ.data ?? [])
              .filter((c) => c.status === 'aguardando_execucao')
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: '0.5rem', marginRight: '0.35rem' }}
                  disabled={entrarM.isPending}
                  onClick={() => entrarM.mutate(c.id)}
                >
                  Entrar na fila: {c.categoria}
                </button>
              ))}
          </div>

          {compromissoId && (
            <>
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Pagamentos registrados</h3>
                {pagQ.data?.length === 0 && <p className="muted">Nenhum pagamento.</p>}
                <ul style={{ listStyle: 'none' }}>
                  {pagQ.data?.map((p) => (
                    <li key={p.id} style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--color-border)' }}>
                      {TIPO_PAGAMENTO_LABEL[p.tipo]} — {formatMoney(p.valor)} em {p.data}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <h3 style={{ marginBottom: '0.75rem' }}>Registrar pagamento</h3>
                <form
                  onSubmit={form.handleSubmit((d) => pagM.mutate(d))}
                  style={{ display: 'grid', gap: '0.5rem', maxWidth: 420 }}
                >
                  <select className="input" {...form.register('fundoResponsavelId')}>
                    <option value="">Fundo responsável</option>
                    {contasQ.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} ({formatMoney(c.saldoAtual)})
                      </option>
                    ))}
                  </select>
                  <select className="input" {...form.register('tipo')}>
                    <option value="total">Total</option>
                    <option value="parcela">Parcela</option>
                    <option value="adiantamento">Adiantamento</option>
                    <option value="entrada">Entrada</option>
                  </select>
                  <input className="input" type="number" step="0.01" placeholder="Valor" {...form.register('valor')} />
                  <input className="input" type="date" {...form.register('data')} />
                  <button type="submit" className="btn btn-primary" disabled={pagM.isPending}>
                    Registrar
                  </button>
                  <ErroApi error={pagM.error} />
                </form>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
