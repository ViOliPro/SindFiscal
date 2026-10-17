import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { dispensarConciliacao, listarPendencias } from '@/services/api'
import type { Pendencia, TipoPendencia } from '@/types'
import { useCondominioStore } from '@/stores/condominioStore'

function formatMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatData(iso: string | null) {
  if (!iso) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function ErroApi({ error }: { error: unknown }) {
  if (!error) return null
  const msg = error instanceof Error ? error.message : 'Erro'
  return <p style={{ color: 'var(--color-danger)' }}>{msg}</p>
}

const SECOES: { tipo: TipoPendencia; titulo: string; ajuda: string }[] = [
  {
    tipo: 'lancamento_sem_pagamento',
    titulo: 'Saídas sem pagamento vinculado',
    ajuda:
      'Saiu dinheiro, mas nenhum pagamento foi ligado a esta saída, então o fundo responsável não está definido. Registre o pagamento reconciliando o lançamento, ou dispense se for despesa ordinária da administradora.',
  },
  {
    tipo: 'compromisso_sem_fundo',
    titulo: 'Compromissos abertos sem fundo previsto',
    ajuda: 'Não entram na projeção por fundo até você definir o fundo.',
  },
  {
    tipo: 'necessidade_sem_valor',
    titulo: 'Necessidades sem valor estimado',
    ajuda: 'Sem valor nem cotação, não pesam na projeção de caixa.',
  },
]

export function PendenciasPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const qc = useQueryClient()
  const [desde, setDesde] = useState('')
  const [dispensando, setDispensando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  const pendQ = useQuery({
    queryKey: ['pendencias', condominioId, desde],
    queryFn: () => listarPendencias(condominioId!, desde || undefined),
    enabled: !!condominioId,
  })

  const dispensarM = useMutation({
    mutationFn: (v: { id: string; motivo: string }) =>
      dispensarConciliacao(condominioId!, v.id, v.motivo),
    onSuccess: () => {
      setDispensando(null)
      setMotivo('')
      qc.invalidateQueries({ queryKey: ['pendencias', condominioId] })
      qc.invalidateQueries({ queryKey: ['dashboard', condominioId] })
    },
  })

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Pendências</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  const data = pendQ.data

  function acao(p: Pendencia) {
    if (p.tipo === 'lancamento_sem_pagamento') {
      return (
        <>
          <Link to="/pagamentos" className="btn btn-ghost">
            Registrar pagamento
          </Link>{' '}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setDispensando(dispensando === p.referenciaId ? null : p.referenciaId)
              setMotivo('')
            }}
          >
            Dispensar
          </button>
        </>
      )
    }
    return (
      <Link to="/despesas-futuras" className="btn btn-ghost">
        Ajustar planejamento
      </Link>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1>Pendências</h1>
        <p>
          RF17 — itens que pedem uma decisão sua para a projeção e a prestação de contas ficarem
          consistentes.
        </p>
      </header>

      <div className="df-filtros">
        <label>
          Saídas a partir de
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        {desde && (
          <button type="button" className="btn btn-ghost" onClick={() => setDesde('')}>
            Limpar
          </button>
        )}
      </div>

      {pendQ.isLoading && <p className="muted">Carregando…</p>}
      <ErroApi error={pendQ.error ?? dispensarM.error} />

      {data && data.total === 0 && (
        <div className="card">
          <p>Nenhuma pendência. Tudo conciliado.</p>
        </div>
      )}

      {data &&
        SECOES.map((sec) => {
          const itens = data.itens.filter((i) => i.tipo === sec.tipo)
          const total =
            sec.tipo === 'lancamento_sem_pagamento'
              ? data.lancamentosSemPagamento
              : sec.tipo === 'compromisso_sem_fundo'
                ? data.compromissosSemFundo
                : data.necessidadesSemValor
          if (total === 0) return null
          return (
            <div className="card" key={sec.tipo} style={{ marginBottom: '1rem' }}>
              <h3>
                {sec.titulo} <span className="badge">{total}</span>
              </h3>
              <p className="muted" style={{ margin: '0.25rem 0 0.75rem' }}>
                {sec.ajuda}
              </p>
              <div className="df-tabela-wrap">
                <table className="df-tabela">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Data</th>
                      <th className="df-num">Valor</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((p) => (
                      <PendenciaLinha
                        key={`${p.tipo}-${p.referenciaId}`}
                        p={p}
                        acao={acao(p)}
                        dispensando={dispensando === p.referenciaId}
                        motivo={motivo}
                        onMotivo={setMotivo}
                        salvando={dispensarM.isPending}
                        onConfirmar={() =>
                          dispensarM.mutate({ id: p.referenciaId, motivo: motivo.trim() })
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {total > itens.length && (
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Mostrando {itens.length} de {total}.
                </p>
              )}
            </div>
          )
        })}
    </div>
  )
}

function PendenciaLinha({
  p,
  acao,
  dispensando,
  motivo,
  onMotivo,
  salvando,
  onConfirmar,
}: {
  p: Pendencia
  acao: React.ReactNode
  dispensando: boolean
  motivo: string
  onMotivo: (v: string) => void
  salvando: boolean
  onConfirmar: () => void
}) {
  return (
    <>
      <tr>
        <td>
          {p.descricao}
          {p.detalhe && (
            <div className="muted" style={{ fontSize: '0.75rem' }}>
              {p.detalhe}
            </div>
          )}
        </td>
        <td>{formatData(p.data)}</td>
        <td className="df-num">{p.valor != null ? formatMoney(p.valor) : '—'}</td>
        <td style={{ whiteSpace: 'nowrap' }}>{acao}</td>
      </tr>
      {dispensando && (
        <tr>
          <td colSpan={4}>
            <div className="df-filtros" style={{ marginBottom: 0 }}>
              <label style={{ flex: 1, minWidth: '240px' }}>
                Motivo da dispensa
                <input
                  value={motivo}
                  maxLength={200}
                  placeholder="Ex.: despesa ordinária paga pela administradora"
                  onChange={(e) => onMotivo(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={motivo.trim() === '' || salvando}
                onClick={onConfirmar}
              >
                Confirmar dispensa
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
