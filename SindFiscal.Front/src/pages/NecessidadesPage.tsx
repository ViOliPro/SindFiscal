import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import {
  avaliarFornecedor,
  comparativoCotacoes,
  criarFornecedor,
  criarNecessidade,
  listarCotacoes,
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
  return <p className="muted" style={{ color: 'var(--color-danger)' }}>{msg}</p>
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

export function NecessidadesPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const qc = useQueryClient()
  const [tab, setTab] = useState<'necessidades' | 'fornecedores'>('necessidades')
  const [selecionada, setSelecionada] = useState<string | null>(null)

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['necessidades', condominioId] })
      necForm.reset()
    },
  })
  const criarFornM = useMutation({
    mutationFn: (d: FornForm) => criarFornecedor(d.nome, d.categoria),
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
    },
  })
  const avaliarM = useMutation({
    mutationFn: ({ id, nota }: { id: string; nota: number }) =>
      avaliarFornecedor(id, nota),
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
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Nova necessidade</h3>
            <form
              onSubmit={necForm.handleSubmit((d) => criarNecM.mutate(d))}
              style={{ display: 'grid', gap: '0.5rem', maxWidth: 480 }}
            >
              <input className="input" placeholder="Descrição" {...necForm.register('descricao')} />
              <input className="input" placeholder="Categoria" {...necForm.register('categoria')} />
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
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '0.75rem' }}>Lista</h3>
            {necQ.isLoading && <p className="muted">Carregando…</p>}
            {necQ.data?.length === 0 && <p className="muted">Nenhuma necessidade.</p>}
            <ul style={{ listStyle: 'none', display: 'grid', gap: '0.5rem' }}>
              {necQ.data?.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border:
                        selecionada === n.id
                          ? '1px solid var(--color-primary)'
                          : '1px solid var(--color-border)',
                    }}
                    onClick={() => setSelecionada(n.id)}
                  >
                    <strong>{n.descricao}</strong>
                    <span className="muted" style={{ marginLeft: '0.5rem' }}>
                      {n.categoria} · {SITUACAO_NECESSIDADE_LABEL[n.situacao as SituacaoNecessidade]}
                      {n.prioridade
                        ? ` · ${PRIORIDADE_LABEL[n.prioridade as Prioridade]}`
                        : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selecionada && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <h3 style={{ marginBottom: '0.75rem' }}>Cotações</h3>
              {compQ.data && compQ.data.cotacoes.length > 0 && (
                <p className="muted" style={{ marginBottom: '0.75rem' }}>
                  Menor: {formatMoney(compQ.data.menorValor)} · Maior:{' '}
                  {formatMoney(compQ.data.maiorValor)} · Diferença:{' '}
                  {formatMoney(compQ.data.diferenca)}
                </p>
              )}
              <ul style={{ listStyle: 'none', display: 'grid', gap: '0.35rem', marginBottom: '1rem' }}>
                {cotQ.data?.map((c) => (
                  <li
                    key={c.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.35rem 0',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <span>
                      {c.fornecedorNome} — {formatMoney(c.valor)}
                      {c.prazoExecucaoDias ? ` · ${c.prazoExecucaoDias}d` : ''}
                    </span>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={decisaoM.isPending}
                      onClick={() => decisaoM.mutate(c.id)}
                    >
                      Aprovar cotação
                    </button>
                  </li>
                ))}
              </ul>
              <form
                onSubmit={cotForm.handleSubmit((d) => cotM.mutate(d))}
                style={{ display: 'grid', gap: '0.5rem', maxWidth: 480 }}
              >
                <select className="input" {...cotForm.register('fornecedorId')}>
                  <option value="">Fornecedor</option>
                  {fornQ.data?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} ({f.categoria})
                    </option>
                  ))}
                </select>
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
            </div>
          )}
        </>
      )}

      {tab === 'fornecedores' && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>Novo fornecedor</h3>
            <form
              onSubmit={fornForm.handleSubmit((d) => criarFornM.mutate(d))}
              style={{ display: 'grid', gap: '0.5rem', maxWidth: 400 }}
            >
              <input className="input" placeholder="Nome" {...fornForm.register('nome')} />
              <input className="input" placeholder="Categoria" {...fornForm.register('categoria')} />
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
