import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  criarColaborador,
  criarCondominio,
  excluirCondominio,
  listarCondominios,
  listarUsuarios,
} from '@/services/api'
import { ApiError } from '@/lib/api'
import { useCondominioStore } from '@/stores/condominioStore'

const condoSchema = z.object({
  nome: z.string().min(2, 'Informe o nome'),
  cnpj: z.string().optional(),
})
const colabSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senhaProvisoria: z.string().min(4, 'Mínimo 4 caracteres'),
})

type CondoForm = z.infer<typeof condoSchema>
type ColabForm = z.infer<typeof colabSchema>

function msgErro(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message || fallback
  if (err instanceof Error) return err.message
  return fallback
}

export function AdminPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const setCondominios = useCondominioStore((s) => s.setCondominios)
  const [tab, setTab] = useState<'condominios' | 'usuarios'>('condominios')

  const condominiosQ = useQuery({
    queryKey: ['condominios'],
    queryFn: async () => {
      const lista = await listarCondominios()
      setCondominios(
        lista.map((c) => ({
          id: c.id,
          nome: c.nome,
          ativo: c.ativo ?? true,
        })),
      )
      return lista
    },
  })

  const usuariosQ = useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuarios,
  })

  const criarCondo = useMutation({
    mutationFn: (d: CondoForm) =>
      criarCondominio({
        nome: d.nome,
        cnpj: d.cnpj?.trim() ? d.cnpj.trim() : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['condominios'] })
      toast.success('Condomínio criado.')
      condoForm.reset()
    },
    onError: (err) => toast.error(msgErro(err, 'Falha ao criar condomínio.')),
  })

  const excluirCondo = useMutation({
    mutationFn: (id: string) => excluirCondominio(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['condominios'] })
      toast.success('Condomínio desativado.')
    },
    onError: (err) => toast.error(msgErro(err, 'Falha ao desativar.')),
  })

  const criarColab = useMutation({
    mutationFn: (d: ColabForm) =>
      criarColaborador(d.nome, d.email, d.senhaProvisoria),
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      qc.invalidateQueries({ queryKey: ['acessos'] })
      toast.success(`Colaborador ${u.nome} criado. Agora defina os acessos.`)
      colabForm.reset()
      // Leva direto para a matriz de acessos para não esquecer de dar permissões
      navigate(`/acessos/${u.id}`)
    },
    onError: (err) => toast.error(msgErro(err, 'Falha ao criar colaborador.')),
  })

  const condoForm = useForm<CondoForm>({ resolver: zodResolver(condoSchema) })
  const colabForm = useForm<ColabForm>({ resolver: zodResolver(colabSchema) })

  return (
    <div>
      <header className="page-header">
        <h1>Condomínios e Usuários</h1>
        <p>
          Módulo 11 — exclusivo do síndico (RF02, RF03). Permissões ficam em{' '}
          <Link to="/acessos" style={{ textDecoration: 'underline' }}>
            Gestão de Acessos
          </Link>
          .
        </p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {(['condominios', 'usuarios'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t)}
          >
            {t === 'condominios' ? 'Condomínios' : 'Usuários'}
          </button>
        ))}
      </div>

      {tab === 'condominios' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <form
            onSubmit={condoForm.handleSubmit((d) => criarCondo.mutate(d))}
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div className="form-field" style={{ flex: 1, minWidth: 180 }}>
              <label>Novo condomínio</label>
              <input {...condoForm.register('nome')} placeholder="Nome do condomínio" />
              {condoForm.formState.errors.nome && (
                <span className="muted">{condoForm.formState.errors.nome.message}</span>
              )}
            </div>
            <div className="form-field" style={{ minWidth: 160 }}>
              <label>CNPJ (opcional)</label>
              <input
                {...condoForm.register('cnpj')}
                placeholder="00.000.000/0000-00"
                inputMode="numeric"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={criarCondo.isPending}>
              {criarCondo.isPending ? 'Criando…' : 'Criar'}
            </button>
          </form>
          {condominiosQ.isLoading && <p className="muted">Carregando…</p>}
          {condominiosQ.isError && (
            <p className="muted">Erro ao carregar condomínios.</p>
          )}
          {condominiosQ.data?.length === 0 && (
            <p className="muted">Nenhum condomínio ainda.</p>
          )}
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {condominiosQ.data?.map((c) => (
              <li
                key={c.id}
                style={{
                  padding: '0.75rem',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span>{c.nome}</span>
                  {c.cnpj && (
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      CNPJ {formatCnpj(c.cnpj)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="badge">
                    {c.possuiIntegracaoApi ? 'API' : 'manual'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem' }}
                    disabled={excluirCondo.isPending}
                    onClick={() => {
                      if (confirm(`Desativar "${c.nome}"?`)) excluirCondo.mutate(c.id)
                    }}
                  >
                    Desativar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <form
            onSubmit={colabForm.handleSubmit((d) => criarColab.mutate(d))}
            style={{
              display: 'grid',
              gap: '0.75rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            }}
          >
            <div className="form-field">
              <label>Nome</label>
              <input {...colabForm.register('nome')} />
            </div>
            <div className="form-field">
              <label>E-mail</label>
              <input type="email" {...colabForm.register('email')} />
            </div>
            <div className="form-field">
              <label>Senha provisória</label>
              <input type="password" {...colabForm.register('senhaProvisoria')} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={criarColab.isPending}>
                {criarColab.isPending ? 'Criando…' : 'Criar colaborador'}
              </button>
            </div>
          </form>
          {usuariosQ.isLoading && <p className="muted">Carregando…</p>}
          {usuariosQ.isError && <p className="muted">Erro ao carregar usuários.</p>}
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {usuariosQ.data?.map((u) => (
              <li
                key={u.id}
                style={{
                  padding: '0.75rem',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  {u.nome} <span className="muted">({u.email})</span>
                </span>
                <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="badge">{u.papel}</span>
                  {u.papel !== 'sindico' && (
                    <Link
                      to={`/acessos/${u.id}`}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.8rem' }}
                    >
                      Acessos
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function formatCnpj(raw: string) {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 14) return raw
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}
