import { apiFetch } from '@/lib/api'
import type {
  Condominio,
  CompromissoFinanceiro,
  CompromissoFinanceiroDetalhe,
  ContaBancaria,
  Decisao,
  FinalidadeConta,
  Lancamento,
  LoginResponse,
  NivelPermissao,
  Permissao,
  ResultadoDecisao,
  StatusCompromisso,
  TipoLancamento,
  TipoRegraAporte,
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
