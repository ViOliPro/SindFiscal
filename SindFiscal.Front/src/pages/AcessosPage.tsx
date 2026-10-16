import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  criarModelosPadrao,
  excluirModeloAcesso,
  listarModelosAcesso,
  resumoAcessos,
} from '@/services/api'
import { ApiError } from '@/lib/api'
import type { ModeloAcesso } from '@/types'
import { MODULOS_CURTO, NIVEL_LABEL } from '@/lib/acessos'
import { ModeloEditor } from '@/components/acessos/ModeloEditor'

function msgErro(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message || fallback : fallback
}

const PAPEL_LABEL: Record<string, string> = {
  colaborador: 'Colaborador',
  conselheiro_fiscal: 'Conselho Fiscal',
}

export function AcessosPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'colaboradores' | 'modelos'>('colaboradores')
  const [soSemAcesso, setSoSemAcesso] = useState(false)
  const [busca, setBusca] = useState('')
  // undefined = editor fechado, null = novo modelo, objeto = editando
  const [editando, setEditando] = useState<ModeloAcesso | null | undefined>(undefined)

  const resumoQ = useQuery({ queryKey: ['acessos', 'resumo'], queryFn: resumoAcessos })
  const modelosQ = useQuery({ queryKey: ['modelos-acesso'], queryFn: listarModelosAcesso })

  const excluir = useMutation({
    mutationFn: (id: string) => excluirModeloAcesso(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modelos-acesso'] })
      toast.success('Modelo excluído.')
    },
    onError: (err) => toast.error(msgErro(err, 'Falha ao excluir.')),
  })

  const padrao = useMutation({
    mutationFn: criarModelosPadrao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modelos-acesso'] })
      toast.success('Modelos padrão criados — ajuste como preferir.')
    },
    onError: (err) => toast.error(msgErro(err, 'Falha ao criar modelos.')),
  })

  const resumo = resumoQ.data
  const termo = busca.trim().toLowerCase()
  const colaboradores = (resumo?.colaboradores ?? []).filter(
    (c) =>
      (!soSemAcesso || (c.ativo && c.condominiosComAcesso === 0)) &&
      (!termo ||
        c.nome.toLowerCase().includes(termo) ||
        c.email.toLowerCase().includes(termo)),
  )

  return (
    <div>
      <header className="page-header">
        <h1>Gestão de Acessos</h1>
        <p>Quem acessa o quê em cada condomínio (RF03) — exclusivo do síndico</p>
      </header>

      <div className="acessos-cards">
        <div className="card acessos-stat">
          <strong>{resumo?.totalColaboradores ?? '—'}</strong>
          <span className="muted">Colaboradores</span>
        </div>
        <div className="card acessos-stat">
          <strong>{resumo?.totalCondominios ?? '—'}</strong>
          <span className="muted">Condomínios ativos</span>
        </div>
        <button
          type="button"
          className="card acessos-stat"
          data-alerta={(resumo?.semAcesso ?? 0) > 0}
          onClick={() => {
            setTab('colaboradores')
            setSoSemAcesso((v) => !v)
          }}
          title="Clique para filtrar"
        >
          <strong>{resumo?.semAcesso ?? '—'}</strong>
          <span className="muted">
            {soSemAcesso ? 'Sem acesso (filtrando)' : 'Sem acesso a nenhum condomínio'}
          </span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {(['colaboradores', 'modelos'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t)}
          >
            {t === 'colaboradores' ? 'Colaboradores' : 'Modelos de acesso'}
          </button>
        ))}
      </div>

      {tab === 'colaboradores' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="select-condominio"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Buscar por nome ou e-mail"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <label className="acessos-check">
              <input
                type="checkbox"
                checked={soSemAcesso}
                onChange={(e) => setSoSemAcesso(e.target.checked)}
              />
              <span>Só sem acesso</span>
            </label>
            <Link to="/admin" className="btn btn-ghost">
              Criar colaborador
            </Link>
          </div>

          {resumoQ.isLoading && <p className="muted">Carregando…</p>}
          {resumoQ.isError && <p className="muted">Erro ao carregar colaboradores.</p>}
          {resumoQ.isSuccess && colaboradores.length === 0 && (
            <p className="muted">
              {resumo?.colaboradores.length === 0
                ? 'Nenhum colaborador ainda. Crie um em Condomínios / Usuários.'
                : 'Nenhum colaborador com esse filtro.'}
            </p>
          )}

          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {colaboradores.map((c) => {
              const semAcesso = c.condominiosComAcesso === 0
              return (
                <li key={c.usuarioId} className="acessos-item" data-alerta={semAcesso && c.ativo}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span>
                      {c.nome}{' '}
                      {!c.ativo && <span className="badge">inativo</span>}
                    </span>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      {c.email} · {PAPEL_LABEL[c.papel] ?? c.papel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {semAcesso ? (
                      <span className="badge acessos-badge-alerta">Sem acesso</span>
                    ) : (
                      <span className="badge">
                        {c.condominiosComAcesso} de {resumo?.totalCondominios ?? '?'} condomínios
                      </span>
                    )}
                    <Link
                      to={`/acessos/${c.usuarioId}`}
                      className={`btn ${semAcesso && c.ativo ? 'btn-primary' : 'btn-ghost'}`}
                    >
                      {semAcesso ? 'Definir acessos' : 'Gerenciar acessos'}
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {tab === 'modelos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {editando !== undefined ? (
            <ModeloEditor
              key={editando?.id ?? 'novo'}
              modelo={editando}
              onConcluir={() => setEditando(undefined)}
            />
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={() => setEditando(null)}>
                Novo modelo
              </button>
              {modelosQ.isSuccess && modelosQ.data.length === 0 && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={padrao.isPending}
                  onClick={() => padrao.mutate()}
                >
                  Criar modelos padrão (Consulta, Operacional, Gestor)
                </button>
              )}
            </div>
          )}

          {modelosQ.isLoading && <p className="muted">Carregando…</p>}
          {modelosQ.isSuccess && modelosQ.data.length === 0 && editando === undefined && (
            <div className="card empty-state">
              <p>
                Nenhum modelo ainda. Um modelo é um perfil pronto (ex.: Consulta) que você aplica
                em vários condomínios de uma vez.
              </p>
            </div>
          )}

          {modelosQ.data?.map((m) => (
            <div key={m.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <strong>{m.nome}</strong>
                  {m.descricao && (
                    <p className="muted" style={{ fontSize: '0.85rem' }}>
                      {m.descricao}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditando(m)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={excluir.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          `Excluir o modelo "${m.nome}"? Acessos já concedidos com ele não são alterados.`,
                        )
                      )
                        excluir.mutate(m.id)
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {m.itens.map((i) => (
                  <span key={i.modulo} className="badge" data-nivel={i.nivel}>
                    {MODULOS_CURTO[i.modulo] ?? i.modulo}: {NIVEL_LABEL[i.nivel]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
