import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NivelPermissao, PapelUsuario } from '@/types'

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

export interface Usuario {
  id: string
  nome: string
  email: string
  papel: PapelUsuario
}

export interface PermissaoLocal {
  condominioId: string
  modulo: Modulo | string
  nivel: NivelPermissao
}

interface AuthStore {
  token: string | null
  usuario: Usuario | null
  permissoes: PermissaoLocal[]
  setAuth: (token: string, usuario: Usuario, permissoes: PermissaoLocal[]) => void
  logout: () => void
  hasPermissao: (
    condominioId: string,
    modulo: Modulo | string,
    nivel?: NivelPermissao,
  ) => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      usuario: null,
      permissoes: [],

      setAuth: (token, usuario, permissoes) =>
        set({ token, usuario, permissoes }),

      logout: () => set({ token: null, usuario: null, permissoes: [] }),

      hasPermissao: (condominioId, modulo, nivel = 'visualizar') => {
        const { usuario, permissoes } = get()
        if (!usuario) return false
        if (usuario.papel === 'sindico') return true
        if (usuario.papel === 'conselheiro_fiscal') {
          return nivel === 'visualizar'
        }
        const p = permissoes.find(
          (x) => x.condominioId === condominioId && x.modulo === modulo,
        )
        if (!p) return false
        if (nivel === 'visualizar') return true
        return p.nivel === 'editar'
      },
    }),
    {
      name: 'sindfiscal-auth',
      partialize: (s) => ({
        token: s.token,
        usuario: s.usuario,
        permissoes: s.permissoes,
      }),
    },
  ),
)
