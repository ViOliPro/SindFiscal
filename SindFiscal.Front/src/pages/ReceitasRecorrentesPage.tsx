import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  atualizarReceitaRecorrente,
  criarReceitaRecorrente,
  gerarRecorrentesDoPeriodo,
  listarContas,
  listarReceitasRecorrentes,
  type ReceitaRecorrenteInput,
} from '@/services/api'
import {
  MOTIVO_TRANSFERENCIA_LABEL,
  type MotivoTransferencia,
  type ReceitaRecorrente,
} from '@/types'
import { useCondominioStore } from '@/stores/condominioStore'

const MOTIVOS: MotivoTransferencia[] = ['destinacao_receita', 'aporte']

function formatMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "2026-10-01" → "10/2026" */
function formatMes(iso: string | null) {
  if (!iso) return '—'
  const [a, m] = iso.split('-')
  return `${m}/${a}`
}

function mesAtual() {
  return new Date().toISOString().slice(0, 7)
}

function ErroApi({ error }: { error: unknown }) {
  if (!error) return null
  const msg = error instanceof Error ? error.message : 'Erro'
  return <p style={{ color: 'var(--color-danger)' }}>{msg}</p>
}

interface FormState {
  descricao: string
  valor: string
  motivo: MotivoTransferencia
  contaOrigemId: string
  contaDestinoId: string
  inicio: string // YYYY-MM
  fim: string // YYYY-MM ou ''
}

const FORM_VAZIO: FormState = {
  descricao: '',
  valor: '',
  motivo: 'destinacao_receita',
  contaOrigemId: '',
  contaDestinoId: '',
  inicio: mesAtual(),
  fim: '',
}

export function ReceitasRecorrentesPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const qc = useQueryClient()
  const [mes, setMes] = useState(mesAtual())
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)

  const recorrentesQ = useQuery({
    queryKey: ['receitas-recorrentes', condominioId],
    queryFn: () => listarReceitasRecorrentes(condominioId!),
    enabled: !!condominioId,
  })
  const contasQ = useQuery({
    queryKey: ['contas', condominioId],
    queryFn: () => listarContas(condominioId!),
    enabled: !!condominioId,
  })

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['receitas-recorrentes', condominioId] })
    qc.invalidateQueries({ queryKey: ['area-acerto', condominioId] })
  }

  const salvarM = useMutation({
    mutationFn: (v: { id: string | null; ativa: boolean; input: ReceitaRecorrenteInput }) =>
      v.id
        ? atualizarReceitaRecorrente(condominioId!, v.id, { ...v.input, ativa: v.ativa })
        : criarReceitaRecorrente(condominioId!, v.input),
    onSuccess: () => {
      setForm(FORM_VAZIO)
      setEditandoId(null)
      invalidar()
    },
  })

  const gerarM = useMutation({
    mutationFn: () => gerarRecorrentesDoPeriodo(condominioId!, `${mes}-01`),
    onSuccess: (r) => {
      setResultado(
        r.geradas === 0
          ? `Nenhum item novo: ${r.jaGeradas} recorrência(s) já tinham item em ${formatMes(`${mes}-01`)}.`
          : `${r.geradas} item(ns) gerado(s) para ${formatMes(`${mes}-01`)}` +
              (r.jaGeradas > 0 ? ` (${r.jaGeradas} já existiam).` : '.'),
      )
      invalidar()
    },
  })

  function toInput(f: FormState): ReceitaRecorrenteInput {
    return {
      descricao: f.descricao,
      valor: Number(f.valor),
      contaOrigemId: f.contaOrigemId || null,
      contaDestinoId: f.contaDestinoId,
      motivo: f.motivo,
      dataInicio: `${f.inicio}-01`,
      dataFim: f.fim ? `${f.fim}-01` : null,
    }
  }

  function editar(r: ReceitaRecorrente) {
    setEditandoId(r.id)
    setResultado(null)
    setForm({
      descricao: r.descricao,
      valor: String(r.valor),
      motivo: r.motivo,
      contaOrigemId: r.contaOrigemId,
      contaDestinoId: r.contaDestinoId,
      inicio: r.dataInicio.slice(0, 7),
      fim: r.dataFim ? r.dataFim.slice(0, 7) : '',
    })
  }

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Receitas Recorrentes</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  const contas = contasQ.data ?? []
  const recorrentes = recorrentesQ.data ?? []
  const formValido =
    form.descricao.trim() !== '' &&
    Number(form.valor) > 0 &&
    form.contaDestinoId !== '' &&
    form.inicio !== ''
  const ativaEmEdicao = recorrentes.find((r) => r.id === editandoId)?.ativa ?? true

  return (
    <div>
      <header className="page-header">
        <h1>Receitas Recorrentes</h1>
        <p>
          RF14 · RN20 · RN22 — receitas e transferências mensais que viram item pendente na{' '}
          <Link to="/acerto">Área de Acerto</Link> (ex.: receita de antena que pertence a um
          fundo; depósito mensal a um fundo).
        </p>
      </header>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>Gerar itens do mês</h3>
        <div className="df-filtros" style={{ marginBottom: 0 }}>
          <label>
            Competência
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!mes || gerarM.isPending}
            onClick={() => {
              setResultado(null)
              gerarM.mutate()
            }}
          >
            Gerar itens
          </button>
        </div>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Pode gerar de novo sem medo: uma recorrência nunca cria dois itens no mesmo mês.
        </p>
        {resultado && <p style={{ marginTop: '0.5rem' }}>{resultado}</p>}
        <ErroApi error={gerarM.error} />
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>
          {editandoId ? 'Editar recorrência' : 'Nova recorrência'}
        </h3>
        <div className="df-filtros" style={{ marginBottom: 0 }}>
          <label>
            Descrição
            <input
              value={form.descricao}
              maxLength={150}
              placeholder="Ex.: Antena"
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </label>
          <label>
            Valor mensal
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
            />
          </label>
          <label>
            Tipo
            <select
              value={form.motivo}
              onChange={(e) => setForm({ ...form, motivo: e.target.value as MotivoTransferencia })}
            >
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {MOTIVO_TRANSFERENCIA_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sai de
            <select
              value={form.contaOrigemId}
              onChange={(e) => setForm({ ...form, contaOrigemId: e.target.value })}
            >
              <option value="">Conta operacional</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vai para
            <select
              value={form.contaDestinoId}
              onChange={(e) => setForm({ ...form, contaDestinoId: e.target.value })}
            >
              <option value="">Selecione…</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            A partir de
            <input
              type="month"
              value={form.inicio}
              onChange={(e) => setForm({ ...form, inicio: e.target.value })}
            />
          </label>
          <label>
            Até (opcional)
            <input
              type="month"
              value={form.fim}
              onChange={(e) => setForm({ ...form, fim: e.target.value })}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!formValido || salvarM.isPending}
            onClick={() =>
              salvarM.mutate({ id: editandoId, ativa: ativaEmEdicao, input: toInput(form) })
            }
          >
            {editandoId ? 'Salvar alterações' : 'Adicionar'}
          </button>
          {editandoId && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEditandoId(null)
                setForm(FORM_VAZIO)
              }}
            >
              Cancelar
            </button>
          )}
        </div>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Alterar uma recorrência não muda itens já gerados.
        </p>
        <ErroApi error={salvarM.error} />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '0.75rem' }}>Recorrências cadastradas</h3>
        {recorrentesQ.isLoading && <p className="muted">Carregando…</p>}
        <ErroApi error={recorrentesQ.error} />
        {!recorrentesQ.isLoading && recorrentes.length === 0 && (
          <p className="muted">Nenhuma recorrência cadastrada.</p>
        )}
        {recorrentes.length > 0 && (
          <div className="df-tabela-wrap">
            <table className="df-tabela">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Tipo</th>
                  <th>Origem → Destino</th>
                  <th className="df-num">Valor</th>
                  <th>Vigência</th>
                  <th>Último gerado</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recorrentes.map((r) => (
                  <tr key={r.id} style={r.ativa ? undefined : { opacity: 0.6 }}>
                    <td>{r.descricao}</td>
                    <td>{MOTIVO_TRANSFERENCIA_LABEL[r.motivo]}</td>
                    <td>
                      {r.contaOrigemNome} → {r.contaDestinoNome}
                    </td>
                    <td className="df-num">{formatMoney(r.valor)}</td>
                    <td>
                      {formatMes(r.dataInicio)} – {r.dataFim ? formatMes(r.dataFim) : 'sem fim'}
                    </td>
                    <td>{formatMes(r.ultimoPeriodoGerado)}</td>
                    <td>{r.ativa ? 'Ativa' : 'Inativa'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => editar(r)}>
                        Editar
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={salvarM.isPending}
                        onClick={() =>
                          salvarM.mutate({
                            id: r.id,
                            ativa: !r.ativa,
                            input: {
                              descricao: r.descricao,
                              valor: r.valor,
                              contaOrigemId: r.contaOrigemId,
                              contaDestinoId: r.contaDestinoId,
                              motivo: r.motivo,
                              dataInicio: r.dataInicio,
                              dataFim: r.dataFim,
                            },
                          })
                        }
                      >
                        {r.ativa ? 'Desativar' : 'Reativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
