import { apiFetch } from '@/lib/api'
import type {
  Condominio,
  ContaBancaria,
  FinalidadeConta,
  Lancamento,
  LoginResponse,
  NivelPermissao,
  Permissao,
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
