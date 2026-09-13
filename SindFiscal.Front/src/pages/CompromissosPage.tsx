import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import {
  ajustarValorCompromisso,
  adiarCompromisso,
  cancelarCompromisso,
  criarCompromissoAvulso,
  entrarNaFila,
  listarCompromissos,
  listarDecisoes,
  obterCompromisso,
  registrarDecisao,
  vincularGasto,
} from '@/services/api'
import {
  RESULTADO_DECISAO_LABEL,
  STATUS_COMPROMISSO_LABEL,
  type ResultadoDecisao,
  type StatusCompromisso,
} from '@/types'
import { useCondominioStore } from '@/stores/condominioStore'
import { ApiError } from '@/lib/api'

function formatMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const avulsoSchema = z.object({
  categoria: z.string().min(2, 'Informe a categoria'),
  valorAprovado: z.coerce.number().min(0, 'Valor não pode ser negativo'),
})
type AvulsoForm = z.infer<typeof avulsoSchema>

const gastoSchema = z.object({
  categoria: z.string().min(2, 'Informe a categoria'),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
})
type GastoForm = z.infer<typeof gastoSchema>

const ajusteSchema = z.object({
  novoValor: z.coerce.number().min(0, 'Valor não pode ser negativo'),
  motivo: z.string().min(3, 'Motivo é obrigatório (RN09)'),
})
type AjusteForm = z.infer<typeof ajusteSchema>

const decisaoSchema = z.object({
  necessidadeId: z.string().uuid('Informe o ID (uuid) da necessidade'),
  cotacaoEscolhidaId: z.string().optional(),
  resultado: z.enum(['aprovado', 'reprovado', 'adiado']),
  justificativa: z.string().optional(),
  referenciaRespaldo: z.string().optional(),
  data: z.string().min(1),
})
type DecisaoForm = z.infer<typeof decisaoSchema>

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

function badgeStatus(status: StatusCompromisso) {
  return <span className="badge">{STATUS_COMPROMISSO_LABEL[status] ?? status}</span>
}

/** Painel expansível de detalhe de um compromisso: gastos vinculados, pagamentos e ações. */
function DetalheCompromisso({
  condominioId,
  compromissoId,
}: {
  condominioId: string
  compromissoId: string
}) {
  const qc = useQueryClient()

  const detalheQ = useQuery({
    queryKey: ['compromisso', condominioId, compromissoId],
    queryFn: () => obterCompromisso(condominioId, compromissoId),
  })

  const invalidarTudo = () => {
    qc.invalidateQueries({ queryKey: ['compromissos', condominioId] })
    qc.invalidateQueries({ queryKey: ['compromisso', condominioId, compromissoId] })
  }

  const gastoForm = useForm<GastoForm>({ resolver: zodResolver(gastoSchema) })
  const vincularM = useMutation({
    mutationFn: (d: GastoForm) => vincularGasto(condominioId, compromissoId, d),
    onSuccess: () => {
      invalidarTudo()
      gastoForm.reset()
    },
  })

  const ajusteForm = useForm<AjusteForm>({ resolver: zodResolver(ajusteSchema) })
  const ajustarM = useMutation({
    mutationFn: (d: AjusteForm) =>
      ajustarValorCompromisso(condominioId, compromissoId, d.novoValor, d.motivo),
    onSuccess: () => {
      invalidarTudo()
      ajusteForm.reset()
    },
  })

  const cancelarM = useMutation({
    mutationFn: () => cancelarCompromisso(condominioId, compromissoId, 'Cancelado pelo síndico'),
    onSuccess: invalidarTudo,
  })

  const entrarFilaM = useMutation({
    mutationFn: () => entrarNaFila(condominioId, compromissoId),
    onSuccess: invalidarTudo,
  })

  const adiarM = useMutation({
    mutationFn: () => adiarCompromisso(condominioId, compromissoId),
    onSuccess: invalidarTudo,
  })

  if (detalheQ.isLoading) return <p className="muted">Carregando detalhe…</p>
  if (!detalheQ.data) return null

  const { compromisso, gastosVinculados, pagamentos } = detalheQ.data
  const podeAjustarOuCancelar = compromisso.status !== 'cancelado' && compromisso.status !== 'concluido'
  const ehGastoVinculado = compromisso.compromissoPaiId !== null

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
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
        <span>Gastos vinculados: <strong>{formatMoney(compromisso.totalGastosVinculados)}</strong></span>
        <span>Total pago: <strong>{formatMoney(compromisso.totalPago)}</strong></span>
        <span>Saldo remanescente: <strong>{formatMoney(compromisso.saldoRemanescente)}</strong></span>
        {compromisso.requerValidacaoConselho && (
          <span className="badge" title="Valor atinge a alçada configurada para este condomínio (RF10/RN07)">
            requer validação do Conselho Fiscal
          </span>
        )}
      </div>

      {gastosVinculados.length > 0 && (
        <div>
          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
            Gastos vinculados (RF12)
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
            {gastosVinculados.map((g) => (
              <li key={g.id}>
                {g.categoria} — {formatMoney(g.valor)} ({STATUS_COMPROMISSO_LABEL[g.status]})
              </li>
            ))}
          </ul>
        </div>
      )}

      {pagamentos.length > 0 && (
        <div>
          <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
            Pagamentos (RF11)
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
            {pagamentos.map((p) => (
              <li key={p.id}>
                {p.data} — {p.tipo} — {formatMoney(p.valor)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!ehGastoVinculado && podeAjustarOuCancelar && compromisso.status !== 'em_fila_execucao' && (
        <form
          onSubmit={gastoForm.handleSubmit((d) => vincularM.mutate(d))}
          style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', alignItems: 'end' }}
        >
          <div className="form-field">
            <label>Vincular gasto — categoria</label>
            <input {...gastoForm.register('categoria')} placeholder="Ex.: Material extra" />
          </div>
          <div className="form-field">
            <label>Valor</label>
            <input type="number" step="0.01" {...gastoForm.register('valor')} />
          </div>
          <button type="submit" className="btn btn-ghost" disabled={vincularM.isPending}>
            Vincular (RF12)
          </button>
          <ErroApi error={vincularM.error} />
        </form>
      )}

      {podeAjustarOuCancelar && (
        <form
          onSubmit={ajusteForm.handleSubmit((d) => ajustarM.mutate(d))}
          style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', alignItems: 'end' }}
        >
          <div className="form-field">
            <label>Ajustar valor aprovado</label>
            <input type="number" step="0.01" defaultValue={compromisso.valorAprovado} {...ajusteForm.register('novoValor')} />
          </div>
          <div className="form-field" style={{ gridColumn: 'span 2' }}>
            <label>Motivo (RN09/RN10)</label>
            <input {...ajusteForm.register('motivo')} placeholder="Ex.: troca de material aprovada em obra" />
          </div>
          <button type="submit" className="btn btn-ghost" disabled={ajustarM.isPending}>
            Salvar ajuste
          </button>
          <ErroApi error={ajusteForm.formState.errors.motivo?.message} />
          <ErroApi error={ajustarM.error} />
        </form>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {compromisso.status === 'aguardando_execucao' && (
          <button type="button" className="btn btn-primary" onClick={() => entrarFilaM.mutate()} disabled={entrarFilaM.isPending}>
            Entrar na fila de execução
          </button>
        )}
        {compromisso.status === 'em_fila_execucao' && (
          <button type="button" className="btn btn-ghost" onClick={() => adiarM.mutate()} disabled={adiarM.isPending}>
            Adiar (RN12)
          </button>
        )}
        {podeAjustarOuCancelar && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ color: 'var(--color-danger, #c0392b)' }}
            onClick={() => cancelarM.mutate()}
            disabled={cancelarM.isPending}
          >
            Cancelar compromisso (RN12)
          </button>
        )}
      </div>
      <ErroApi error={cancelarM.error} />
    </div>
  )
}

function PainelCompromissos({ condominioId }: { condominioId: string }) {
  const qc = useQueryClient()
  const [filtroStatus, setFiltroStatus] = useState<StatusCompromisso | ''>('')
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  const compromissosQ = useQuery({
    queryKey: ['compromissos', condominioId, filtroStatus],
    queryFn: () => listarCompromissos(condominioId, filtroStatus || undefined),
  })

  const avulsoForm = useForm<AvulsoForm>({ resolver: zodResolver(avulsoSchema) })
  const criarAvulsoM = useMutation({
    mutationFn: (d: AvulsoForm) => criarCompromissoAvulso(condominioId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compromissos', condominioId] })
      avulsoForm.reset()
    },
  })

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          RN15 — compromisso avulso, sem necessidade formal associada.
        </p>
        <form
          onSubmit={avulsoForm.handleSubmit((d) => criarAvulsoM.mutate(d))}
          style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'end' }}
        >
          <div className="form-field">
            <label>Categoria</label>
            <input {...avulsoForm.register('categoria')} placeholder="Ex.: Manutenção elevador" />
          </div>
          <div className="form-field">
            <label>Valor aprovado</label>
            <input type="number" step="0.01" {...avulsoForm.register('valorAprovado')} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={criarAvulsoM.isPending}>
            Criar compromisso avulso
          </button>
        </form>
        <ErroApi error={criarAvulsoM.error} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${filtroStatus === '' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFiltroStatus('')}
        >
          Todos
        </button>
        {(Object.keys(STATUS_COMPROMISSO_LABEL) as StatusCompromisso[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`btn ${filtroStatus === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltroStatus(s)}
          >
            {STATUS_COMPROMISSO_LABEL[s]}
          </button>
        ))}
      </div>

      {compromissosQ.isLoading && <p className="muted">Carregando…</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {compromissosQ.data?.map((c) => (
          <div key={c.id} style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong>{c.categoria}</strong>{' '}
                {c.compromissoPaiId && <span className="muted" style={{ fontSize: '0.8rem' }}>(gasto vinculado)</span>}
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {formatMoney(c.valorAprovado)}
                  {c.prioridadeFila !== null && ` — posição na fila: ${c.prioridadeFila}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {badgeStatus(c.status)}
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => setExpandidoId(expandidoId === c.id ? null : c.id)}
                >
                  {expandidoId === c.id ? 'Ocultar' : 'Detalhar'}
                </button>
              </div>
            </div>
            {expandidoId === c.id && <DetalheCompromisso condominioId={condominioId} compromissoId={c.id} />}
          </div>
        ))}
        {compromissosQ.data?.length === 0 && (
          <p className="muted" style={{ padding: '1rem 0' }}>Nenhum compromisso encontrado.</p>
        )}
      </div>
    </div>
  )
}

function PainelDecisoes({ condominioId }: { condominioId: string }) {
  const [necessidadeId, setNecessidadeId] = useState('')
  const qc = useQueryClient()

  const decisoesQ = useQuery({
    queryKey: ['decisoes', condominioId, necessidadeId],
    queryFn: () => listarDecisoes(condominioId, necessidadeId),
    enabled: !!necessidadeId && z.string().uuid().safeParse(necessidadeId).success,
  })

  const form = useForm<DecisaoForm>({
    resolver: zodResolver(decisaoSchema),
    defaultValues: { resultado: 'aprovado', data: new Date().toISOString().slice(0, 10) },
  })

  const registrarM = useMutation({
    mutationFn: (d: DecisaoForm) =>
      registrarDecisao(condominioId, d.necessidadeId, {
        cotacaoEscolhidaId: d.cotacaoEscolhidaId || null,
        resultado: d.resultado as ResultadoDecisao,
        justificativa: d.justificativa,
        referenciaRespaldo: d.referenciaRespaldo,
        data: d.data,
      }),
    onSuccess: (_, vars) => {
      setNecessidadeId(vars.necessidadeId)
      qc.invalidateQueries({ queryKey: ['decisoes', condominioId, vars.necessidadeId] })
      qc.invalidateQueries({ queryKey: ['compromissos', condominioId] })
    },
  })

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        RF09 — decisão como evento histórico. Aprovar gera automaticamente o compromisso financeiro (RF10).
        O módulo de Necessidades/Cotações ainda não tem tela própria — informe o ID (uuid) da necessidade abaixo.
      </p>

      <form
        onSubmit={form.handleSubmit((d) => registrarM.mutate(d))}
        style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'end' }}
      >
        <div className="form-field">
          <label>ID da necessidade</label>
          <input {...form.register('necessidadeId')} placeholder="uuid" />
        </div>
        <div className="form-field">
          <label>Cotação escolhida (opcional)</label>
          <input {...form.register('cotacaoEscolhidaId')} placeholder="uuid" />
        </div>
        <div className="form-field">
          <label>Resultado</label>
          <select className="select-condominio" style={{ width: '100%' }} {...form.register('resultado')}>
            {(Object.keys(RESULTADO_DECISAO_LABEL) as ResultadoDecisao[]).map((r) => (
              <option key={r} value={r}>{RESULTADO_DECISAO_LABEL[r]}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Data</label>
          <input type="date" {...form.register('data')} />
        </div>
        <div className="form-field">
          <label>Justificativa</label>
          <input {...form.register('justificativa')} />
        </div>
        <div className="form-field">
          <label>Referência (ata/assembleia)</label>
          <input {...form.register('referenciaRespaldo')} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={registrarM.isPending}>
          Registrar decisão
        </button>
      </form>
      <ErroApi error={form.formState.errors.necessidadeId?.message} />
      <ErroApi error={registrarM.error} />

      <div className="form-field">
        <label>Ver histórico de decisões da necessidade</label>
        <input value={necessidadeId} onChange={(e) => setNecessidadeId(e.target.value)} placeholder="uuid da necessidade" />
      </div>

      {decisoesQ.isLoading && <p className="muted">Carregando…</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {decisoesQ.data?.map((d) => (
          <div key={d.id} style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{RESULTADO_DECISAO_LABEL[d.resultado]}</strong>
              <span className="muted">{d.data}</span>
            </div>
            {d.justificativa && <p className="muted" style={{ marginTop: '0.25rem' }}>{d.justificativa}</p>}
            {d.referenciaRespaldo && <p className="muted">Ref.: {d.referenciaRespaldo}</p>}
          </div>
        ))}
        {necessidadeId && decisoesQ.data?.length === 0 && (
          <p className="muted">Nenhuma decisão registrada para esta necessidade ainda.</p>
        )}
      </div>
    </div>
  )
}

export function CompromissosPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const [painel, setPainel] = useState<'compromissos' | 'decisoes'>('compromissos')

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Decisões e Compromissos</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1>Decisões e Compromissos</h1>
        <p>RF09 / RF10 / RF12 — decisões, compromissos financeiros e gastos vinculados</p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          type="button"
          className={`btn ${painel === 'compromissos' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setPainel('compromissos')}
        >
          Compromissos
        </button>
        <button
          type="button"
          className={`btn ${painel === 'decisoes' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setPainel('decisoes')}
        >
          Decisões
        </button>
      </div>

      {painel === 'compromissos' && <PainelCompromissos condominioId={condominioId} />}
      {painel === 'decisoes' && <PainelDecisoes condominioId={condominioId} />}
    </div>
  )
}
