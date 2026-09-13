import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Condominio } from '@/types/condominio'

interface CondominioStore {
  condominios: Condominio[]
  condominioAtivoId: string | null
  setCondominios: (lista: Condominio[]) => void
  setCondominioAtivo: (id: string | null) => void
  condominioAtivo: () => Condominio | null
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
        // lista de condomínios vem da API; não persistimos para evitar stale
      }),
    },
  ),
)
