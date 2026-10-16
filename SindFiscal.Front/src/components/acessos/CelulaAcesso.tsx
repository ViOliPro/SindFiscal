import type { NivelPermissao } from '@/types'
import { NIVEL_LABEL } from '@/lib/acessos'

interface Props {
  nivel: NivelPermissao | undefined
  alterada: boolean
  /** Texto para leitores de tela, ex.: "Pagamentos em Condomínio X" */
  descricao: string
  onClick: () => void
}

/** Um clique alterna: sem acesso → Ver → Editar. Mostra contorno quando difere do salvo. */
export function CelulaAcesso({ nivel, alterada, descricao, onClick }: Props) {
  const texto = nivel ? NIVEL_LABEL[nivel] : '—'
  return (
    <button
      type="button"
      className="acesso-cell"
      data-nivel={nivel ?? 'nenhum'}
      data-alterada={alterada}
      onClick={onClick}
      aria-label={`${descricao}: ${nivel ? NIVEL_LABEL[nivel] : 'sem acesso'}`}
      title="Clique para alternar: sem acesso → Ver → Editar"
    >
      {texto}
    </button>
  )
}
