import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { obterRelatorioMensal } from '@/services/api'
import {
  CLASSIFICACAO_DESPESA_LABEL,
  MOTIVO_TRANSFERENCIA_LABEL,
  type ClassificacaoDespesa,
  type RelatorioMensal,
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

function formatPct(v: number | null) {
  if (v == null) return '—'
  const n = v * 100
  return `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')}%`
}

function formatVariacao(v: number) {
  return `${v > 0 ? '+' : ''}${formatMoney(v)}`
}

function mesAnteriorISO() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7)
}

function nomeMes(iso: string) {
  const [a, m] = iso.split('-').map(Number)
  const nome = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return nome
}

function mesAnteriorDe(iso: string) {
  const [a, m] = iso.split('-').map(Number)
  return new Date(a, m - 2, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function ErroApi({ error }: { error: unknown }) {
  if (!error) return null
  const msg = error instanceof Error ? error.message : 'Erro'
  return <p style={{ color: 'var(--color-danger)' }}>{msg}</p>
}

/** Resumo executivo: frases geradas só a partir dos números que a API devolveu. */
function resumoExecutivo(r: RelatorioMensal): string[] {
  const frases: string[] = []
  const { entradas, saidas, resultado } = r.resumo
  frases.push(
    `Em ${nomeMes(r.inicio)}, as entradas somaram ${formatMoney(entradas)} e as saídas ${formatMoney(saidas)}, ` +
      `com resultado de ${formatMoney(resultado)} (${resultado >= 0 ? 'superávit' : 'déficit'}).`,
  )
  const ant = r.mesAnterior.saidas
  if (ant > 0) {
    const pct = (saidas - ant) / ant
    frases.push(
      `As saídas ${pct >= 0 ? 'subiram' : 'caíram'} ${Math.abs(pct * 100).toFixed(1).replace('.', ',')}% ` +
        `(${formatVariacao(saidas - ant)}) em relação a ${mesAnteriorDe(r.inicio)}.`,
    )
  }
  if (saidas > 0) {
    frases.push(
      `As 3 maiores despesas concentram ${(r.concentracaoTop3 * 100).toFixed(1).replace('.', ',')}% das saídas.`,
    )
  }
  const conferir = r.despesasPorCategoria.filter((c) => c.classificacao === 'ponto_para_conferencia')
  if (conferir.length > 0) {
    frases.push(
      `Pontos para conferência (variação de pelo menos ${(r.limiarVariacao * 100).toFixed(0)}% e ${formatMoney(r.valorMinimoVariacao)}): ` +
        conferir.map((c) => `${c.categoria} (${formatPct(c.variacaoPercentual)})`).join(', ') +
        '.',
    )
  }
  const semVinculo = r.despesasPorCategoria.find((c) => c.classificacao === 'sem_vinculo')
  if (semVinculo && semVinculo.totalMes > 0) {
    frases.push(
      `${semVinculo.quantidade} saída(s) sem pagamento vinculado, somando ${formatMoney(semVinculo.totalMes)}.`,
    )
  }
  if (r.pendenciasAbertas > 0) {
    frases.push(`Há ${r.pendenciasAbertas} pendência(s) de consistência em aberto.`)
  }
  return frases
}

export function RelatorioMensalPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const [params, setParams] = useSearchParams()
  const mes = params.get('mes') ?? mesAnteriorISO()
  const classif = (params.get('classificacao') ?? '') as ClassificacaoDespesa | ''
  const fundo = params.get('fundo') ?? ''
  const [busca, setBusca] = useState('')

  function setParam(chave: string, valor: string) {
    const next = new URLSearchParams(params)
    if (valor) next.set(chave, valor)
    else next.delete(chave)
    setParams(next, { replace: true })
  }

  const relQ = useQuery({
    queryKey: ['relatorio-mensal', condominioId, mes],
    queryFn: () => obterRelatorioMensal(condominioId!, `${mes}-01`),
    enabled: !!condominioId && /^\d{4}-\d{2}$/.test(mes),
  })
  const r = relQ.data

  const despesas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (r?.despesas ?? []).filter(
      (d) =>
        (!classif || d.classificacao === classif) &&
        (!fundo ||
          (fundo === '__sem__' ? d.fundoResponsavelId == null : d.fundoResponsavelId === fundo)) &&
        (!termo ||
          d.descricao.toLowerCase().includes(termo) ||
          d.categoria.toLowerCase().includes(termo)),
    )
  }, [r, classif, fundo, busca])

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Relatório Mensal</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1>Relatório Mensal de Prestação de Contas</h1>
        <p>RF18 — resumo, movimentação por conta, despesas por categoria e pontos de conferência.</p>
      </header>

      <div className="df-filtros no-print">
        <label>
          Competência
          <input type="month" value={mes} onChange={(e) => setParam('mes', e.target.value)} />
        </label>
        <button type="button" className="btn btn-primary" disabled={!r} onClick={() => window.print()}>
          Imprimir / salvar PDF
        </button>
      </div>

      {relQ.isLoading && <p className="muted">Gerando relatório…</p>}
      <ErroApi error={relQ.error} />

      {r && (
        <>
          {r.parcial && (
            <div className="rm-aviso">
              Competência ainda em andamento: os valores são parciais e podem mudar até o fim do
              mês.
            </div>
          )}

          <div className="card rm-secao rm-resumo">
            <h3 style={{ marginBottom: '0.5rem' }}>Resumo executivo — {nomeMes(r.inicio)}</h3>
            {resumoExecutivo(r).map((f, i) => (
              <p key={i}>{f}</p>
            ))}
          </div>

          <div className="df-grid rm-secao">
            <div className="card df-stat">
              <small>Entradas</small>
              <strong>{formatMoney(r.resumo.entradas)}</strong>
            </div>
            <div className="card df-stat">
              <small>Saídas</small>
              <strong>{formatMoney(r.resumo.saidas)}</strong>
            </div>
            <div className="card df-stat">
              <small>Resultado</small>
              <strong className={r.resumo.resultado < 0 ? 'df-neg' : undefined}>
                {formatMoney(r.resumo.resultado)}
              </strong>
            </div>
            <div className="card df-stat">
              <small>Saídas no mês anterior</small>
              <strong>{formatMoney(r.mesAnterior.saidas)}</strong>
            </div>
            <div className="card df-stat">
              <small>Pagamentos registrados</small>
              <strong>{formatMoney(r.pagamentosRegistradosNoMes)}</strong>
            </div>
            <div className="card df-stat">
              <small>Compromissos aprovados</small>
              <strong>
                {r.compromissosAprovadosNoMes} · {formatMoney(r.valorCompromissosAprovadosNoMes)}
              </strong>
            </div>
          </div>

          <div className="card rm-secao">
            <h3 style={{ marginBottom: '0.5rem' }}>Movimentação por conta / fundo</h3>
            <div className="df-tabela-wrap">
              <table className="df-tabela">
                <thead>
                  <tr>
                    <th>Conta</th>
                    <th className="df-num">Entradas</th>
                    <th className="df-num">Saídas</th>
                    <th className="df-num">Líquido</th>
                    <th className="df-num">Saldo atual</th>
                  </tr>
                </thead>
                <tbody>
                  {r.porConta.map((c) => (
                    <tr key={c.contaId}>
                      <td>
                        {c.nome}
                        {c.ehContaOperacional && <span className="muted"> · operacional</span>}
                      </td>
                      <td className="df-num">{formatMoney(c.entradas)}</td>
                      <td className="df-num">{formatMoney(c.saidas)}</td>
                      <td className={`df-num ${c.liquido < 0 ? 'df-neg' : ''}`}>
                        {formatMoney(c.liquido)}
                      </td>
                      <td className="df-num">{formatMoney(c.saldoAtual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              O saldo é o da data em que o relatório foi gerado; o sistema não guarda saldo
              histórico por mês.
            </p>
          </div>

          <div className="card rm-secao">
            <h3 style={{ marginBottom: '0.5rem' }}>Despesas por categoria</h3>
            <div className="df-tabela-wrap">
              <table className="df-tabela">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th className="df-num">Mês</th>
                    <th className="df-num">Mês anterior</th>
                    <th className="df-num">Variação</th>
                    <th>Classificação</th>
                  </tr>
                </thead>
                <tbody>
                  {r.despesasPorCategoria.map((c) => (
                    <tr key={c.categoria}>
                      <td>{c.categoria}</td>
                      <td className="df-num">{formatMoney(c.totalMes)}</td>
                      <td className="df-num">{formatMoney(c.totalMesAnterior)}</td>
                      <td className="df-num">
                        {formatVariacao(c.variacao)}
                        <div className="muted" style={{ fontSize: '0.75rem' }}>
                          {formatPct(c.variacaoPercentual)}
                        </div>
                      </td>
                      <td>{CLASSIFICACAO_DESPESA_LABEL[c.classificacao]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Ponto para conferência: variação de pelo menos {(r.limiarVariacao * 100).toFixed(0)}% e{' '}
              {formatMoney(r.valorMinimoVariacao)} contra o mês anterior.
            </p>
          </div>

          <div className="card rm-secao">
            <h3 style={{ marginBottom: '0.5rem' }}>Maiores despesas</h3>
            <ol style={{ paddingLeft: '1.25rem' }}>
              {r.despesas.slice(0, 5).map((d) => (
                <li key={d.lancamentoId}>
                  {d.descricao} — <strong>{formatMoney(d.valor)}</strong>{' '}
                  <span className="muted">({d.categoria})</span>
                </li>
              ))}
              {r.despesas.length === 0 && <span className="muted">Nenhuma saída no mês.</span>}
            </ol>
          </div>

          <div className="card rm-secao">
            <h3 style={{ marginBottom: '0.5rem' }}>Despesas do mês</h3>
            <div className="df-filtros no-print">
              <label>
                Classificação
                <select value={classif} onChange={(e) => setParam('classificacao', e.target.value)}>
                  <option value="">Todas</option>
                  {(Object.keys(CLASSIFICACAO_DESPESA_LABEL) as ClassificacaoDespesa[]).map((k) => (
                    <option key={k} value={k}>
                      {CLASSIFICACAO_DESPESA_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fundo responsável
                <select value={fundo} onChange={(e) => setParam('fundo', e.target.value)}>
                  <option value="">Todos</option>
                  <option value="__sem__">Sem fundo definido</option>
                  {r.porConta.map((c) => (
                    <option key={c.contaId} value={c.contaId}>
                      {c.nome}
                    </option>
                  ))}
                </select>
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
            </div>
            {despesas.length === 0 ? (
              <p className="muted">Nenhuma despesa encontrada.</p>
            ) : (
              <div className="df-tabela-wrap">
                <table className="df-tabela">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Fundo responsável</th>
                      <th>Classificação</th>
                      <th className="df-num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {despesas.map((d) => (
                      <tr key={d.lancamentoId}>
                        <td>{formatData(d.data)}</td>
                        <td>
                          {d.descricao}
                          <div className="muted" style={{ fontSize: '0.75rem' }}>
                            {d.contaNome}
                          </div>
                        </td>
                        <td>{d.categoria}</td>
                        <td>{d.fundoResponsavelNome ?? '—'}</td>
                        <td>
                          {CLASSIFICACAO_DESPESA_LABEL[d.classificacao]}
                          {d.conciliacaoDispensada && <span className="muted"> · dispensada</span>}
                        </td>
                        <td className="df-num">{formatMoney(d.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card rm-secao">
            <h3 style={{ marginBottom: '0.5rem' }}>Transferências executadas no mês</h3>
            {r.transferenciasExecutadas.length === 0 ? (
              <p className="muted">Nenhuma transferência executada.</p>
            ) : (
              <div className="df-tabela-wrap">
                <table className="df-tabela">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição / motivo</th>
                      <th>Origem → Destino</th>
                      <th className="df-num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.transferenciasExecutadas.map((t) => (
                      <tr key={t.id}>
                        <td>{formatData(t.dataExecucao)}</td>
                        <td>
                          {t.descricao ? `${t.descricao} · ` : ''}
                          {MOTIVO_TRANSFERENCIA_LABEL[t.motivo]}
                        </td>
                        <td>
                          {t.contaOrigemNome} → {t.contaDestinoNome}
                        </td>
                        <td className="df-num">{formatMoney(t.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
