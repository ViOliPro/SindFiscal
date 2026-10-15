import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarModelosAcesso,
  obterAcessosUsuario,
  salvarAcessosUsuario,
} from '@/services/api'
import { ApiError } from '@/lib/api'
import type { NivelPermissao } from '@/types'
import {
  aplicarNaLinha,
  definirNivel,
  diferencas,
  limitarLinha,
  mapaDePermissoes,
  type LinhaAcesso,
  type MapaAcesso,
  type ModoAplicacao,
} from '@/lib/acessos'
import { MatrizAcesso } from '@/components/acessos/MatrizAcesso'
import { AplicarEmLote } from '@/components/acessos/AplicarEmLote'

/** Matriz de acessos de UM colaborador: condomínios × módulos, tudo em rascunho até Salvar. */
export function AcessoUsuarioPage() {
  const { usuarioId = '' } = useParams()
  const qc = useQueryClient()

  const dadosQ = useQuery({
    queryKey: ['acessos', 'usuario', usuarioId],
    queryFn: () => obterAcessosUsuario(usuarioId),
    enabled: !!usuarioId,
  })
  const modelosQ = useQuery({ queryKey: ['modelos-acesso'], queryFn: listarModelosAcesso })

  const [rascunho, setRascunho] = useState<MapaAcesso | null>(null)
  // null = automático (abre sozinho quando o colaborador está sem acesso nenhum)
  const [painelAberto, setPainelAberto] = useState<boolean | null>(null)

  const condominios = useMemo(() => dadosQ.data?.condominios ?? [], [dadosQ.data])
  const original = useMemo(
    () => mapaDePermissoes(dadosQ.data?.permissoes ?? []),
    [dadosQ.data],
  )
  const atual = rascunho ?? original
  const modelos = modelosQ.data ?? []

  const alteracoes = useMemo(
    () => diferencas(original, atual, condominios.map((c) => c.id)),
    [original, atual, condominios],
  )

  const usuario = dadosQ.data?.usuario
  const somenteVisualizar = usuario?.papel === 'conselheiro_fiscal'
  const semAcessoNenhum = Object.values(original).every((l) => Object.keys(l).length === 0)
  const painelVisivel = painelAberto ?? (semAcessoNenhum && condominios.length > 0)

  // Avisa ao tentar fechar/recarregar a aba com alterações não salvas
  useEffect(() => {
    if (alteracoes.length === 0) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [alteracoes.length])

  function editar(fn: (m: MapaAcesso) => MapaAcesso) {
    setRascunho(fn(atual))
  }

  function alterarCelula(condominioId: string, modulo: string, nivel: NivelPermissao | null) {
    editar((m) => ({ ...m, [condominioId]: definirNivel(m[condominioId] ?? {}, modulo, nivel) }))
  }

  function substituirLinha(condominioId: string, linha: LinhaAcesso) {
    editar((m) => ({ ...m, [condominioId]: limitarLinha(linha, somenteVisualizar) }))
  }

  function aplicarEmLote(origem: LinhaAcesso, destinos: string[], modo: ModoAplicacao) {
    editar((m) => {
      const novo = { ...m }
      for (const id of destinos) {
        novo[id] = limitarLinha(aplicarNaLinha(m[id] ?? {}, origem, modo), somenteVisualizar)
      }
      return novo
    })
  }

  const salvar = useMutation({
    mutationFn: () => salvarAcessosUsuario(usuarioId, alteracoes),
    onSuccess: (dados) => {
      qc.setQueryData(['acessos', 'usuario', usuarioId], dados)
      qc.invalidateQueries({ queryKey: ['acessos', 'resumo'] })
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      setRascunho(null)
      toast.success('Acessos salvos.')
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError ? err.message || 'Falha ao salvar.' : 'Falha ao salvar.',
      ),
  })

  if (dadosQ.isLoading) return <p className="muted">Carregando…</p>
  if (dadosQ.isError || !usuario) {
    return (
      <div className="card empty-state">
        <p>Colaborador não encontrado.</p>
        <Link to="/acessos" className="btn btn-ghost">
          Voltar
        </Link>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <Link to="/acessos" className="muted" style={{ fontSize: '0.85rem' }}>
          ← Gestão de Acessos
        </Link>
        <h1>{usuario.nome}</h1>
        <p>
          {usuario.email}
          {somenteVisualizar && ' · Conselho Fiscal (somente leitura)'}
        </p>
      </header>

      {!usuario.ativo && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="muted">Usuário inativo — não é possível alterar acessos.</p>
        </div>
      )}

      {condominios.length === 0 ? (
        <div className="card empty-state">
          <p>Nenhum condomínio ativo cadastrado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {semAcessoNenhum && alteracoes.length === 0 && (
            <div className="card acessos-item" data-alerta="true">
              <span>
                Este colaborador ainda não tem acesso a nenhum condomínio. Escolha um modelo e
                marque os condomínios abaixo.
              </span>
            </div>
          )}

          {painelVisivel ? (
            <AplicarEmLote
              condominios={condominios}
              modelos={modelos}
              rascunho={atual}
              onAplicar={aplicarEmLote}
              onFechar={() => setPainelAberto(false)}
            />
          ) : (
            <div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPainelAberto(true)}
              >
                Aplicar em vários condomínios…
              </button>
            </div>
          )}

          <div className="card">
            <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              Clique numa célula para alternar: <strong>—</strong> sem acesso →{' '}
              <strong>Ver</strong> → <strong>Editar</strong>. Células com contorno amarelo foram
              alteradas e ainda não salvas. Auditoria é sempre somente leitura.
            </p>
            <MatrizAcesso
              condominios={condominios}
              original={original}
              rascunho={atual}
              modelos={modelos}
              somenteVisualizar={somenteVisualizar}
              onAlterarCelula={alterarCelula}
              onSubstituirLinha={substituirLinha}
            />
          </div>
        </div>
      )}

      {alteracoes.length > 0 && (
        <div className="acessos-barra-salvar">
          <span>
            {alteracoes.length} alteração(ões) não salva(s)
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={salvar.isPending}
              onClick={() => setRascunho(null)}
            >
              Descartar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={salvar.isPending || !usuario.ativo}
              onClick={() => salvar.mutate()}
            >
              {salvar.isPending ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
