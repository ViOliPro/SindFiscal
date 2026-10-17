import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  avaliarFornecedor,
  comparativoCotacoes,
  criarFornecedor,
  criarNecessidade,
  listarCotacoes,
  listarDecisoes,
  listarFornecedores,
  listarNecessidades,
  registrarCotacao,
  registrarDecisao,
} from '@/services/api'
import {
  PRIORIDADE_LABEL,
  SITUACAO_NECESSIDADE_LABEL,
  type Prioridade,
  type SituacaoNecessidade,
} from '@/types'
import { useCondominioStore } from '@/stores/condominioStore'

function formatMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ErroApi({ error }: { error: unknown }) {
  if (!error) return null
  const msg =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Erro'
  return (
    <p className="muted" style={{ color: 'var(--color-danger)' }}>
      {msg}
    </p>
  )
}

const necSchema = z.object({
  descricao: z.string().min(3),
  categoria: z.string().min(2),
  prioridade: z.enum(['alta', 'media', 'baixa']).optional(),
  escopoTexto: z.string().optional(),
})
const fornSchema = z.object({
  nome: z.string().min(2),
  categoria: z.string().min(2),
  telefone: z.string().optional(),
  email: z.string().optional(),
  observacoes: z.string().optional(),
})
const cotSchema = z.object({
  fornecedorId: z.string().min(1),
  valor: z.coerce.number().positive(),
  prazoExecucaoDias: z.coerce.number().int().positive().optional(),
  garantiaDescricao: z.string().optional(),
  condicoesPagamento: z.string().optional(),
  validade: z.string().optional(),
})

type NecForm = z.infer<typeof necSchema>
type FornForm = z.infer<typeof fornSchema>
type CotForm = z.infer<typeof cotSchema>

/** Filtros da lista — padrão foca no que ainda precisa de ação. */
type FiltroSituacao = 'ativas' | SituacaoNecessidade | 'todas'

const FILTROS: { id: FiltroSituacao; label: string }[] = [
  { id: 'ativas', label: 'Em aberto' },
  { id: 'em_analise', label: 'Em análise' },
  { id: 'em_orcamento', label: 'Em orçamento' },
  { id: 'aprovado', label: 'Aprovadas' },
  { id: 'reprovado', label: 'Reprovadas' },
  { id: 'adiado', label: 'Adiadas' },
  { id: 'todas', label: 'Todas' },
]

function badgePrioridade(p: Prioridade | null | undefined) {
  if (!p) return null
  const cor =
    p === 'alta' ? '#c0392b' : p === 'media' ? '#d68910' : 'var(--color-muted, #888)'
  return (
    <span
      className="badge"
      style={{ background: cor, color: '#fff', fontSize: '0.7rem', flexShrink: 0 }}
    >
      {PRIORIDADE_LABEL[p]}
    </span>
  )
}

export function NecessidadesPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const qc = useQueryClient()
  const [tab, setTab] = useState<'necessidades' | 'fornecedores'>('necessidades')
  const [selecionada, setSelecionada] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroSituacao>('ativas')
  const [novaAberta, setNovaAberta] = useState(false)
  const [msgAprovacao, setMsgAprovacao] = useState<string | null>(null)

  const necQ = useQuery({
    queryKey: ['necessidades', condominioId],
    queryFn: () => listarNecessidades(condominioId!),
    enabled: !!condominioId && tab === 'necessidades',
  })
  const fornQ = useQuery({
    queryKey: ['fornecedores'],
    queryFn: listarFornecedores,
    enabled: tab === 'fornecedores' || !!selecionada,
  })
  const cotQ = useQuery({
    queryKey: ['cotacoes', condominioId, selecionada],
    queryFn: () => listarCotacoes(condominioId!, selecionada!),
    enabled: !!condominioId && !!selecionada,
  })
  const compQ = useQuery({
    queryKey: ['comparativo', condominioId, selecionada],
    queryFn: () => comparativoCotacoes(condominioId!, selecionada!),
    enabled: !!condominioId && !!selecionada,
  })
  /** Histórico de decisões para saber qual cotação foi escolhida (badge correto). */
  const decisoesQ = useQuery({
    queryKey: ['decisoes', condominioId, selecionada],
    queryFn: () => listarDecisoes(condominioId!, selecionada!),
    enabled: !!condominioId && !!selecionada,
  })

  const cotacaoEscolhidaId = useMemo(() => {
    const aprovada = decisoesQ.data?.find((d) => d.resultado === 'aprovado' && d.cotacaoEscolhidaId)
    return aprovada?.cotacaoEscolhidaId ?? null
  }, [decisoesQ.data])

  const listaFiltrada = useMemo(() => {
    const all = necQ.data ?? []
    if (filtro === 'todas') return all
    if (filtro === 'ativas')
      return all.filter((n) => n.situacao === 'em_analise' || n.situacao === 'em_orcamento')
    return all.filter((n) => n.situacao === filtro)
  }, [necQ.data, filtro])

  const necForm = useForm<NecForm>({ resolver: zodResolver(necSchema) })
  const fornForm = useForm<FornForm>({ resolver: zodResolver(fornSchema) })
  const cotForm = useForm<CotForm>({ resolver: zodResolver(cotSchema) })

  const criarNecM = useMutation({
    mutationFn: (d: NecForm) =>
      criarNecessidade(condominioId!, {
        descricao: d.descricao,
        categoria: d.categoria,
        prioridade: d.prioridade as Prioridade | undefined,
        escopoTexto: d.escopoTexto,
      }),
    onSuccess: (criada) => {
      qc.invalidateQueries({ queryKey: ['necessidades', condominioId] })
      necForm.reset()
      setNovaAberta(false)
      if (criada?.id) setSelecionada(criada.id)
    },
  })
  const criarFornM = useMutation({
    mutationFn: (d: FornForm) =>
      criarFornecedor({
        nome: d.nome,
        categoria: d.categoria,
        telefone: d.telefone || undefined,
        email: d.email || undefined,
        observacoes: d.observacoes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] })
      fornForm.reset()
    },
  })
  const cotM = useMutation({
    mutationFn: (d: CotForm) =>
      registrarCotacao(condominioId!, selecionada!, {
        fornecedorId: d.fornecedorId,
        valor: d.valor,
        prazoExecucaoDias: d.prazoExecucaoDias,
        garantiaDescricao: d.garantiaDescricao,
        condicoesPagamento: d.condicoesPagamento,
        validade: d.validade || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cotacoes', condominioId, selecionada] })
      qc.invalidateQueries({ queryKey: ['comparativo', condominioId, selecionada] })
      qc.invalidateQueries({ queryKey: ['necessidades', condominioId] })
      cotForm.reset()
    },
  })
  const decisaoM = useMutation({
    mutationFn: (cotacaoId: string) =>
      registrarDecisao(condominioId!, selecionada!, {
        cotacaoEscolhidaId: cotacaoId,
        resultado: 'aprovado',
        data: new Date().toISOString().slice(0, 10),
        justificativa: 'Aprovado via comparativo de cotações',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['necessidades', condominioId] })
      qc.invalidateQueries({ queryKey: ['compromissos', condominioId] })
      qc.invalidateQueries({ queryKey: ['cotacoes', condominioId, selecionada] })
      qc.invalidateQueries({ queryKey: ['decisoes', condominioId, selecionada] })
      qc.invalidateQueries({ queryKey: ['despesas-futuras', condominioId] })
      setMsgAprovacao('Cotação aprovada. Compromisso financeiro gerado automaticamente.')
    },
  })
  const avaliarM = useMutation({
    mutationFn: ({ id, nota }: { id: string; nota: number }) => avaliarFornecedor(id, nota),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fornecedores'] }),
  })

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Necessidades</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  const necSel = necQ.data?.find((n) => n.id === selecionada)
  const jaAprovada = necSel?.situacao === 'aprovado'

  return (
    <div>
      <header className="page-header">
        <h1>Necessidades, Cotações e Fornecedores</h1>
        <p>Ciclo RF06 → RF07 → RF08 → decisão (RF09)</p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn ${tab === 'necessidades' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('necessidades')}
        >
          Necessidades
        </button>
        <button
          type="button"
          className={`btn ${tab === 'fornecedores' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('fornecedores')}
        >
          Fornecedores
        </button>
      </div>

      {tab === 'necessidades' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: selecionada ? 'minmax(280px, 38%) 1fr' : '1fr',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          {/* Coluna lista */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Lista</h3>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '0.85rem' }}
                onClick={() => setNovaAberta((v) => !v)}
              >
                {novaAberta ? 'Fechar' : '+ Nova'}
              </button>
            </div>

            {novaAberta && (
              <form
                onSubmit={necForm.handleSubmit((d) => criarNecM.mutate(d))}
                style={{ display: 'grid', gap: '0.5rem', padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}
              >
                <input className="input" placeholder="Descrição *" {...necForm.register('descricao')} />
                <input className="input" placeholder="Categoria *" {...necForm.register('categoria')} />
                <select className="input" {...necForm.register('prioridade')}>
                  <option value="">Prioridade</option>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
                <textarea className="input" placeholder="Escopo (RN06)" {...necForm.register('escopoTexto')} />
                <button type="submit" className="btn btn-primary" disabled={criarNecM.isPending}>
                  Criar
                </button>
                <ErroApi error={criarNecM.error} />
              </form>
            )}

            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`btn ${filtro === f.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                  onClick={() => setFiltro(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {necQ.isLoading && <p className="muted">Carregando…</p>}
            {!necQ.isLoading && listaFiltrada.length === 0 && (
              <p className="muted">Nenhuma necessidade neste filtro.</p>
            )}

            <ul style={{ listStyle: 'none', display: 'grid', gap: '0.4rem', margin: 0, padding: 0 }}>
              {listaFiltrada.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.65rem 0.75rem',
                      border:
                        selecionada === n.id
                          ? '1px solid var(--color-primary)'
                          : '1px solid var(--color-border)',
                      background: selecionada === n.id ? 'var(--color-bg)' : undefined,
                    }}
                    onClick={() => {
                      setSelecionada(n.id)
                      setMsgAprovacao(null)
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: '100%',
                      }}
                    >
                      <strong
                        style={{
                          flex: 1,
                          minWidth: 0,
                          textAlign: 'left',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {n.descricao}
                      </strong>
                      {badgePrioridade(n.prioridade as Prioridade | null)}
                    </div>
                    <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem', textAlign: 'left' }}>
                      {n.categoria} · {SITUACAO_NECESSIDADE_LABEL[n.situacao as SituacaoNecessidade]}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna detalhe / cotações */}
          {selecionada && necSel && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem' }}>{necSel.descricao}</h3>
                  <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                    {badgePrioridade(necSel.prioridade as Prioridade | null)}
                    {necSel.categoria} · {SITUACAO_NECESSIDADE_LABEL[necSel.situacao as SituacaoNecessidade]}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.85rem' }}
                  onClick={() => {
                    setSelecionada(null)
                    setMsgAprovacao(null)
                  }}
                >
                  Fechar
                </button>
              </div>

              {jaAprovada && (
                <p className="muted" style={{ margin: 0, color: 'var(--color-primary)' }}>
                  Necessidade aprovada.
                  {cotacaoEscolhidaId
                    ? ' Cotação escolhida destacada abaixo.'
                    : ' Compromisso gerado (pode ter sido emergencial, sem cotação).'}{' '}
                  <Link to="/compromissos">Ver em Decisões/Compromissos →</Link>
                </p>
              )}
              {msgAprovacao && (
                <p style={{ margin: 0, color: 'var(--color-primary)', fontWeight: 600 }}>
                  {msgAprovacao}{' '}
                  <Link to="/compromissos">Abrir compromissos →</Link>
                </p>
              )}

              {compQ.data && compQ.data.cotacoes.length > 0 && (
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  Comparativo — menor {formatMoney(compQ.data.menorValor)} · maior{' '}
                  {formatMoney(compQ.data.maiorValor)} · dif. {formatMoney(compQ.data.diferenca)}
                </p>
              )}

              <div>
                <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  Cotações ({cotQ.data?.length ?? 0})
                </p>
                <ul style={{ listStyle: 'none', display: 'grid', gap: '0.35rem', margin: 0, padding: 0 }}>
                  {cotQ.data?.map((c) => {
                    const escolhida = cotacaoEscolhidaId === c.id
                    const maisBarata = compQ.data?.fornecedorMaisBaratoId === c.fornecedorId
                    return (
                      <li
                        key={c.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 0.6rem',
                          borderRadius: 'var(--radius)',
                          border: escolhida
                            ? '1px solid var(--color-primary)'
                            : '1px solid var(--color-border)',
                          background: escolhida ? 'var(--color-bg)' : undefined,
                          opacity: jaAprovada && !escolhida ? 0.65 : 1,
                        }}
                      >
                        <span style={{ fontSize: '0.9rem' }}>
                          <strong>{c.fornecedorNome}</strong> — {formatMoney(c.valor)}
                          {c.prazoExecucaoDias ? ` · ${c.prazoExecucaoDias}d` : ''}
                          {maisBarata && !escolhida && (
                            <span className="badge" style={{ marginLeft: '0.4rem', fontSize: '0.7rem' }}>
                              menor valor
                            </span>
                          )}
                        </span>
                        {escolhida ? (
                          <span className="badge" style={{ background: 'var(--color-primary)', color: '#fff' }}>
                            escolhida
                          </span>
                        ) : jaAprovada ? (
                          <span className="muted" style={{ fontSize: '0.8rem' }}>
                            não escolhida
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={decisaoM.isPending}
                            onClick={() => {
                              if (decisaoM.isPending) return
                              decisaoM.mutate(c.id)
                            }}
                          >
                            {decisaoM.isPending && decisaoM.variables === c.id
                              ? 'Aprovando…'
                              : 'Aprovar'}
                          </button>
                        )}
                      </li>
                    )
                  })}
                  {cotQ.data?.length === 0 && (
                    <li className="muted">Nenhuma cotação ainda.</li>
                  )}
                </ul>
              </div>

              {!jaAprovada && (
                <form
                  onSubmit={cotForm.handleSubmit((d) => cotM.mutate(d))}
                  style={{
                    display: 'grid',
                    gap: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid var(--color-border)',
                  }}
                >
                  <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                    Registrar cotação
                  </p>
                  <select className="input" {...cotForm.register('fornecedorId')}>
                    <option value="">Fornecedor</option>
                    {fornQ.data?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome} ({f.categoria})
                      </option>
                    ))}
                  </select>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      placeholder="Valor"
                      {...cotForm.register('valor')}
                    />
                    <input
                      className="input"
                      type="number"
                      placeholder="Prazo (dias)"
                      {...cotForm.register('prazoExecucaoDias')}
                    />
                  </div>
                  <input className="input" placeholder="Garantia" {...cotForm.register('garantiaDescricao')} />
                  <input
                    className="input"
                    placeholder="Condições de pagamento"
                    {...cotForm.register('condicoesPagamento')}
                  />
                  <input className="input" type="date" {...cotForm.register('validade')} />
                  <button type="submit" className="btn btn-primary" disabled={cotM.isPending}>
                    Registrar cotação
                  </button>
                  <ErroApi error={cotM.error} />
                  <ErroApi error={decisaoM.error} />
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'fornecedores' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Novo fornecedor</h3>
            <form
              onSubmit={fornForm.handleSubmit((d) => criarFornM.mutate(d))}
              style={{ display: 'grid', gap: '0.5rem', maxWidth: 400 }}
            >
              <input className="input" placeholder="Nome *" {...fornForm.register('nome')} />
              <input className="input" placeholder="Categoria *" {...fornForm.register('categoria')} />
              <input className="input" placeholder="Telefone (opcional)" {...fornForm.register('telefone')} />
              <input className="input" placeholder="E-mail (opcional)" {...fornForm.register('email')} />
              <textarea
                className="input"
                placeholder="Observações (opcional)"
                {...fornForm.register('observacoes')}
              />
              <button type="submit" className="btn btn-primary" disabled={criarFornM.isPending}>
                Criar
              </button>
              <ErroApi error={criarFornM.error} />
            </form>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: '0.75rem' }}>Lista</h3>
            {fornQ.isLoading && <p className="muted">Carregando…</p>}
            <ul style={{ listStyle: 'none', display: 'grid', gap: '0.5rem' }}>
              {fornQ.data?.map((f) => (
                <li
                  key={f.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <span>
                    <strong>{f.nome}</strong>
                    <span className="muted"> · {f.categoria}</span>
                    {f.avaliacaoNota != null && (
                      <span className="badge" style={{ marginLeft: '0.5rem' }}>
                        ★ {f.avaliacaoNota}
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '0.15rem 0.4rem' }}
                        disabled={avaliarM.isPending}
                        onClick={() => avaliarM.mutate({ id: f.id, nota: n })}
                      >
                        {n}★
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
