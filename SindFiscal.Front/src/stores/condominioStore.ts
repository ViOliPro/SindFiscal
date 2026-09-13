import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CondominioLocal {
  id: string
  nome: string
  ativo: boolean
}

interface CondominioStore {
  condominios: CondominioLocal[]
  condominioAtivoId: string | null
  setCondominios: (lista: CondominioLocal[]) => void
  setCondominioAtivo: (id: string | null) => void
  condominioAtivo: () => CondominioLocal | null
}

export const useCondominioStore = create<CondominioStore>()(
  persist(
    (set, get) => ({
      condominios: [],
      condominioAtivoId: null,

      setCondominios: (lista) => set({ condominios: lista }),

      setCondominioAtivo: (id) => set({ condominioAtivoId: id }),

      condominioAtivo: () => {
        const { condominios, condominioAtivoId } = get()
        return condominios.find((c) => c.id === condominioAtivoId) ?? null
      },
    }),
    {
      name: 'sindfiscal-condominio',
      partialize: (s) => ({
        condominioAtivoId: s.condominioAtivoId,
      }),
    },
  ),
)
