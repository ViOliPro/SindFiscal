import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { fecharPeriodoReservas, listarContas, listarReservas, registrarReserva } from '@/services/api'
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

const reservaSchema = z.object({
  fundoDestinoId: z.string().min(1, 'Selecione um fundo'),
  unidade: z.string().min(1, 'Informe a unidade'),
  moradorNome: z.string().min(2, 'Informe o nome do morador'),
  valorDestinadoAoFundo: z.coerce.number().min(0.01, 'Valor deve ser positivo'),
  pagoComDesconto: z.boolean().optional(),
  periodoReferencia: z.string().min(1, 'Informe o período (mês de referência)'),
})
type ReservaForm = z.infer<typeof reservaSchema>

const fecharPeriodoSchema = z.object({
  fundoDestinoId: z.string().min(1, 'Selecione um fundo'),
  periodoReferencia: z.string().min(1, 'Informe o período'),
})
type FecharPeriodoForm = z.infer<typeof fecharPeriodoSchema>

export function ReservasPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const qc = useQueryClient()

  const contasQ = useQuery({
    queryKey: ['contas', condominioId],
    queryFn: () => listarContas(condominioId!),
    enabled: !!condominioId,
  })
  const reservasQ = useQuery({
    queryKey: ['reservas', condominioId],
    queryFn: () => listarReservas(condominioId!),
    enabled: !!condominioId,
  })

  const criarForm = useForm<ReservaForm>({ resolver: zodResolver(reservaSchema) })
  const criarM = useMutation({
    mutationFn: (d: ReservaForm) =>
      registrarReserva(condominioId!, {
        fundoDestinoId: d.fundoDestinoId,
        unidade: d.unidade,
        moradorNome: d.moradorNome,
        valorDestinadoAoFundo: d.valorDestinadoAoFundo,
        pagoComDesconto: d.pagoComDesconto ?? null,
        // <input type="month"> retorna "YYYY-MM"; backend espera DateOnly completo.
        periodoReferencia: `${d.periodoReferencia}-01`,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservas', condominioId] })
      criarForm.reset()
    },
  })

  const fecharForm = useForm<FecharPeriodoForm>({ resolver: zodResolver(fecharPeriodoSchema) })
  const [ultimoResultado, setUltimoResultado] = useState<string | null>(null)
  const fecharM = useMutation({
    mutationFn: (d: FecharPeriodoForm) =>
      fecharPeriodoReservas(condominioId!, d.fundoDestinoId, `${d.periodoReferencia}-01`),
    onSuccess: (transferencia) => {
      qc.invalidateQueries({ queryKey: ['reservas', condominioId] })
      qc.invalidateQueries({ queryKey: ['area-de-acerto', condominioId] })
      setUltimoResultado(
        `Item de destinação de receita gerado: ${formatMoney(transferencia.valor)} (${transferencia.contaOrigemNome} → ${transferencia.contaDestinoNome}) — veja na Área de Acerto.`,
      )
    },
  })

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Reservas de Área Comum</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1>Reservas de Área Comum</h1>
        <p>RF21, RN22, RN23 — registro manual (ex.: espaço gourmet), sem substituir o app de reservas dos moradores</p>
      </header>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          Valor destinado ao fundo é o valor líquido da reserva (RN23) — não muda em função do desconto de pontualidade.
        </p>
        <form
          onSubmit={criarForm.handleSubmit((d) => criarM.mutate(d))}
          style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', alignItems: 'end' }}
        >
          <div className="form-field">
            <label>Fundo de destino</label>
            <select className="select-condominio" style={{ width: '100%' }} {...criarForm.register('fundoDestinoId')}>
              <option value="">Selecione…</option>
              {contasQ.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Unidade</label>
            <input {...criarForm.register('unidade')} placeholder="Ex.: 102" />
          </div>
          <div className="form-field">
            <label>Morador</label>
            <input {...criarForm.register('moradorNome')} />
          </div>
          <div className="form-field">
            <label>Valor líquido</label>
            <input type="number" step="0.01" {...criarForm.register('valorDestinadoAoFundo')} />
          </div>
          <div className="form-field">
            <label>Período de referência</label>
            <input type="month" {...criarForm.register('periodoReferencia')} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <input type="checkbox" {...criarForm.register('pagoComDesconto')} />
            Pago com desconto de pontualidade (informativo)
          </label>
          <button type="submit" className="btn btn-primary" disabled={criarM.isPending}>
            Registrar reserva
          </button>
        </form>
        <ErroApi error={criarM.error} />
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Fechar período (RF14c — destinação de receita)</h3>
        <form
          onSubmit={fecharForm.handleSubmit((d) => fecharM.mutate(d))}
          style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}
        >
          <div className="form-field">
            <label>Fundo</label>
            <select className="select-condominio" style={{ width: '100%' }} {...fecharForm.register('fundoDestinoId')}>
              <option value="">Selecione…</option>
              {contasQ.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Período</label>
            <input type="month" {...fecharForm.register('periodoReferencia')} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={fecharM.isPending}>
            Fechar período e gerar item de destinação
          </button>
        </form>
        {ultimoResultado && <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>{ultimoResultado}</p>}
        <ErroApi error={fecharM.error} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Reservas registradas</h3>
        {reservasQ.isLoading && <p className="muted">Carregando…</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {reservasQ.data?.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                fontSize: '0.85rem',
                flexWrap: 'wrap',
                gap: '0.4rem',
              }}
            >
              <span>
                Unidade {r.unidade} — {r.moradorNome} — {r.periodoReferencia}
                {r.pagoComDesconto && ' — com desconto'}
              </span>
              <strong>{formatMoney(r.valorDestinadoAoFundo)}</strong>
            </div>
          ))}
          {reservasQ.data?.length === 0 && <p className="muted">Nenhuma reserva registrada ainda.</p>}
        </div>
      </div>
    </div>
  )
}
