import { apiFetch } from '@/lib/api'
import type {
  Condominio,
  CompromissoFinanceiro,
  CompromissoFinanceiroDetalhe,
  ContaBancaria,
  Cotacao,
  ComparativoCotacoes,
  Decisao,
  Documento,
  EntidadeDocumento,
  FinalidadeConta,
  Fornecedor,
  Lancamento,
  LoginResponse,
  Necessidade,
  NivelPermissao,
  AreaDeAcerto,
  Pagamento,
  Permissao,
  Prioridade,
  RegistroAuditoria,
  Reserva,
  ResultadoDecisao,
  SituacaoNecessidade,
  StatusCompromisso,
  TipoLancamento,
  TipoPagamento,
  TipoRegraAporte,
  Transferencia,
  Usuario,
} from '@/types'

export function login(email: string, senha: string) {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  })
}

export function bootstrap(nome: string, email: string, senha: string) {
  return apiFetch<LoginResponse>('/auth/bootstrap', {
    method: 'POST',
    body: JSON.stringify({ nome, email, senha }),
  })
}

export function me() {
  return apiFetch<Usuario>('/auth/me')
}

export function listarCondominios() {
  return apiFetch<Condominio[]>('/condominios')
}

export function criarCondominio(nome: string) {
  return apiFetch<Condominio>('/condominios', {
    method: 'POST',
    body: JSON.stringify({ nome }),
  })
}

export function listarUsuarios() {
  return apiFetch<Usuario[]>('/usuarios')
}

export function criarColaborador(nome: string, email: string, senhaProvisoria: string) {
  return apiFetch<Usuario>('/usuarios/colaboradores', {
    method: 'POST',
    body: JSON.stringify({ nome, email, senhaProvisoria }),
  })
}

export function listarPermissoes(condominioId: string) {
  return apiFetch<Permissao[]>(`/condominios/${condominioId}/permissoes`)
}

export function concederPermissao(
  condominioId: string,
  usuarioId: string,
  modulo: string,
  nivel: NivelPermissao,
) {
  return apiFetch<Permissao>(`/condominios/${condominioId}/permissoes`, {
    method: 'POST',
    body: JSON.stringify({ usuarioId, modulo, nivel }),
  })
}

export function listarContas(condominioId: string) {
  return apiFetch<ContaBancaria[]>(`/condominios/${condominioId}/contas`)
}

export function criarConta(
  condominioId: string,
  data: {
    nome: string
    finalidade: FinalidadeConta
    ehContaOperacional: boolean
    regraAporteTipo?: TipoRegraAporte | null
    regraAporteValor?: number | null
    tetoMaximo?: number | null
  },
) {
  return apiFetch<ContaBancaria>(`/condominios/${condominioId}/contas`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function listarLancamentos(
  condominioId: string,
  params?: { contaBancariaId?: string; de?: string; ate?: string },
) {
  const q = new URLSearchParams()
  if (params?.contaBancariaId) q.set('contaBancariaId', params.contaBancariaId)
  if (params?.de) q.set('de', params.de)
  if (params?.ate) q.set('ate', params.ate)
  const qs = q.toString()
  return apiFetch<Lancamento[]>(
    `/condominios/${condominioId}/lancamentos${qs ? `?${qs}` : ''}`,
  )
}

export function registrarLancamento(
  condominioId: string,
  data: {
    contaBancariaId: string
    data: string
    tipo: TipoLancamento
    valor: number
    descricao?: string
  },
) {
  return apiFetch<Lancamento>(`/condominios/${condominioId}/lancamentos`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function estornarLancamento(
  condominioId: string,
  lancamentoId: string,
  motivo: string,
) {
  return apiFetch<Lancamento>(
    `/condominios/${condominioId}/lancamentos/${lancamentoId}/estornar`,
    { method: 'POST', body: JSON.stringify({ motivo }) },
  )
}

// ---------------------------------------------------------------- Decisões (RF09, Mód. 3)

export function listarDecisoes(condominioId: string, necessidadeId: string) {
  return apiFetch<Decisao[]>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}/decisoes`,
  )
}

export function registrarDecisao(
  condominioId: string,
  necessidadeId: string,
  data: {
    cotacaoEscolhidaId?: string | null
    resultado: ResultadoDecisao
    justificativa?: string
    referenciaRespaldo?: string
    data: string
  },
) {
  return apiFetch<Decisao>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}/decisoes`,
    { method: 'POST', body: JSON.stringify(data) },
  )
}

// ---------------------------------------------------------------- Compromissos (RF10/RF12/RF13, Mód. 3)

export function listarCompromissos(condominioId: string, status?: StatusCompromisso) {
  const qs = status ? `?status=${status}` : ''
  return apiFetch<CompromissoFinanceiro[]>(
    `/condominios/${condominioId}/compromissos${qs}`,
  )
}

export function obterCompromisso(condominioId: string, compromissoId: string) {
  return apiFetch<CompromissoFinanceiroDetalhe>(
    `/condominios/${condominioId}/compromissos/${compromissoId}`,
  )
}

export function criarCompromissoAvulso(
  condominioId: string,
  data: { categoria: string; valorAprovado: number },
) {
  return apiFetch<CompromissoFinanceiro>(
    `/condominios/${condominioId}/compromissos/avulsos`,
    { method: 'POST', body: JSON.stringify(data) },
  )
}

export function vincularGasto(
  condominioId: string,
  compromissoPaiId: string,
  data: { categoria: string; valor: number },
) {
  return apiFetch<CompromissoFinanceiro>(
    `/condominios/${condominioId}/compromissos/${compromissoPaiId}/gastos-vinculados`,
    { method: 'POST', body: JSON.stringify(data) },
  )
}

export function ajustarValorCompromisso(
  condominioId: string,
  compromissoId: string,
  novoValor: number,
  motivo: string,
) {
  return apiFetch<CompromissoFinanceiro>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/ajustar-valor`,
    { method: 'PUT', body: JSON.stringify({ novoValor, motivo }) },
  )
}

export function cancelarCompromisso(
  condominioId: string,
  compromissoId: string,
  motivo?: string,
) {
  return apiFetch<CompromissoFinanceiro>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/cancelar`,
    { method: 'POST', body: JSON.stringify({ motivo }) },
  )
}

export function entrarNaFila(condominioId: string, compromissoId: string) {
  return apiFetch<void>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/entrar-na-fila`,
    { method: 'POST' },
  )
}

export function adiarCompromisso(condominioId: string, compromissoId: string) {
  return apiFetch<void>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/adiar`,
    { method: 'POST' },
  )
}

export function reordenarFila(condominioId: string, compromissoIdsEmOrdem: string[]) {
  return apiFetch<void>(
    `/condominios/${condominioId}/compromissos/fila-execucao/reordenar`,
    { method: 'PUT', body: JSON.stringify({ compromissoIdsEmOrdem }) },
  )
}

// ---------------------------------------------------------------- Necessidades (RF06, Mód. 2)

export function listarNecessidades(condominioId: string, situacao?: SituacaoNecessidade) {
  const qs = situacao ? `?situacao=${situacao}` : ''
  return apiFetch<Necessidade[]>(`/condominios/${condominioId}/necessidades${qs}`)
}

export function criarNecessidade(
  condominioId: string,
  data: {
    descricao: string
    categoria: string
    prioridade?: Prioridade | null
    escopoTexto?: string | null
    responsavelId?: string | null
  },
) {
  return apiFetch<Necessidade>(`/condominios/${condominioId}/necessidades`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function atualizarNecessidade(
  condominioId: string,
  necessidadeId: string,
  data: {
    descricao: string
    categoria: string
    prioridade?: Prioridade | null
    escopoTexto?: string | null
    responsavelId?: string | null
  },
) {
  return apiFetch<Necessidade>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}`,
    { method: 'PUT', body: JSON.stringify(data) },
  )
}

export function atualizarSituacaoNecessidade(
  condominioId: string,
  necessidadeId: string,
  situacao: SituacaoNecessidade,
) {
  return apiFetch<Necessidade>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}/situacao`,
    { method: 'PATCH', body: JSON.stringify({ situacao }) },
  )
}

// ---------------------------------------------------------------- Cotações (RF07, Mód. 2)

export function listarCotacoes(condominioId: string, necessidadeId: string) {
  return apiFetch<Cotacao[]>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}/cotacoes`,
  )
}

export function comparativoCotacoes(condominioId: string, necessidadeId: string) {
  return apiFetch<ComparativoCotacoes>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}/cotacoes/comparativo`,
  )
}

export function registrarCotacao(
  condominioId: string,
  necessidadeId: string,
  data: {
    fornecedorId: string
    valor: number
    prazoExecucaoDias?: number | null
    garantiaDescricao?: string | null
    condicoesPagamento?: string | null
    validade?: string | null
  },
) {
  return apiFetch<Cotacao>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}/cotacoes`,
    { method: 'POST', body: JSON.stringify(data) },
  )
}

// ---------------------------------------------------------------- Fornecedores (RF08, Mód. 2)
// Rota não aninhada em /condominios/{id} — fornecedor é do síndico, não do
// condomínio (RN04); o backend resolve o síndico pelo usuário autenticado.

export function listarFornecedores(categoria?: string) {
  const qs = categoria ? `?categoria=${encodeURIComponent(categoria)}` : ''
  return apiFetch<Fornecedor[]>(`/fornecedores${qs}`)
}

export function criarFornecedor(data: { nome: string; categoria: string }) {
  return apiFetch<Fornecedor>('/fornecedores', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function atualizarFornecedor(
  fornecedorId: string,
  data: { nome: string; categoria: string },
) {
  return apiFetch<Fornecedor>(`/fornecedores/${fornecedorId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function avaliarFornecedor(
  fornecedorId: string,
  data: { nota: number; comentario?: string | null },
) {
  return apiFetch<Fornecedor>(`/fornecedores/${fornecedorId}/avaliar`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ---------------------------------------------------------------- Auditoria (RF19, Mód. 10)

export function listarAuditoria(
  condominioId: string,
  params?: { entidadeTipo?: string; entidadeId?: string; limite?: number },
) {
  const q = new URLSearchParams()
  if (params?.entidadeTipo) q.set('entidadeTipo', params.entidadeTipo)
  if (params?.entidadeId) q.set('entidadeId', params.entidadeId)
  if (params?.limite) q.set('limite', String(params.limite))
  const qs = q.toString()
  return apiFetch<RegistroAuditoria[]>(
    `/condominios/${condominioId}/auditoria${qs ? `?${qs}` : ''}`,
  )
}

// ---------------------------------------------------------------- Pagamentos (RF11, Mód. 4)

export function listarPagamentos(condominioId: string, compromissoId: string) {
  return apiFetch<Pagamento[]>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/pagamentos`,
  )
}

export function registrarPagamento(
  condominioId: string,
  compromissoId: string,
  data: {
    fundoResponsavelId: string
    tipo: TipoPagamento
    valor: number
    data: string
    lancamentoIdParaReconciliar?: string | null
  },
) {
  return apiFetch<Pagamento>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/pagamentos`,
    { method: 'POST', body: JSON.stringify(data) },
  )
}

// ---------------------------------------------------------------- Área de Acerto (RF14, Mód. 5)

export function listarAreaDeAcerto(condominioId: string) {
  return apiFetch<AreaDeAcerto>(`/condominios/${condominioId}/area-de-acerto`)
}

export function consolidarTransferencias(condominioId: string, transferenciaIdsParaConsolidar: string[]) {
  return apiFetch<Transferencia>(`/condominios/${condominioId}/area-de-acerto/consolidar`, {
    method: 'POST',
    body: JSON.stringify({ transferenciaIdsParaConsolidar }),
  })
}

export function confirmarExecucaoTransferencia(
  condominioId: string,
  transferenciaId: string,
  dataExecucao: string,
) {
  return apiFetch<void>(
    `/condominios/${condominioId}/area-de-acerto/${transferenciaId}/confirmar-execucao`,
    { method: 'POST', body: JSON.stringify({ dataExecucao }) },
  )
}

export function acumularAporte(
  condominioId: string,
  fundoId: string,
  baseDeCalculoPercentual?: number | null,
) {
  return apiFetch<void>(
    `/condominios/${condominioId}/area-de-acerto/fundos/${fundoId}/acumular-aporte`,
    { method: 'POST', body: JSON.stringify({ baseDeCalculoPercentual: baseDeCalculoPercentual ?? null }) },
  )
}

export function compensarAporte(condominioId: string, fundoId: string, valorAExecutar: number) {
  return apiFetch<Transferencia>(
    `/condominios/${condominioId}/area-de-acerto/fundos/${fundoId}/compensar-aporte`,
    { method: 'POST', body: JSON.stringify({ valorAExecutar }) },
  )
}

// ---------------------------------------------------------------- Reservas de área comum (RF21, Mód. 9)

export function listarReservas(
  condominioId: string,
  params?: { fundoDestinoId?: string; periodoReferencia?: string },
) {
  const q = new URLSearchParams()
  if (params?.fundoDestinoId) q.set('fundoDestinoId', params.fundoDestinoId)
  if (params?.periodoReferencia) q.set('periodoReferencia', params.periodoReferencia)
  const qs = q.toString()
  return apiFetch<Reserva[]>(`/condominios/${condominioId}/reservas${qs ? `?${qs}` : ''}`)
}

export function registrarReserva(
  condominioId: string,
  data: {
    fundoDestinoId: string
    unidade: string
    moradorNome: string
    valorDestinadoAoFundo: number
    pagoComDesconto?: boolean | null
    periodoReferencia: string
  },
) {
  return apiFetch<Reserva>(`/condominios/${condominioId}/reservas`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function fecharPeriodoReservas(
  condominioId: string,
  fundoDestinoId: string,
  periodoReferencia: string,
) {
  return apiFetch<Transferencia>(`/condominios/${condominioId}/reservas/fechar-periodo`, {
    method: 'POST',
    body: JSON.stringify({ fundoDestinoId, periodoReferencia }),
  })
}

// ---------------------------------------------------------------- Documentos (RF20, Mód. 8)

export function listarDocumentos(condominioId: string, entidadeTipo: EntidadeDocumento, entidadeId: string) {
  return apiFetch<Documento[]>(
    `/condominios/${condominioId}/documentos?entidadeTipo=${entidadeTipo}&entidadeId=${entidadeId}`,
  )
}

export function registrarDocumento(
  condominioId: string,
  data: {
    entidadeTipo: EntidadeDocumento
    entidadeId: string
    tipoDocumento: string
    referenciaTexto: string
  },
) {
  return apiFetch<Documento>(`/condominios/${condominioId}/documentos`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function atualizarDocumento(
  condominioId: string,
  documentoId: string,
  data: { tipoDocumento: string; referenciaTexto: string },
) {
  return apiFetch<Documento>(`/condominios/${condominioId}/documentos/${documentoId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
