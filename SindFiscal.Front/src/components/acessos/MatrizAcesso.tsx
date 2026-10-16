import type { CondominioResumo, ModeloAcesso, NivelPermissao } from '@/types'
import {
  MODULOS_ACESSO,
  MODULOS_CURTO,
  detectarPerfil,
  linhaDoModelo,
  proximoNivel,
  type LinhaAcesso,
  type MapaAcesso,
} from '@/lib/acessos'
import { CelulaAcesso } from './CelulaAcesso'

interface Props {
  condominios: CondominioResumo[]
  original: MapaAcesso
  rascunho: MapaAcesso
  modelos: ModeloAcesso[]
  somenteVisualizar: boolean
  onAlterarCelula: (
    condominioId: string,
    modulo: string,
    nivel: NivelPermissao | null,
  ) => void
  onSubstituirLinha: (condominioId: string, linha: LinhaAcesso) => void
}

/** Matriz condomínios (linhas) × módulos (colunas) de um colaborador. */
export function MatrizAcesso({
  condominios,
  original,
  rascunho,
  modelos,
  somenteVisualizar,
  onAlterarCelula,
  onSubstituirLinha,
}: Props) {
  function acaoDaLinha(condominioId: string, valor: string) {
    if (valor === 'limpar') return onSubstituirLinha(condominioId, {})
    if (valor.startsWith('modelo:')) {
      const m = modelos.find((x) => x.id === valor.slice(7))
      if (m) onSubstituirLinha(condominioId, linhaDoModelo(m))
      return
    }
    if (valor.startsWith('copiar:')) {
      const origem = rascunho[valor.slice(7)] ?? {}
      onSubstituirLinha(condominioId, { ...origem })
    }
  }

  return (
    <div className="acessos-tabela-wrap">
      <table className="acessos-tabela">
        <thead>
          <tr>
            <th>Condomínio</th>
            {MODULOS_ACESSO.map((m) => (
              <th key={m} title={m}>
                {MODULOS_CURTO[m]}
              </th>
            ))}
            <th>Atalhos</th>
          </tr>
        </thead>
        <tbody>
          {condominios.map((c) => {
            const linha = rascunho[c.id] ?? {}
            const linhaSalva = original[c.id] ?? {}
            const perfil = detectarPerfil(linha, modelos)
            const comAcesso = condominios.filter(
              (o) => o.id !== c.id && Object.keys(rascunho[o.id] ?? {}).length > 0,
            )
            return (
              <tr key={c.id}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span>{c.nome}</span>
                    <span className="acesso-perfil" data-tipo={perfil.tipo}>
                      {perfil.tipo === 'sem_acesso' && 'Sem acesso'}
                      {perfil.tipo === 'modelo' && perfil.nome}
                      {perfil.tipo === 'personalizado' &&
                        `Personalizado (${perfil.modulos})`}
                    </span>
                  </div>
                </td>
                {MODULOS_ACESSO.map((m) => (
                  <td key={m}>
                    <CelulaAcesso
                      nivel={linha[m]}
                      alterada={linha[m] !== linhaSalva[m]}
                      descricao={`${MODULOS_CURTO[m]} em ${c.nome}`}
                      onClick={() =>
                        onAlterarCelula(
                          c.id,
                          m,
                          proximoNivel(m, linha[m], somenteVisualizar),
                        )
                      }
                    />
                  </td>
                ))}
                <td>
                  <select
                    className="select-condominio"
                    style={{ minWidth: 130 }}
                    value=""
                    onChange={(e) => acaoDaLinha(c.id, e.target.value)}
                    aria-label={`Atalhos para ${c.nome}`}
                  >
                    <option value="">Atalhos…</option>
                    {modelos.length > 0 && (
                      <optgroup label="Aplicar modelo">
                        {modelos.map((m) => (
                          <option key={m.id} value={`modelo:${m.id}`}>
                            {m.nome}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {comAcesso.length > 0 && (
                      <optgroup label="Copiar de">
                        {comAcesso.map((o) => (
                          <option key={o.id} value={`copiar:${o.id}`}>
                            {o.nome}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="limpar">Remover todo o acesso</option>
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
