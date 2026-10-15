import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { atualizarModeloAcesso, criarModeloAcesso } from '@/services/api'
import { ApiError } from '@/lib/api'
import type { ModeloAcesso, NivelPermissao } from '@/types'
import {
  MODULOS_ACESSO,
  NIVEL_LABEL,
  definirNivel,
  linhaDoModelo,
  niveisPermitidos,
  type LinhaAcesso,
} from '@/lib/acessos'
import { MODULOS_LABEL } from '@/types'

interface Props {
  /** null = novo modelo */
  modelo: ModeloAcesso | null
  onConcluir: () => void
}

/** Cria/edita um modelo: nome + nível de cada módulo (em branco = sem acesso). */
export function ModeloEditor({ modelo, onConcluir }: Props) {
  const qc = useQueryClient()
  const [nome, setNome] = useState(modelo?.nome ?? '')
  const [descricao, setDescricao] = useState(modelo?.descricao ?? '')
  const [linha, setLinha] = useState<LinhaAcesso>(modelo ? linhaDoModelo(modelo) : {})

  const salvar = useMutation({
    mutationFn: () => {
      const dados = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        itens: Object.entries(linha).map(([modulo, nivel]) => ({ modulo, nivel })),
      }
      return modelo
        ? atualizarModeloAcesso(modelo.id, dados)
        : criarModeloAcesso(dados)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['modelos-acesso'] })
      toast.success(modelo ? 'Modelo atualizado.' : 'Modelo criado.')
      onConcluir()
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError ? err.message || 'Falha ao salvar.' : 'Falha ao salvar.',
      ),
  })

  const podeSalvar = nome.trim().length >= 2 && Object.keys(linha).length > 0

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <strong>{modelo ? `Editar modelo "${modelo.nome}"` : 'Novo modelo de acesso'}</strong>

      <div
        style={{
          display: 'grid',
          gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        <div className="form-field">
          <label>Nome</label>
          <input
            value={nome}
            maxLength={60}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Operacional"
          />
        </div>
        <div className="form-field">
          <label>Descrição (opcional)</label>
          <input
            value={descricao}
            maxLength={200}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Para que serve este modelo"
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: '0.5rem 1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}
      >
        {MODULOS_ACESSO.map((m) => (
          <label
            key={m}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.9rem',
            }}
          >
            <span>{MODULOS_LABEL[m] ?? m}</span>
            <select
              className="select-condominio"
              style={{ minWidth: 120 }}
              value={linha[m] ?? ''}
              onChange={(e) =>
                setLinha((l) =>
                  definirNivel(l, m, (e.target.value || null) as NivelPermissao | null),
                )
              }
            >
              <option value="">Sem acesso</option>
              {niveisPermitidos(m, false).map((n) => (
                <option key={n} value={n}>
                  {NIVEL_LABEL[n]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <p className="muted" style={{ fontSize: '0.8rem' }}>
        Alterar um modelo não muda acessos já concedidos — ele só serve de molde na hora de
        aplicar.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!podeSalvar || salvar.isPending}
          onClick={() => salvar.mutate()}
        >
          {salvar.isPending ? 'Salvando…' : 'Salvar modelo'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onConcluir}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
