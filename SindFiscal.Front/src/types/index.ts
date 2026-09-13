export type PapelUsuario = 'sindico' | 'colaborador' | 'conselheiro_fiscal'
export type NivelPermissao = 'visualizar' | 'editar'

export type Modulo =
  | 'contas_lancamentos'
  | 'necessidades_cotacoes_fornecedores'
  | 'decisoes_compromissos'
  | 'pagamentos_fila_execucao'
  | 'transferencias_area_acerto'
  | 'simulacao_caixa_futuro'
  | 'dashboard_relatorios'
  | 'documentos'
  | 'reservas_area_comum'
  | 'auditoria'
  | 'condominios_usuarios_integracoes'

export type FinalidadeConta =
  | 'ordinario'
  | 'extraordinario'
  | 'fundo_reserva'
  | 'fundo_trabalho'
  | 'fundo_area_especifica'

export type TipoRegraAporte = 'valor_fixo' | 'percentual'
export type TipoLancamento = 'entrada' | 'saida'
export type OrigemLancamento = 'real' | 'simulado'
export type FonteLancamento = 'manual' | 'integracao'

export interface Usuario {
  id: string
  nome: string
  email: string
  papel: PapelUsuario
  ativo: boolean
}

export interface Condominio {
  id: string
  nome: string
  possuiIntegracaoApi: boolean
}

export interface Permissao {
  id: string
  usuarioId: string
  usuarioNome: string
  condominioId: string
  modulo: string
  nivel: NivelPermissao
}

export interface ContaBancaria {
  id: string
  nome: string
  finalidade: FinalidadeConta
  ehContaOperacional: boolean
  regraAporteTipo: TipoRegraAporte | null
  regraAporteValor: number | null
  tetoMaximo: number | null
  saldoAtual: number
  aportePendenteAcumulado: number
}

export interface Lancamento {
  id: string
  contaBancariaId: string
  data: string
  tipo: TipoLancamento
  valor: number
  origem: OrigemLancamento
  fonte: FonteLancamento
  descricao: string | null
  estornoDeId: string | null
}

export interface LoginResponse {
  token: string
  usuario: Usuario
}

export const MODULOS_LABEL: Record<string, string> = {
  contas_lancamentos: 'Contas e Lançamentos',
  necessidades_cotacoes_fornecedores: 'Necessidades / Cotações / Fornecedores',
  decisoes_compromissos: 'Decisões e Compromissos',
  pagamentos_fila_execucao: 'Pagamentos e Fila',
  transferencias_area_acerto: 'Área de Acerto',
  simulacao_caixa_futuro: 'Simulação de Caixa',
  dashboard_relatorios: 'Dashboard e Relatórios',
  documentos: 'Documentos',
  reservas_area_comum: 'Reservas',
  auditoria: 'Auditoria',
}

export const FINALIDADE_LABEL: Record<FinalidadeConta, string> = {
  ordinario: 'Ordinário',
  extraordinario: 'Extraordinário',
  fundo_reserva: 'Fundo de Reserva',
  fundo_trabalho: 'Fundo de Trabalho',
  fundo_area_especifica: 'Fundo de Área Específica',
}
