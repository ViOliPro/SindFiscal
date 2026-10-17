import { useState } from "react"
import { useCondominioStore } from "@/stores/condominioStore"

/** Stub temporário após commit PLACEHOLDER. Aplicar patch sindfiscal-decisoes-align-2026-10-16.zip */
export function CompromissosPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  return (
    <div>
      <header className="page-header">
        <h1>Decisões e Compromissos</h1>
        <p>
          Aplique o patch <code>sindfiscal-decisoes-align-2026-10-16.zip</code> em{" "}
          <code>src/pages/CompromissosPage.tsx</code> (aba Decisões alinhada com selects).
        </p>
      </header>
      {!condominioId && <p className="muted">Selecione um condomínio no topo.</p>}
    </div>
  )
}
