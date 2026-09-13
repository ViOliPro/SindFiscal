import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthState, Usuario, Permissao, Modulo, NivelPermissao } from '@/types/auth'

interface AuthStore extends AuthState {
  setAuth: (token: string, usuario: Usuario, permissoes: Permissao[]) => void
  logout: () => void
  hasPermissao: (condominioId: string, modulo: Modulo, nivel?: NivelPermissao) => boolean
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
        // Síndico tem acesso pleno (RF03 / módulo 11)
        if (usuario.papel === 'sindico') return true
        // Conselheiro fiscal: somente leitura em módulos permitidos
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
