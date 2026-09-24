import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  confirmarExecucaoAcerto,
  consolidarItensAcerto,
  listarAreaDeAcerto,
} from '@/services/api'
import { MOTIVO_TRANSFERENCIA_LABEL, type Transferencia } from '@/types'
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

function Grupo({
  titulo,
  itens,
  selecionados,
  onToggle,
  onConfirmar,
  confirmando,
}: {
  titulo: string
  itens: Transferencia[]
  selecionados: Set<string>
  onToggle: (id: string) => void
  onConfirmar: (id: string) => void
  confirmando: boolean
}) {
  if (itens.length === 0) {
    return (
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>{titulo}</h3>
        <p className="muted">Nenhum item pendente.</p>
      </div>
    )
  }
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h3 style={{ marginBottom: '0.75rem' }}>
        {titulo} <span className="badge">{itens.length}</span>
      </h3>
      <ul style={{ listStyle: 'none', display: 'grid', gap: '0.5rem' }}>
        {itens.map((t) => (
          <li
            key={t.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <input
                type="checkbox"
                checked={selecionados.has(t.id)}
                onChange={() => onToggle(t.id)}
              />
              <span>
                {t.contaOrigemNome} → {t.contaDestinoNome}
                <strong style={{ marginLeft: '0.5rem' }}>{formatMoney(t.valor)}</strong>
                <span className="muted" style={{ marginLeft: '0.5rem' }}>
                  {MOTIVO_TRANSFERENCIA_LABEL[t.motivo]}
                </span>
              </span>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={confirmando}
              onClick={() => onConfirmar(t.id)}
            >
              Confirmar execução
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AcertoPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const qc = useQueryClient()
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const acertoQ = useQuery({
    queryKey: ['area-acerto', condominioId],
    queryFn: () => listarAreaDeAcerto(condominioId!),
    enabled: !!condominioId,
  })

  const consolidarM = useMutation({
    mutationFn: (ids: string[]) => consolidarItensAcerto(condominioId!, ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['area-acerto', condominioId] })
      setSelecionados(new Set())
    },
  })
  const confirmarM = useMutation({
    mutationFn: (id: string) =>
      confirmarExecucaoAcerto(
        condominioId!,
        id,
        new Date().toISOString().slice(0, 10),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['area-acerto', condominioId] })
      qc.invalidateQueries({ queryKey: ['contas', condominioId] })
      qc.invalidateQueries({ queryKey: ['dashboard', condominioId] })
    },
  })

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Área de Acerto</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  const data = acertoQ.data

  return (
    <div>
      <header className="page-header">
        <h1>Área de Acerto</h1>
        <p>RF14 — reposição · aporte · destinação de receita (RN17–RN24)</p>
      </header>

      {acertoQ.isLoading && <p className="muted">Carregando…</p>}
      <ErroApi error={acertoQ.error} />

      {data && (
        <>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={selecionados.size < 2 || consolidarM.isPending}
              onClick={() => consolidarM.mutate([...selecionados])}
            >
              Consolidar selecionados ({selecionados.size})
            </button>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Só consolida itens com mesma origem, destino e motivo.
            </span>
          </div>
          <ErroApi error={consolidarM.error} />
          <ErroApi error={confirmarM.error} />

          <Grupo
            titulo="Reposições"
            itens={data.reposicoes}
            selecionados={selecionados}
            onToggle={toggle}
            onConfirmar={(id) => confirmarM.mutate(id)}
            confirmando={confirmarM.isPending}
          />
          <Grupo
            titulo="Aportes"
            itens={data.aportes}
            selecionados={selecionados}
            onToggle={toggle}
            onConfirmar={(id) => confirmarM.mutate(id)}
            confirmando={confirmarM.isPending}
          />
          <Grupo
            titulo="Destinações de receita"
            itens={data.destinacoesReceita}
            selecionados={selecionados}
            onToggle={toggle}
            onConfirmar={(id) => confirmarM.mutate(id)}
            confirmando={confirmarM.isPending}
          />
        </>
      )}
    </div>
  )
}
