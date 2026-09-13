# SindFiscal.Front

Frontend do **SindFiscal** — gestão financeira/administrativa para síndico profissional.

## Stack (validada)

- React 19 + TypeScript + Vite
- TanStack Query + Suspense + Persistência IndexedDB (offline leve)
- Zustand (auth + condomínio ativo)
- React Hook Form + Zod
- React Router

## Desenvolvimento

```bash
cd SindFiscal.Front
npm install
npm run dev
```

App em `http://localhost:5173`.

Proxy de API: `/api` → `http://localhost:5000` (ajuste em `vite.config.ts` se necessário).

Variável opcional: `VITE_API_URL` (padrão `/api`).

## Estrutura

```
src/
  components/layout/   # AppShell, ProtectedRoute
  pages/               # Login, Dashboard, …
  stores/              # authStore, condominioStore
  lib/                 # queryClient, api
  types/               # contratos TS
```

## Fase atual

**Fase 0 — Setup** concluída.

Próximo: **Fase 1 — Fundação** (Auth real + Módulo 11 + Contas/Lançamentos).

Login em modo dev: qualquer e-mail/senha entra como síndico.
