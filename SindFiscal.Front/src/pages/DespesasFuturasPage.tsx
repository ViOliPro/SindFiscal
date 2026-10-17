import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  atualizarPlanejamentoCompromisso,
  atualizarPlanejamentoNecessidade,
  definirFundoNoPlanejamento,
  listarDespesasFuturas,
  listarFornecedores,
  obterProjecaoFundos,
} from '@/services/api'
import {
  ETAPA_DESPESA_FUTURA_LABEL,
  PRIORIDADE_LABEL,
  type DespesaFutura,
  type EtapaDespesaFutura,
  type FiltroDespesasFuturas,
  type Prioridade,
} from '@/types'
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

const SEM_FUNDO = '__sem_fundo__'

export function DespesasFuturasPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const qc = useQueryClient()
  // Filtros na URL: sobrevivem a recarregar a página e podem ser compartilhados.
  const [params, setParams] = useSearchParams()
  const fundo = params.get('fundo') ?? ''
  const etapa = (params.get('etapa') ?? '') as EtapaDespesaFutura | ''
  const prioridade = (params.get('prioridade') ?? '') as Prioridade | ''
  const fornecedor = params.get('fornecedor') ?? ''
  const de = params.get('de') ?? ''
  const ate = params.get('ate') ?? ''
  const [busca, setBusca] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)

  function setFiltro(chave: string, valor: string) {
    const next = new URLSearchParams(params)
    if (valor) next.set(chave, valor)
    else next.delete(chave)
    setParams(next, { replace: true })
  }

  const filtro: FiltroDespesasFuturas = {
    fundoId: fundo && fundo !== SEM_FUNDO ? fundo : undefined,
    semFundo: fundo === SEM_FUNDO,
    etapa: etapa || undefined,
    prioridade: prioridade || undefined,
    fornecedorId: fornecedor || undefined,
    de: de || undefined,
    ate: ate || undefined,
  }

  const listaQ = useQuery({
    queryKey: ['despesas-futuras', condominioId, 'lista', filtro],
    queryFn: () => listarDespesasFuturas(condominioId!, filtro),
    enabled: !!condominioId,
  })
  const fornecedoresQ = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => listarFornecedores(),
    enabled: !!condominioId,
  })
  const projecaoQ = useQuery({
    queryKey: ['despesas-futuras', condominioId, 'projecao', ate],
    queryFn: () => obterProjecaoFundos(condominioId!, ate || undefined),
    enabled: !!condominioId,
  })

  const invalidar = () => qc.invalidateQueries({ queryKey: ['despesas-futuras', condominioId] })

  const considerarM = useMutation({
    mutationFn: (v: { contaId: string; considerar: boolean }) =>
      definirFundoNoPlanejamento(condominioId!, v.contaId, v.considerar),
    onSuccess: invalidar,
  })

  const salvarM = useMutation({
    mutationFn: (v: {
      item: DespesaFutura
      prioridade: Prioridade | null
      dataPrevista: string | null
      fundoPrevistoId: string | null
      valorEstimado: number | null
    }) =>
      v.item.origem === 'compromisso'
        ? atualizarPlanejamentoCompromisso(condominioId!, v.item.id, {
            prioridade: v.prioridade,
            dataPrevista: v.dataPrevista,
            fundoPrevistoId: v.fundoPrevistoId,
          })
        : atualizarPlanejamentoNecessidade(condominioId!, v.item.id, {
            prioridade: v.prioridade,
            dataPrevista: v.dataPrevista,
            fundoPrevistoId: v.fundoPrevistoId,
            valorEstimado: v.valorEstimado,
          }),
    onSuccess: () => {
      setEditandoId(null)
      invalidar()
    },
  })

  const itens = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const todos = listaQ.data?.itens ?? []
    if (!termo) return todos
    return todos.filter(
      (i) =>
        i.descricao.toLowerCase().includes(termo) || i.categoria.toLowerCase().includes(termo),
    )
  }, [listaQ.data, busca])

  const proj = projecaoQ.data
  const fundosEmDeficit = proj?.fundos.filter((f) => f.consideradoNoPlanejamento && f.emDeficit) ?? []
  const temFiltro = !!(fundo || etapa || prioridade || fornecedor || de || ate || busca)

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Despesas Futuras</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1>Despesas Futuras</h1>
        <p>
          RF13 · RF16 — necessidades planejadas e compromissos abertos, com projeção de saldo por
          fundo. A prioridade é só um rótulo: a ordem da fila continua manual (RN11).
        </p>
      </header>

      <ErroApi error={listaQ.error ?? projecaoQ.error} />

      {fundosEmDeficit.length > 0 && proj && (
        <div className="df-alerta df-alerta-erro" role="alert">
          <strong>
            {fundosEmDeficit.length === 1
              ? '1 fundo ficará negativo'
              : `${fundosEmDeficit.length} fundos ficarão negativos`}{' '}
            após as despesas {ate ? `até ${formatData(ate)}` : 'previstas'}:
          </strong>{' '}
          {fundosEmDeficit.map((f) => `${f.nome} (${formatMoney(-f.saldoProjetado)})`).join(', ')}.
          {proj.necessidadeAdicionalPorFundo > proj.necessidadeAdicionalAgregada && (
            <>
              {' '}
              Somando o déficit de cada fundo, a necessidade adicional é de{' '}
              <strong>{formatMoney(proj.necessidadeAdicionalPorFundo)}</strong> — maior que a
              diferença do total agregado ({formatMoney(proj.necessidadeAdicionalAgregada)}),
              porque o saldo de um fundo não cobre o déficit de outro.
            </>
          )}
        </div>
      )}

      {proj && proj.quantidadeSemFundo > 0 && (
        <div className="df-alerta">
          {proj.quantidadeSemFundo}{' '}
          {proj.quantidadeSemFundo === 1 ? 'despesa está' : 'despesas estão'} sem fundo definido (
          {formatMoney(proj.provisionadoSemFundo)}) e não entram na projeção por fundo. Defina o
          fundo para a projeção ficar completa.
        </div>
      )}

      {proj && (
        <>
          <div className="df-grid">
            <div className="card df-stat">
              <small>Saldo disponível atual</small>
              <strong>{formatMoney(proj.saldoDisponivelAtual)}</strong>
            </div>
            <div className="card df-stat">
              <small>Total provisionado</small>
              <strong>{formatMoney(proj.totalProvisionado)}</strong>
            </div>
            <div className="card df-stat">
              <small>Compromissos aprovados pendentes</small>
              <strong>{formatMoney(proj.compromissosAprovadosPendentes)}</strong>
            </div>
            <div className="card df-stat">
              <small>Previsões futuras</small>
              <strong>{formatMoney(proj.previsoesFuturas)}</strong>
            </div>
            <div className="card df-stat">
              <small>Saldo após compromissos aprovados</small>
              <strong className={proj.saldoAposAprovados < 0 ? 'df-neg' : undefined}>
                {formatMoney(proj.saldoAposAprovados)}
              </strong>
            </div>
            <div className="card df-stat">
              <small>Saldo após aprovados + previsões</small>
              <strong className={proj.saldoAposTudo < 0 ? 'df-neg' : undefined}>
                {formatMoney(proj.saldoAposTudo)}
              </strong>
            </div>
            <div className="card df-stat">
              <small>Necessidade adicional (total agregado)</small>
              <strong>{formatMoney(proj.necessidadeAdicionalAgregada)}</strong>
            </div>
            <div className="card df-stat">
              <small>Necessidade adicional (soma por fundo)</small>
              <strong className={proj.necessidadeAdicionalPorFundo > 0 ? 'df-neg' : undefined}>
                {formatMoney(proj.necessidadeAdicionalPorFundo)}
              </strong>
            </div>
          </div>

          <h3 style={{ marginBottom: '0.5rem' }}>Projeção por fundo</h3>
          <div className="df-grid">
            {proj.fundos.map((f) => (
              <div
                key={f.fundoId}
                className={`card ${f.consideradoNoPlanejamento && f.emDeficit ? 'df-fundo-deficit' : ''}`}
                style={f.consideradoNoPlanejamento ? undefined : { opacity: 0.65 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <strong>{f.nome}</strong>
                  {f.consideradoNoPlanejamento && f.emDeficit && (
                    <span className="badge" style={{ color: 'var(--color-danger)' }}>
                      Déficit
                    </span>
                  )}
                </div>
                <p className="muted">
                  Saldo atual: <strong>{formatMoney(f.saldoAtual)}</strong>
                  <br />
                  Aprovado/contratado: {formatMoney(f.provisionadoAprovado)}
                  <br />
                  Planejado: {formatMoney(f.provisionadoPlanejado)}
                  <br />
                  Saldo projetado:{' '}
                  <strong className={f.saldoProjetado < 0 ? 'df-neg' : undefined}>
                    {formatMoney(f.saldoProjetado)}
                  </strong>
                </p>
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.8rem' }}>
                  <input
                    type="checkbox"
                    checked={f.consideradoNoPlanejamento}
                    disabled={considerarM.isPending}
                    onChange={(e) =>
                      considerarM.mutate({ contaId: f.fundoId, considerar: e.target.checked })
                    }
                  />
                  Considerar nos totais
                </label>
              </div>
            ))}
          </div>
          {proj.provisionadoForaDoPlanejamento > 0 && (
            <p className="muted" style={{ marginBottom: '1rem' }}>
              {formatMoney(proj.provisionadoForaDoPlanejamento)} estão em fundos fora do planejamento
              e não entram nos totais acima.
            </p>
          )}
          <ErroApi error={considerarM.error} />
        </>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '0.75rem' }}>Despesas cadastradas</h3>

        <div className="df-filtros">
          <label>
            Fundo
            <select value={fundo} onChange={(e) => setFiltro('fundo', e.target.value)}>
              <option value="">Todos</option>
              <option value={SEM_FUNDO}>Sem fundo definido</option>
              {proj?.fundos.map((f) => (
                <option key={f.fundoId} value={f.fundoId}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Etapa
            <select value={etapa} onChange={(e) => setFiltro('etapa', e.target.value)}>
              <option value="">Todas</option>
              {(Object.keys(ETAPA_DESPESA_FUTURA_LABEL) as EtapaDespesaFutura[]).map((k) => (
                <option key={k} value={k}>
                  {ETAPA_DESPESA_FUTURA_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioridade
            <select value={prioridade} onChange={(e) => setFiltro('prioridade', e.target.value)}>
              <option value="">Todas</option>
              {(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map((k) => (
                <option key={k} value={k}>
                  {PRIORIDADE_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fornecedor
            <select value={fornecedor} onChange={(e) => setFiltro('fornecedor', e.target.value)}>
              <option value="">Todos</option>
              {fornecedoresQ.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            De
            <input type="date" value={de} onChange={(e) => setFiltro('de', e.target.value)} />
          </label>
          <label>
            Até (também limita a projeção)
            <input type="date" value={ate} onChange={(e) => setFiltro('ate', e.target.value)} />
          </label>
          <label>
            Buscar
            <input
              type="search"
              value={busca}
              placeholder="Descrição ou categoria"
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          {temFiltro && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setParams(new URLSearchParams(), { replace: true })
                setBusca('')
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
        <p className="muted" style={{ marginBottom: '0.5rem' }}>
          Itens sem data prevista aparecem sempre, mesmo com filtro de período. O filtro de
          fornecedor mostra apenas compromissos com cotação escolhida na aprovação.
        </p>

        {listaQ.isLoading && <p className="muted">Carregando…</p>}
        {!listaQ.isLoading && itens.length === 0 && (
          <p className="muted">Nenhuma despesa encontrada.</p>
        )}

        {itens.length > 0 && (
          <div className="df-tabela-wrap">
            <table className="df-tabela">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Etapa</th>
                  <th>Prioridade</th>
                  <th>Data prevista</th>
                  <th>Fundo</th>
                  <th>Fornecedor</th>
                  <th className="df-num">Valor</th>
                  <th className="df-num">A pagar</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {itens.map((i) => (
                  <ItemLinha
                    key={`${i.origem}-${i.id}`}
                    item={i}
                    fundos={proj?.fundos ?? []}
                    editando={editandoId === i.id}
                    salvando={salvarM.isPending}
                    onEditar={() => setEditandoId(editandoId === i.id ? null : i.id)}
                    onSalvar={(v) => salvarM.mutate({ item: i, ...v })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ErroApi error={salvarM.error} />

        {listaQ.data && itens.length > 0 && !busca && (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            {listaQ.data.quantidade} item(ns) · a pagar {formatMoney(listaQ.data.totalProvisionado)}{' '}
            (aprovado/contratado {formatMoney(listaQ.data.totalAprovado)} · planejado{' '}
            {formatMoney(listaQ.data.totalPlanejado)})
          </p>
        )}
      </div>
    </div>
  )
}

interface ItemLinhaProps {
  item: DespesaFutura
  fundos: { fundoId: string; nome: string }[]
  editando: boolean
  salvando: boolean
  onEditar: () => void
  onSalvar: (v: {
    prioridade: Prioridade | null
    dataPrevista: string | null
    fundoPrevistoId: string | null
    valorEstimado: number | null
  }) => void
}

function ItemLinha({ item, fundos, editando, salvando, onEditar, onSalvar }: ItemLinhaProps) {
  const [prioridade, setPrioridade] = useState<Prioridade | ''>(item.prioridade ?? '')
  const [data, setData] = useState(item.dataPrevista ?? '')
  const [fundoId, setFundoId] = useState(item.fundoId ?? '')
  const [valorEstimado, setValorEstimado] = useState(
    item.origem === 'necessidade' && !item.semValor ? String(item.valor) : '',
  )

  return (
    <>
      <tr>
        <td>
          {item.descricao}
          <div className="muted" style={{ fontSize: '0.75rem' }}>
            {item.categoria}
            {item.origem === 'necessidade' &&
              ` · ${item.quantidadeCotacoes ?? 0} cotação(ões)`}
            {item.prioridadeFila != null && ` · fila #${item.prioridadeFila}`}
          </div>
        </td>
        <td>
          <span className="badge">{ETAPA_DESPESA_FUTURA_LABEL[item.etapa]}</span>
        </td>
        <td>{item.prioridade ? PRIORIDADE_LABEL[item.prioridade] : '—'}</td>
        <td>
          {formatData(item.dataPrevista)}
          {item.atrasada && (
            <span className="df-neg" style={{ marginLeft: '0.35rem', fontSize: '0.75rem' }}>
              atrasada
            </span>
          )}
        </td>
        <td>
          {item.fundoNome ?? (
            <span style={{ color: 'var(--color-warning)' }}>Sem fundo</span>
          )}
        </td>
        <td>{item.fornecedorNome ?? '—'}</td>
        <td className="df-num">
          {item.semValor ? (
            <span style={{ color: 'var(--color-warning)' }}>Sem valor</span>
          ) : (
            formatMoney(item.valor)
          )}
        </td>
        <td className="df-num">{formatMoney(item.valorProvisionado)}</td>
        <td>
          <button type="button" className="btn btn-ghost" onClick={onEditar}>
            {editando ? 'Fechar' : 'Planejar'}
          </button>
        </td>
      </tr>
      {editando && (
        <tr>
          <td colSpan={9}>
            <div className="df-filtros" style={{ marginBottom: 0 }}>
              <label>
                Prioridade
                <select
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value as Prioridade | '')}
                >
                  <option value="">—</option>
                  {(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map((k) => (
                    <option key={k} value={k}>
                      {PRIORIDADE_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data prevista
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </label>
              <label>
                Fundo
                <select value={fundoId} onChange={(e) => setFundoId(e.target.value)}>
                  <option value="">Sem fundo definido</option>
                  {fundos.map((f) => (
                    <option key={f.fundoId} value={f.fundoId}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </label>
              {item.origem === 'necessidade' && (
                <label>
                  Valor estimado
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorEstimado}
                    placeholder="usa a menor cotação"
                    onChange={(e) => setValorEstimado(e.target.value)}
                  />
                </label>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={salvando}
                onClick={() =>
                  onSalvar({
                    prioridade: prioridade || null,
                    dataPrevista: data || null,
                    fundoPrevistoId: fundoId || null,
                    valorEstimado: valorEstimado === '' ? null : Number(valorEstimado),
                  })
                }
              >
                Salvar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
