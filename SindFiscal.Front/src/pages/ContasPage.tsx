import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import {
  criarConta,
  listarContas,
  listarLancamentos,
  registrarLancamento,
  estornarLancamento,
} from '@/services/api'
import { FINALIDADE_LABEL, type FinalidadeConta, type TipoLancamento } from '@/types'
import { useCondominioStore } from '@/stores/condominioStore'

const contaSchema = z.object({
  nome: z.string().min(2),
  finalidade: z.enum([
    'ordinario',
    'extraordinario',
    'fundo_reserva',
    'fundo_trabalho',
    'fundo_area_especifica',
  ]),
  ehContaOperacional: z.boolean(),
})

const lancSchema = z.object({
  contaBancariaId: z.string().min(1),
  data: z.string().min(1),
  tipo: z.enum(['entrada', 'saida']),
  valor: z.coerce.number().positive('Valor deve ser positivo'),
  descricao: z.string().optional(),
})

type ContaForm = z.infer<typeof contaSchema>
type LancForm = z.infer<typeof lancSchema>

function formatMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ContasPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const qc = useQueryClient()
  const [painel, setPainel] = useState<'contas' | 'lancamentos'>('contas')

  const contasQ = useQuery({
    queryKey: ['contas', condominioId],
    queryFn: () => listarContas(condominioId!),
    enabled: !!condominioId,
  })

  const lancQ = useQuery({
    queryKey: ['lancamentos', condominioId],
    queryFn: () => listarLancamentos(condominioId!),
    enabled: !!condominioId && painel === 'lancamentos',
  })

  const criarContaM = useMutation({
    mutationFn: (d: ContaForm) => criarConta(condominioId!, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contas', condominioId] }),
  })

  const regLancM = useMutation({
    mutationFn: (d: LancForm) =>
      registrarLancamento(condominioId!, {
        contaBancariaId: d.contaBancariaId,
        data: d.data,
        tipo: d.tipo as TipoLancamento,
        valor: d.valor,
        descricao: d.descricao,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos', condominioId] })
      qc.invalidateQueries({ queryKey: ['contas', condominioId] })
    },
  })

  const estornarM = useMutation({
    mutationFn: (id: string) =>
      estornarLancamento(condominioId!, id, 'Estorno solicitado pelo usuário'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos', condominioId] })
      qc.invalidateQueries({ queryKey: ['contas', condominioId] })
    },
  })

  const contaForm = useForm<ContaForm>({
    resolver: zodResolver(contaSchema),
    defaultValues: { finalidade: 'ordinario', ehContaOperacional: false },
  })

  const lancForm = useForm<LancForm>({
    resolver: zodResolver(lancSchema),
    defaultValues: {
      data: new Date().toISOString().slice(0, 10),
      tipo: 'saida',
    },
  })

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Contas e Lançamentos</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1>Contas e Lançamentos</h1>
        <p>RF04 / RF05 — fundos, conta operacional e movimentação manual</p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          type="button"
          className={`btn ${painel === 'contas' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setPainel('contas')}
        >
          Contas / Fundos
        </button>
        <button
          type="button"
          className={`btn ${painel === 'lancamentos' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setPainel('lancamentos')}
        >
          Lançamentos
        </button>
      </div>

      {painel === 'contas' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <form
            onSubmit={contaForm.handleSubmit((d) => {
              criarContaM.mutate(d)
              contaForm.reset({ finalidade: 'ordinario', ehContaOperacional: false })
            })}
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              alignItems: 'end',
            }}
          >
            <div className="form-field">
              <label>Nome</label>
              <input {...contaForm.register('nome')} placeholder="Ex.: Conta corrente" />
            </div>
            <div className="form-field">
              <label>Finalidade</label>
              <select className="select-condominio" style={{ width: '100%' }} {...contaForm.register('finalidade')}>
                {(Object.keys(FINALIDADE_LABEL) as FinalidadeConta[]).map((k) => (
                  <option key={k} value={k}>
                    {FINALIDADE_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
              <input type="checkbox" {...contaForm.register('ehContaOperacional')} />
              Conta operacional
            </label>
            <button type="submit" className="btn btn-primary" disabled={criarContaM.isPending}>
              Criar conta
            </button>
          </form>

          {contasQ.isLoading && <p className="muted">Carregando…</p>}
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {contasQ.data?.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: '1rem',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius)',
                  border: c.ehContaOperacional
                    ? '1px solid var(--color-primary)'
                    : '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <strong>{c.nome}</strong>
                  {c.ehContaOperacional && <span className="badge">operacional</span>}
                </div>
                <p className="muted" style={{ fontSize: '0.8rem' }}>
                  {FINALIDADE_LABEL[c.finalidade] ?? c.finalidade}
                </p>
                <p style={{ marginTop: '0.5rem', fontSize: '1.15rem', fontWeight: 700 }}>
                  {formatMoney(c.saldoAtual)}
                </p>
                {c.aportePendenteAcumulado > 0 && (
                  <p className="muted" style={{ fontSize: '0.8rem' }}>
                    Aporte pendente: {formatMoney(c.aportePendenteAcumulado)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {painel === 'lancamentos' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <form
            onSubmit={lancForm.handleSubmit((d) => {
              regLancM.mutate(d)
              lancForm.reset({
                data: new Date().toISOString().slice(0, 10),
                tipo: 'saida',
                contaBancariaId: d.contaBancariaId,
              })
            })}
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              alignItems: 'end',
            }}
          >
            <div className="form-field">
              <label>Conta</label>
              <select
                className="select-condominio"
                style={{ width: '100%' }}
                {...lancForm.register('contaBancariaId')}
              >
                <option value="">Selecione…</option>
                {contasQ.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Data</label>
              <input type="date" {...lancForm.register('data')} />
            </div>
            <div className="form-field">
              <label>Tipo</label>
              <select className="select-condominio" style={{ width: '100%' }} {...lancForm.register('tipo')}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>
            <div className="form-field">
              <label>Valor</label>
              <input type="number" step="0.01" {...lancForm.register('valor')} />
            </div>
            <div className="form-field">
              <label>Descrição</label>
              <input {...lancForm.register('descricao')} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={regLancM.isPending}>
              Registrar
            </button>
          </form>

          {lancQ.isLoading && <p className="muted">Carregando…</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '0.5rem' }}>Data</th>
                  <th style={{ padding: '0.5rem' }}>Tipo</th>
                  <th style={{ padding: '0.5rem' }}>Valor</th>
                  <th style={{ padding: '0.5rem' }}>Descrição</th>
                  <th style={{ padding: '0.5rem' }} />
                </tr>
              </thead>
              <tbody>
                {lancQ.data?.map((l) => (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '0.5rem' }}>{l.data}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span className="badge">{l.tipo}</span>
                    </td>
                    <td style={{ padding: '0.5rem', fontWeight: 600 }}>
                      {formatMoney(l.valor)}
                    </td>
                    <td style={{ padding: '0.5rem' }} className="muted">
                      {l.descricao ?? '—'}
                      {l.estornoDeId && ' (estorno)'}
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      {!l.estornoDeId && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: '0.8rem' }}
                          onClick={() => estornarM.mutate(l.id)}
                          disabled={estornarM.isPending}
                        >
                          Estornar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lancQ.data?.length === 0 && (
              <p className="muted" style={{ padding: '1rem 0' }}>
                Nenhum lançamento registrado.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
