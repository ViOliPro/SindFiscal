import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import {
  atualizarFornecedor,
  atualizarNecessidade,
  atualizarSituacaoNecessidade,
  avaliarFornecedor,
  comparativoCotacoes,
  criarFornecedor,
  criarNecessidade,
  listarAuditoria,
  listarCotacoes,
  listarFornecedores,
  listarNecessidades,
  registrarCotacao,
} from '@/services/api'
import {
  PRIORIDADE_LABEL,
  SITUACAO_NECESSIDADE_LABEL,
  type Fornecedor,
  type Necessidade,
  type Prioridade,
  type SituacaoNecessidade,
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

// Situações que podem ser aprovadas/reprovadas/adiadas só via DecisaoController (RF09).
const SITUACOES_EDITAVEIS_DIRETO: SituacaoNecessidade[] = ['em_analise', 'em_orcamento', 'executado']

const necessidadeSchema = z.object({
  descricao: z.string().min(3, 'Descrição é obrigatória'),
  categoria: z.string().min(2, 'Categoria é obrigatória'),
  prioridade: z.enum(['alta', 'media', 'baixa']).optional(),
  escopoTexto: z.string().optional(),
})
type NecessidadeForm = z.infer<typeof necessidadeSchema>

const cotacaoSchema = z.object({
  fornecedorId: z.string().min(1, 'Selecione um fornecedor'),
  valor: z.coerce.number().min(0, 'Valor não pode ser negativo'),
  prazoExecucaoDias: z.string().optional(),
  garantiaDescricao: z.string().optional(),
  condicoesPagamento: z.string().optional(),
  validade: z.string().optional(),
})
type CotacaoForm = z.infer<typeof cotacaoSchema>

const fornecedorSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  categoria: z.string().min(2, 'Categoria é obrigatória'),
})
type FornecedorForm = z.infer<typeof fornecedorSchema>

const avaliacaoSchema = z.object({
  nota: z.coerce.number().min(1, 'Nota mínima é 1').max(5, 'Nota máxima é 5'),
  comentario: z.string().optional(),
})
type AvaliacaoForm = z.infer<typeof avaliacaoSchema>

/** Histórico de auditoria (RF19, Mód. 10) de uma entidade específica. */
function HistoricoAuditoria({
  condominioId,
  entidadeTipo,
  entidadeId,
}: {
  condominioId: string
  entidadeTipo: string
  entidadeId: string
}) {
  const auditoriaQ = useQuery({
    queryKey: ['auditoria', condominioId, entidadeTipo, entidadeId],
    queryFn: () => listarAuditoria(condominioId, { entidadeTipo, entidadeId }),
  })

  if (auditoriaQ.isLoading) return <p className="muted" style={{ fontSize: '0.8rem' }}>Carregando histórico…</p>
  if (!auditoriaQ.data || auditoriaQ.data.length === 0)
    return <p className="muted" style={{ fontSize: '0.8rem' }}>Nenhuma alteração registrada ainda.</p>

  return (
    <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      {auditoriaQ.data.map((r) => (
        <li key={r.id}>
          <span className="muted">{new Date(r.dataHora).toLocaleString('pt-BR')}</span>
          {' — '}
          <strong>{r.usuarioNome}</strong>
          {' — '}
          {r.campoAlterado === '(criação)'
            ? 'criou o registro'
            : `alterou "${r.campoAlterado}"${r.valorAnterior ? ` de "${r.valorAnterior}"` : ''} para "${r.valorNovo}"`}
        </li>
      ))}
    </ul>
  )
}

/** Painel expansível de uma necessidade: cotações, comparativo, edição e auditoria. */
function DetalheNecessidade({
  condominioId,
  necessidade,
  fornecedores,
}: {
  condominioId: string
  necessidade: Necessidade
  fornecedores: Fornecedor[]
}) {
  const qc = useQueryClient()
  const [mostrarHistorico, setMostrarHistorico] = useState(false)

  const invalidarTudo = () => {
    qc.invalidateQueries({ queryKey: ['necessidades', condominioId] })
    qc.invalidateQueries({ queryKey: ['cotacoes', condominioId, necessidade.id] })
    qc.invalidateQueries({ queryKey: ['comparativo-cotacoes', condominioId, necessidade.id] })
    qc.invalidateQueries({ queryKey: ['auditoria', condominioId, 'Necessidade', necessidade.id] })
  }

  const cotacoesQ = useQuery({
    queryKey: ['cotacoes', condominioId, necessidade.id],
    queryFn: () => listarCotacoes(condominioId, necessidade.id),
  })

  const comparativoQ = useQuery({
    queryKey: ['comparativo-cotacoes', condominioId, necessidade.id],
    queryFn: () => comparativoCotacoes(condominioId, necessidade.id),
    enabled: (cotacoesQ.data?.length ?? 0) > 1,
    retry: false,
  })

  const editForm = useForm<NecessidadeForm>({
    resolver: zodResolver(necessidadeSchema),
    defaultValues: {
      descricao: necessidade.descricao,
      categoria: necessidade.categoria,
      prioridade: necessidade.prioridade ?? undefined,
      escopoTexto: necessidade.escopoTexto ?? '',
    },
  })
  const editarM = useMutation({
    mutationFn: (d: NecessidadeForm) =>
      atualizarNecessidade(condominioId, necessidade.id, {
        descricao: d.descricao,
        categoria: d.categoria,
        prioridade: d.prioridade ?? null,
        escopoTexto: d.escopoTexto || null,
      }),
    onSuccess: invalidarTudo,
  })

  const situacaoM = useMutation({
    mutationFn: (situacao: SituacaoNecessidade) =>
      atualizarSituacaoNecessidade(condominioId, necessidade.id, situacao),
    onSuccess: invalidarTudo,
  })

  const cotacaoForm = useForm<CotacaoForm>({ resolver: zodResolver(cotacaoSchema) })
  const registrarCotacaoM = useMutation({
    mutationFn: (d: CotacaoForm) =>
      registrarCotacao(condominioId, necessidade.id, {
        fornecedorId: d.fornecedorId,
        valor: d.valor,
        prazoExecucaoDias: d.prazoExecucaoDias ? Number(d.prazoExecucaoDias) : null,
        garantiaDescricao: d.garantiaDescricao || null,
        condicoesPagamento: d.condicoesPagamento || null,
        validade: d.validade || null,
      }),
    onSuccess: () => {
      invalidarTudo()
      cotacaoForm.reset()
    },
  })

  const podeEditar = SITUACOES_EDITAVEIS_DIRETO.includes(necessidade.situacao)
  const cheapestId = comparativoQ.data?.fornecedorMaisBaratoId

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
      {podeEditar ? (
        <form
          onSubmit={editForm.handleSubmit((d) => editarM.mutate(d))}
          style={{ display: 'grid', gap: '0.6rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'end' }}
        >
          <div className="form-field">
            <label>Descrição</label>
            <input {...editForm.register('descricao')} />
          </div>
          <div className="form-field">
            <label>Categoria</label>
            <input {...editForm.register('categoria')} />
          </div>
          <div className="form-field">
            <label>Prioridade</label>
            <select className="select-condominio" style={{ width: '100%' }} {...editForm.register('prioridade')}>
              <option value="">—</option>
              {(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map((p) => (
                <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label>Escopo do serviço (RN06 — necessário antes da 1ª cotação)</label>
            <input {...editForm.register('escopoTexto')} placeholder="Descreva o escopo comum para comparar as cotações" />
          </div>
          <button type="submit" className="btn btn-ghost" disabled={editarM.isPending}>
            Salvar alterações
          </button>
          <ErroApi error={editarM.error} />
        </form>
      ) : (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Necessidade já decidida — mudanças de escopo agora passam pelo registro de uma nova Decisão (RN09).
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: '0.85rem' }}>Situação:</span>
        <select
          className="select-condominio"
          value={necessidade.situacao}
          onChange={(e) => situacaoM.mutate(e.target.value as SituacaoNecessidade)}
          disabled={situacaoM.isPending}
        >
          {SITUACOES_EDITAVEIS_DIRETO.map((s) => (
            <option key={s} value={s}>{SITUACAO_NECESSIDADE_LABEL[s]}</option>
          ))}
          {!SITUACOES_EDITAVEIS_DIRETO.includes(necessidade.situacao) && (
            <option value={necessidade.situacao}>{SITUACAO_NECESSIDADE_LABEL[necessidade.situacao]}</option>
          )}
        </select>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          Aprovação/reprovação/adiamento são feitos na aba Decisões e Compromissos (RF09).
        </span>
      </div>
      <ErroApi error={situacaoM.error} />

      <div>
        <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
          Cotações (RF07) {comparativoQ.data && `— diferença entre menor e maior: ${formatMoney(comparativoQ.data.diferenca)}`}
        </p>
        {cotacoesQ.isLoading && <p className="muted" style={{ fontSize: '0.85rem' }}>Carregando…</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {cotacoesQ.data?.map((c) => (
            <div
              key={c.id}
              style={{
                padding: '0.6rem 0.75rem',
                background: 'var(--color-surface, transparent)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                fontSize: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span>
                <strong>{c.fornecedorNome}</strong> — {formatMoney(c.valor)}
                {c.prazoExecucaoDias !== null && ` — ${c.prazoExecucaoDias} dias`}
                {c.validade && ` — válida até ${c.validade}`}
              </span>
              {cheapestId === c.fornecedorId && <span className="badge">mais barata</span>}
            </div>
          ))}
          {cotacoesQ.data?.length === 0 && (
            <p className="muted" style={{ fontSize: '0.85rem' }}>Nenhuma cotação registrada ainda.</p>
          )}
        </div>

        {!necessidade.escopoTexto ? (
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Preencha o escopo do serviço acima antes de registrar a primeira cotação (RN06).
          </p>
        ) : (
          podeEditar && (
            <form
              onSubmit={cotacaoForm.handleSubmit((d) => registrarCotacaoM.mutate(d))}
              style={{ marginTop: '0.6rem', display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', alignItems: 'end' }}
            >
              <div className="form-field">
                <label>Fornecedor</label>
                <select className="select-condominio" style={{ width: '100%' }} {...cotacaoForm.register('fornecedorId')}>
                  <option value="">Selecione…</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Valor</label>
                <input type="number" step="0.01" {...cotacaoForm.register('valor')} />
              </div>
              <div className="form-field">
                <label>Prazo (dias)</label>
                <input type="number" {...cotacaoForm.register('prazoExecucaoDias')} />
              </div>
              <div className="form-field">
                <label>Garantia</label>
                <input {...cotacaoForm.register('garantiaDescricao')} />
              </div>
              <div className="form-field">
                <label>Condições de pagamento</label>
                <input {...cotacaoForm.register('condicoesPagamento')} />
              </div>
              <div className="form-field">
                <label>Validade</label>
                <input type="date" {...cotacaoForm.register('validade')} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={registrarCotacaoM.isPending}>
                Registrar cotação
              </button>
              <ErroApi error={cotacaoForm.formState.errors.fornecedorId?.message} />
              <ErroApi error={registrarCotacaoM.error} />
            </form>
          )
        )}
      </div>

      <div>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ fontSize: '0.8rem' }}
          onClick={() => setMostrarHistorico((v) => !v)}
        >
          {mostrarHistorico ? 'Ocultar histórico' : 'Ver histórico (auditoria — RF19)'}
        </button>
        {mostrarHistorico && (
          <div style={{ marginTop: '0.5rem' }}>
            <HistoricoAuditoria condominioId={condominioId} entidadeTipo="Necessidade" entidadeId={necessidade.id} />
          </div>
        )}
      </div>
    </div>
  )
}

function PainelNecessidades({ condominioId }: { condominioId: string }) {
  const qc = useQueryClient()
  const [filtroSituacao, setFiltroSituacao] = useState<SituacaoNecessidade | ''>('')
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  const necessidadesQ = useQuery({
    queryKey: ['necessidades', condominioId, filtroSituacao],
    queryFn: () => listarNecessidades(condominioId, filtroSituacao || undefined),
  })

  const fornecedoresQ = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => listarFornecedores(),
  })

  const criarForm = useForm<NecessidadeForm>({ resolver: zodResolver(necessidadeSchema) })
  const criarM = useMutation({
    mutationFn: (d: NecessidadeForm) =>
      criarNecessidade(condominioId, {
        descricao: d.descricao,
        categoria: d.categoria,
        prioridade: d.prioridade ?? null,
        escopoTexto: d.escopoTexto || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['necessidades', condominioId] })
      criarForm.reset()
    },
  })

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          RF06 — necessidade/previsão. O escopo comum garante comparação justa entre cotações (RN06).
        </p>
        <form
          onSubmit={criarForm.handleSubmit((d) => criarM.mutate(d))}
          style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'end' }}
        >
          <div className="form-field">
            <label>Descrição</label>
            <input {...criarForm.register('descricao')} placeholder="Ex.: Impermeabilização da laje" />
          </div>
          <div className="form-field">
            <label>Categoria</label>
            <input {...criarForm.register('categoria')} placeholder="Ex.: manutencao, obra, servicos…" />
          </div>
          <div className="form-field">
            <label>Prioridade</label>
            <select className="select-condominio" style={{ width: '100%' }} {...criarForm.register('prioridade')}>
              <option value="">—</option>
              {(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map((p) => (
                <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Escopo (opcional agora, obrigatório antes da 1ª cotação)</label>
            <input {...criarForm.register('escopoTexto')} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={criarM.isPending}>
            Registrar necessidade
          </button>
        </form>
        <ErroApi error={criarM.error} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${filtroSituacao === '' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFiltroSituacao('')}
        >
          Todas
        </button>
        {(Object.keys(SITUACAO_NECESSIDADE_LABEL) as SituacaoNecessidade[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`btn ${filtroSituacao === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltroSituacao(s)}
          >
            {SITUACAO_NECESSIDADE_LABEL[s]}
          </button>
        ))}
      </div>

      {necessidadesQ.isLoading && <p className="muted">Carregando…</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {necessidadesQ.data?.map((n) => (
          <div key={n.id} style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong>{n.descricao}</strong>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  {n.categoria}
                  {n.prioridade && ` — prioridade ${PRIORIDADE_LABEL[n.prioridade].toLowerCase()}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className="badge">{SITUACAO_NECESSIDADE_LABEL[n.situacao]}</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => setExpandidoId(expandidoId === n.id ? null : n.id)}
                >
                  {expandidoId === n.id ? 'Ocultar' : 'Detalhar'}
                </button>
              </div>
            </div>
            {expandidoId === n.id && (
              <DetalheNecessidade
                condominioId={condominioId}
                necessidade={n}
                fornecedores={fornecedoresQ.data ?? []}
              />
            )}
          </div>
        ))}
        {necessidadesQ.data?.length === 0 && (
          <p className="muted" style={{ padding: '1rem 0' }}>Nenhuma necessidade encontrada.</p>
        )}
      </div>
    </div>
  )
}

function PainelFornecedores() {
  const qc = useQueryClient()
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [avaliandoId, setAvaliandoId] = useState<string | null>(null)

  const fornecedoresQ = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => listarFornecedores(),
  })

  const criarForm = useForm<FornecedorForm>({ resolver: zodResolver(fornecedorSchema) })
  const criarM = useMutation({
    mutationFn: (d: FornecedorForm) => criarFornecedor(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] })
      criarForm.reset()
    },
  })

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          RF08, RN04 — fornecedor é compartilhado entre todos os condomínios que você administra.
        </p>
        <form
          onSubmit={criarForm.handleSubmit((d) => criarM.mutate(d))}
          style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'end' }}
        >
          <div className="form-field">
            <label>Nome</label>
            <input {...criarForm.register('nome')} placeholder="Ex.: Construtora Silva Ltda." />
          </div>
          <div className="form-field">
            <label>Categoria</label>
            <input {...criarForm.register('categoria')} placeholder="Ex.: obras, elevadores, jardinagem…" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={criarM.isPending}>
            Cadastrar fornecedor
          </button>
        </form>
        <ErroApi error={criarM.error} />
      </div>

      {fornecedoresQ.isLoading && <p className="muted">Carregando…</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {fornecedoresQ.data?.map((f) => (
          <FornecedorCard
            key={f.id}
            fornecedor={f}
            editando={editandoId === f.id}
            avaliando={avaliandoId === f.id}
            onToggleEditar={() => setEditandoId(editandoId === f.id ? null : f.id)}
            onToggleAvaliar={() => setAvaliandoId(avaliandoId === f.id ? null : f.id)}
          />
        ))}
        {fornecedoresQ.data?.length === 0 && (
          <p className="muted" style={{ padding: '1rem 0' }}>Nenhum fornecedor cadastrado ainda.</p>
        )}
      </div>
    </div>
  )
}

function FornecedorCard({
  fornecedor,
  editando,
  avaliando,
  onToggleEditar,
  onToggleAvaliar,
}: {
  fornecedor: Fornecedor
  editando: boolean
  avaliando: boolean
  onToggleEditar: () => void
  onToggleAvaliar: () => void
}) {
  const qc = useQueryClient()

  const editForm = useForm<FornecedorForm>({
    resolver: zodResolver(fornecedorSchema),
    defaultValues: { nome: fornecedor.nome, categoria: fornecedor.categoria },
  })
  const editarM = useMutation({
    mutationFn: (d: FornecedorForm) => atualizarFornecedor(fornecedor.id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] })
      onToggleEditar()
    },
  })

  const avaliacaoForm = useForm<AvaliacaoForm>({
    resolver: zodResolver(avaliacaoSchema),
    defaultValues: { nota: fornecedor.avaliacaoNota ?? 5, comentario: fornecedor.avaliacaoComentario ?? '' },
  })
  const avaliarM = useMutation({
    mutationFn: (d: AvaliacaoForm) =>
      avaliarFornecedor(fornecedor.id, { nota: d.nota, comentario: d.comentario || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] })
      onToggleAvaliar()
    },
  })

  return (
    <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <strong>{fornecedor.nome}</strong>
          <div className="muted" style={{ fontSize: '0.8rem' }}>
            {fornecedor.categoria}
            {fornecedor.avaliacaoNota && ` — ${'★'.repeat(fornecedor.avaliacaoNota)}${'☆'.repeat(5 - fornecedor.avaliacaoNota)}`}
          </div>
          {fornecedor.avaliacaoComentario && (
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>"{fornecedor.avaliacaoComentario}"</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={onToggleAvaliar}>
            {avaliando ? 'Cancelar' : 'Avaliar'}
          </button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={onToggleEditar}>
            {editando ? 'Cancelar' : 'Editar'}
          </button>
        </div>
      </div>

      {editando && (
        <form
          onSubmit={editForm.handleSubmit((d) => editarM.mutate(d))}
          style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', alignItems: 'end' }}
        >
          <div className="form-field">
            <label>Nome</label>
            <input {...editForm.register('nome')} />
          </div>
          <div className="form-field">
            <label>Categoria</label>
            <input {...editForm.register('categoria')} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={editarM.isPending}>
            Salvar
          </button>
          <ErroApi error={editarM.error} />
        </form>
      )}

      {avaliando && (
        <form
          onSubmit={avaliacaoForm.handleSubmit((d) => avaliarM.mutate(d))}
          style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', alignItems: 'end' }}
        >
          <div className="form-field">
            <label>Nota (1 a 5)</label>
            <select className="select-condominio" style={{ width: '100%' }} {...avaliacaoForm.register('nota')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ gridColumn: 'span 2' }}>
            <label>Comentário</label>
            <input {...avaliacaoForm.register('comentario')} placeholder="Ex.: cumpriu prazo, bom acabamento…" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={avaliarM.isPending}>
            Salvar avaliação
          </button>
          <ErroApi error={avaliarM.error} />
        </form>
      )}
    </div>
  )
}

export function NecessidadesPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const [painel, setPainel] = useState<'necessidades' | 'fornecedores'>('necessidades')

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Necessidades, Cotações e Fornecedores</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1>Necessidades, Cotações e Fornecedores</h1>
        <p>RF06 / RF07 / RF08 — necessidades, cotações comparadas e fornecedores compartilhados</p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          type="button"
          className={`btn ${painel === 'necessidades' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setPainel('necessidades')}
        >
          Necessidades e Cotações
        </button>
        <button
          type="button"
          className={`btn ${painel === 'fornecedores' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setPainel('fornecedores')}
        >
          Fornecedores
        </button>
      </div>

      {painel === 'necessidades' && <PainelNecessidades condominioId={condominioId} />}
      {painel === 'fornecedores' && <PainelFornecedores />}
    </div>
  )
}
