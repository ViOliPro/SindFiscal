import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { CondominioResumo, ModeloAcesso } from '@/types'
import {
  linhaDoModelo,
  type LinhaAcesso,
  type MapaAcesso,
  type ModoAplicacao,
} from '@/lib/acessos'

interface Props {
  condominios: CondominioResumo[]
  modelos: ModeloAcesso[]
  /** Estado atual da matriz (rascunho), usado como origem em "copiar de". */
  rascunho: MapaAcesso
  onAplicar: (origem: LinhaAcesso, destinos: string[], modo: ModoAplicacao) => void
  onFechar: () => void
}

/**
 * Atribuição em lote: escolhe a ORIGEM (um modelo ou outro condomínio) e marca os
 * condomínios de DESTINO. Só preenche a matriz — nada é gravado até clicar em Salvar.
 */
export function AplicarEmLote({
  condominios,
  modelos,
  rascunho,
  onAplicar,
  onFechar,
}: Props) {
  const [origem, setOrigem] = useState('')
  const [destinos, setDestinos] = useState<Set<string>>(new Set())
  const [modo, setModo] = useState<ModoAplicacao>('substituir')

  const origemCondominioId = origem.startsWith('copiar:') ? origem.slice(7) : null
  const condominiosComAcesso = condominios.filter(
    (c) => Object.keys(rascunho[c.id] ?? {}).length > 0,
  )
  const destinosValidos = [...destinos].filter((id) => id !== origemCondominioId)

  function alternar(id: string) {
    setDestinos((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function aplicar() {
    let linha: LinhaAcesso = {}
    if (origem.startsWith('modelo:')) {
      const m = modelos.find((x) => x.id === origem.slice(7))
      if (!m) return
      linha = linhaDoModelo(m)
    } else if (origemCondominioId) {
      linha = rascunho[origemCondominioId] ?? {}
    } else {
      return
    }
    onAplicar(linha, destinosValidos, modo)
    toast.success(
      `Aplicado em ${destinosValidos.length} condomínio(s). Revise na tabela e clique em Salvar.`,
    )
    setDestinos(new Set())
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
        <strong>Aplicar em vários condomínios</strong>
        <button type="button" className="btn btn-ghost" onClick={onFechar}>
          Fechar
        </button>
      </div>

      <div className="form-field" style={{ maxWidth: 360 }}>
        <label>1. Copiar acessos de…</label>
        <select
          className="select-condominio"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
        >
          <option value="">Selecione…</option>
          {modelos.length > 0 && (
            <optgroup label="Modelos de acesso">
              {modelos.map((m) => (
                <option key={m.id} value={`modelo:${m.id}`}>
                  {m.nome}
                </option>
              ))}
            </optgroup>
          )}
          {condominiosComAcesso.length > 0 && (
            <optgroup label="Outro condomínio deste colaborador">
              {condominiosComAcesso.map((c) => (
                <option key={c.id} value={`copiar:${c.id}`}>
                  {c.nome}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {modelos.length === 0 && (
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            Nenhum modelo ainda — crie em{' '}
            <Link to="/acessos" style={{ textDecoration: 'underline' }}>
              Gestão de Acessos → Modelos
            </Link>
            .
          </span>
        )}
      </div>

      <div className="form-field">
        <label>2. …e aplicar nestes condomínios</label>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem' }}
            onClick={() =>
              setDestinos(
                new Set(condominios.map((c) => c.id).filter((id) => id !== origemCondominioId)),
              )
            }
          >
            Marcar todos
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setDestinos(new Set())}
          >
            Limpar seleção
          </button>
        </div>
        <div className="acessos-lista-check">
          {condominios.map((c) => (
            <label key={c.id} className="acessos-check">
              <input
                type="checkbox"
                checked={destinos.has(c.id) && c.id !== origemCondominioId}
                disabled={c.id === origemCondominioId}
                onChange={() => alternar(c.id)}
              />
              <span>{c.nome}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-field">
        <label>3. Como aplicar</label>
        <label className="acessos-check">
          <input
            type="radio"
            name="modo-aplicacao"
            checked={modo === 'substituir'}
            onChange={() => setModo('substituir')}
          />
          <span>Substituir — o condomínio fica exatamente como a origem</span>
        </label>
        <label className="acessos-check">
          <input
            type="radio"
            name="modo-aplicacao"
            checked={modo === 'acrescentar'}
            onChange={() => setModo('acrescentar')}
          />
          <span>Acrescentar — mantém o que já tem e soma/atualiza os módulos da origem</span>
        </label>
      </div>

      <div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!origem || destinosValidos.length === 0}
          onClick={aplicar}
        >
          Aplicar na tabela ({destinosValidos.length})
        </button>
      </div>
    </div>
  )
}
