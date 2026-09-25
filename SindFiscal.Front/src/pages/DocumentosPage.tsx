import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import {
  atualizarDocumento,
  listarCompromissos,
  listarDocumentos,
  listarFornecedores,
  listarNecessidades,
  registrarDocumento,
} from '@/services/api'
import { ENTIDADE_DOCUMENTO_LABEL, type EntidadeDocumento } from '@/types'
import { useCondominioStore } from '@/stores/condominioStore'
import { ApiError } from '@/lib/api'

function ErroApi({ error }: { error: unknown }) {
  if (!error) return null
  const msg =
    typeof error === 'string'
      ? error
      : error instanceof ApiError
        ? error.message
        : 'Erro inesperado.'
  return (
    <p className="muted" style={{ color: 'var(--color-danger, #c0392b)', fontSize: '0.85rem' }}>
      {msg}
    </p>
  )
}

// Tipos de entidade com um endpoint de listagem já disponível no front para
// montar um seletor amigável; Decisão e Pagamento ainda exigem colar o UUID
// manualmente (não há endpoint "listar todas as decisões/pagamentos do
// condomínio" hoje — só nested por necessidade/compromisso).
const ENTIDADES_COM_SELETOR: EntidadeDocumento[] = ['necessidade', 'compromisso_financeiro', 'fornecedor']

const documentoSchema = z.object({
  entidadeTipo: z.enum([
    'necessidade',
    'compromisso_financeiro',
    'pagamento',
    'decisao',
    'fornecedor',
  ]),
  entidadeId: z.string().min(1, 'Selecione ou informe a entidade'),
  tipoDocumento: z.string().min(2, 'Informe o tipo do documento'),
  referenciaTexto: z.string().min(1, 'Informe a referência'),
})
type DocumentoForm = z.infer<typeof documentoSchema>

export function DocumentosPage() {
  const condominioId = useCondominioStore((s) => s.condominioAtivoId)
  const qc = useQueryClient()

  const form = useForm<DocumentoForm>({
    resolver: zodResolver(documentoSchema),
    defaultValues: { entidadeTipo: 'necessidade' },
  })
  const entidadeTipoEscolhida = form.watch('entidadeTipo')
  const entidadeIdEscolhida = form.watch('entidadeId')

  const necessidadesQ = useQuery({
    queryKey: ['necessidades', condominioId, ''],
    queryFn: () => listarNecessidades(condominioId!),
    enabled: !!condominioId && entidadeTipoEscolhida === 'necessidade',
  })
  const compromissosQ = useQuery({
    queryKey: ['compromissos', condominioId],
    queryFn: () => listarCompromissos(condominioId!),
    enabled: !!condominioId && entidadeTipoEscolhida === 'compromisso_financeiro',
  })
  const fornecedoresQ = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => listarFornecedores(),
    enabled: entidadeTipoEscolhida === 'fornecedor',
  })

  const documentosQ = useQuery({
    queryKey: ['documentos', condominioId, entidadeTipoEscolhida, entidadeIdEscolhida],
    queryFn: () => listarDocumentos(condominioId!, entidadeTipoEscolhida, entidadeIdEscolhida),
    enabled: !!condominioId && !!entidadeIdEscolhida,
  })

  const registrarM = useMutation({
    mutationFn: (d: DocumentoForm) =>
      registrarDocumento(condominioId!, {
        entidadeTipo: d.entidadeTipo,
        entidadeId: d.entidadeId,
        tipoDocumento: d.tipoDocumento,
        referenciaTexto: d.referenciaTexto,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documentos', condominioId, entidadeTipoEscolhida, entidadeIdEscolhida] })
      form.setValue('tipoDocumento', '')
      form.setValue('referenciaTexto', '')
    },
  })

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEdicao, setTextoEdicao] = useState({ tipoDocumento: '', referenciaTexto: '' })
  const atualizarM = useMutation({
    mutationFn: (documentoId: string) =>
      atualizarDocumento(condominioId!, documentoId, textoEdicao),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documentos', condominioId, entidadeTipoEscolhida, entidadeIdEscolhida] })
      setEditandoId(null)
    },
  })

  if (!condominioId) {
    return (
      <div>
        <header className="page-header">
          <h1>Documentos</h1>
          <p>Selecione um condomínio no topo.</p>
        </header>
      </div>
    )
  }

  return (
    <div>
      <header className="page-header">
        <h1>Documentos</h1>
        <p>RF20 — referência textual (nº da NF, descrição do comprovante, nº da ata…), sem upload de arquivo nesta versão</p>
      </header>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <form
          onSubmit={form.handleSubmit((d) => registrarM.mutate(d))}
          style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'end' }}
        >
          <div className="form-field">
            <label>Tipo de entidade</label>
            <select
              className="select-condominio"
              style={{ width: '100%' }}
              {...form.register('entidadeTipo')}
              onChange={(e) => {
                form.setValue('entidadeTipo', e.target.value as EntidadeDocumento)
                form.setValue('entidadeId', '')
              }}
            >
              {(Object.keys(ENTIDADE_DOCUMENTO_LABEL) as EntidadeDocumento[]).map((t) => (
                <option key={t} value={t}>{ENTIDADE_DOCUMENTO_LABEL[t]}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Entidade</label>
            {ENTIDADES_COM_SELETOR.includes(entidadeTipoEscolhida) ? (
              <select className="select-condominio" style={{ width: '100%' }} {...form.register('entidadeId')}>
                <option value="">Selecione…</option>
                {entidadeTipoEscolhida === 'necessidade' &&
                  necessidadesQ.data?.map((n) => (
                    <option key={n.id} value={n.id}>{n.descricao}</option>
                  ))}
                {entidadeTipoEscolhida === 'compromisso_financeiro' &&
                  compromissosQ.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.categoria}</option>
                  ))}
                {entidadeTipoEscolhida === 'fornecedor' &&
                  fornecedoresQ.data?.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
              </select>
            ) : (
              <input {...form.register('entidadeId')} placeholder="Cole o UUID (decisão/pagamento)" />
            )}
          </div>

          <div className="form-field">
            <label>Tipo do documento</label>
            <input {...form.register('tipoDocumento')} placeholder="Ex.: nota_fiscal, comprovante, ata" />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label>Referência</label>
            <input {...form.register('referenciaTexto')} placeholder="Ex.: NF 1234, comprovante PIX de 12/09, ata da assembleia de 03/2026" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={registrarM.isPending}>
            Registrar documento
          </button>
        </form>
        <ErroApi
          error={
            form.formState.errors.entidadeId?.message ??
            form.formState.errors.tipoDocumento?.message ??
            form.formState.errors.referenciaTexto?.message
          }
        />
        <ErroApi error={registrarM.error} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          Documentos de {ENTIDADE_DOCUMENTO_LABEL[entidadeTipoEscolhida].toLowerCase()} selecionada
        </h3>
        {!entidadeIdEscolhida && <p className="muted">Selecione uma entidade acima para ver os documentos vinculados.</p>}
        {documentosQ.isLoading && <p className="muted">Carregando…</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {documentosQ.data?.map((doc) => (
            <div key={doc.id} style={{ padding: '0.6rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
              {editandoId === doc.id ? (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'end' }}>
                  <div className="form-field">
                    <label>Tipo</label>
                    <input
                      defaultValue={doc.tipoDocumento}
                      onChange={(e) => setTextoEdicao((s) => ({ ...s, tipoDocumento: e.target.value }))}
                    />
                  </div>
                  <div className="form-field" style={{ flex: 1 }}>
                    <label>Referência</label>
                    <input
                      defaultValue={doc.referenciaTexto}
                      onChange={(e) => setTextoEdicao((s) => ({ ...s, referenciaTexto: e.target.value }))}
                    />
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => atualizarM.mutate(doc.id)} disabled={atualizarM.isPending}>
                    Salvar
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setEditandoId(null)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem' }}>
                    <strong>{doc.tipoDocumento}</strong> — {doc.referenciaTexto}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem' }}
                    onClick={() => {
                      setTextoEdicao({ tipoDocumento: doc.tipoDocumento, referenciaTexto: doc.referenciaTexto })
                      setEditandoId(doc.id)
                    }}
                  >
                    Editar
                  </button>
                </div>
              )}
            </div>
          ))}
          {documentosQ.data?.length === 0 && <p className="muted">Nenhum documento vinculado ainda.</p>}
        </div>
        <ErroApi error={atualizarM.error} />
      </div>
    </div>
  )
}
