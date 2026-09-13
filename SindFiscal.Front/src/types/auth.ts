export type NivelPermissao = 'visualizar' | 'editar'

export type Modulo =
  | 'contas_lancamentos'
  | 'necessidades_cotacoes_fornecedores'
  | 'decisoes_compromissos'
  | 'pagamentos_fila'
  | 'transferencias_acerto'
  | 'simulacao_caixa'
  | 'dashboard_relatorios'
  | 'documentos'
  | 'reservas'
  | 'auditoria'
  | 'condominios_usuarios_integracoes'

export interface Usuario {
  id: string
  nome: string
  email: string
  papel: 'sindico' | 'colaborador' | 'conselheiro_fiscal'
}

export interface Permissao {
  condominioId: string
  modulo: Modulo
  nivel: NivelPermissao
}

export interface AuthState {
  token: string | null
  usuario: Usuario | null
  permissoes: Permissao[]
}
