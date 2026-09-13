import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import {
  concederPermissao,
  criarColaborador,
  criarCondominio,
  listarCondominios,
  listarPermissoes,
  listarUsuarios,
} from '@/services/api'
import { MODULOS_LABEL } from '@/types'
import { useCondominioStore } from '@/stores/condominioStore'

const condoSchema = z.object({ nome: z.string().min(2, 'Informe o nome') })
const colabSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senhaProvisoria: z.string().min(4, 'Mínimo 4 caracteres'),
})

type CondoForm = z.infer<typeof condoSchema>
type ColabForm = z.infer<typeof colabSchema>

export function AdminPage() {
  const qc = useQueryClient()
  const setCondominios = useCondominioStore((s) => s.setCondominios)
  const condominioAtivoId = useCondominioStore((s) => s.condominioAtivoId)
  const [tab, setTab] = useState<'condominios' | 'usuarios' | 'permissoes'>('condominios')

  const condominiosQ = useQuery({
    queryKey: ['condominios'],
    queryFn: async () => {
      const lista = await listarCondominios()
      setCondominios(
        lista.map((c) => ({
          id: c.id,
          nome: c.nome,
          ativo: true,
        })),
      )
      return lista
    },
  })

  const usuariosQ = useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuarios,
  })

  const permissoesQ = useQuery({
    queryKey: ['permissoes', condominioAtivoId],
    queryFn: () => listarPermissoes(condominioAtivoId!),
    enabled: !!condominioAtivoId && tab === 'permissoes',
  })

  const criarCondo = useMutation({
    mutationFn: (nome: string) => criarCondominio(nome),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['condominios'] }),
  })

  const criarColab = useMutation({
    mutationFn: (d: ColabForm) =>
      criarColaborador(d.nome, d.email, d.senhaProvisoria),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  const condoForm = useForm<CondoForm>({ resolver: zodResolver(condoSchema) })
  const colabForm = useForm<ColabForm>({ resolver: zodResolver(colabSchema) })

  const [permUsuarioId, setPermUsuarioId] = useState('')
  const [permModulo, setPermModulo] = useState('contas_lancamentos')
  const [permNivel, setPermNivel] = useState<'visualizar' | 'editar'>('visualizar')

  const conceder = useMutation({
    mutationFn: () =>
      concederPermissao(condominioAtivoId!, permUsuarioId, permModulo, permNivel),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['permissoes', condominioAtivoId] }),
  })

  return (
    <div>
      <header className="page-header">
        <h1>Condomínios, Usuários e Permissões</h1>
        <p>Módulo 11 — exclusivo do síndico (RF02, RF03)</p>
      </header>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {(['condominios', 'usuarios', 'permissoes'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t)}
          >
            {t === 'condominios' ? 'Condomínios' : t === 'usuarios' ? 'Usuários' : 'Permissões'}
          </button>
        ))}
      </div>

      {tab === 'condominios' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <form
            onSubmit={condoForm.handleSubmit((d) => {
              criarCondo.mutate(d.nome)
              condoForm.reset()
            })}
            style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <div className="form-field" style={{ flex: 1, minWidth: 200 }}>
              <label>Novo condomínio</label>
              <input {...condoForm.register('nome')} placeholder="Nome do condomínio" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={criarCondo.isPending}>
              Criar
            </button>
          </form>
          {condominiosQ.isLoading && <p className="muted">Carregando…</p>}
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
                }}
              >
                <span>{c.nome}</span>
                <span className="badge">
                  {c.possuiIntegracaoApi ? 'API' : 'manual'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <form
            onSubmit={colabForm.handleSubmit((d) => {
              criarColab.mutate(d)
              colabForm.reset()
            })}
            style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
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
                Criar colaborador
              </button>
            </div>
          </form>
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
                <span className="badge">{u.papel}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'permissoes' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!condominioAtivoId && (
            <p className="muted">Selecione um condomínio no topo.</p>
          )}
          {condominioAtivoId && (
            <>
              <div
                style={{
                  display: 'grid',
                  gap: '0.75rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  alignItems: 'end',
                }}
              >
                <div className="form-field">
                  <label>Colaborador</label>
                  <select
                    className="select-condominio"
                    style={{ width: '100%' }}
                    value={permUsuarioId}
                    onChange={(e) => setPermUsuarioId(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {usuariosQ.data
                      ?.filter((u) => u.papel !== 'sindico')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Módulo</label>
                  <select
                    className="select-condominio"
                    style={{ width: '100%' }}
                    value={permModulo}
                    onChange={(e) => setPermModulo(e.target.value)}
                  >
                    {Object.entries(MODULOS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Nível</label>
                  <select
                    className="select-condominio"
                    style={{ width: '100%' }}
                    value={permNivel}
                    onChange={(e) =>
                      setPermNivel(e.target.value as 'visualizar' | 'editar')
                    }
                  >
                    <option value="visualizar">Visualizar</option>
                    <option value="editar">Editar</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!permUsuarioId || conceder.isPending}
                  onClick={() => conceder.mutate()}
                >
                  Conceder
                </button>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {permissoesQ.data?.map((p) => (
                  <li
                    key={p.id}
                    style={{
                      padding: '0.75rem',
                      background: 'var(--color-bg)',
                      borderRadius: 'var(--radius)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <span>
                      {p.usuarioNome} — {MODULOS_LABEL[p.modulo] ?? p.modulo}
                    </span>
                    <span className="badge">{p.nivel}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
