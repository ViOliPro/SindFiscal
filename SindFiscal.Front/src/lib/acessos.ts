import type {
  AcessoPermissaoItem,
  AlteracaoAcesso,
  ModeloAcesso,
  NivelPermissao,
} from '@/types'

/** Colunas da matriz (mesma ordem de Modulos.Delegaveis no back). */
export const MODULOS_ACESSO = [
  'contas_lancamentos',
  'necessidades_cotacoes_fornecedores',
  'decisoes_compromissos',
  'pagamentos_fila_execucao',
  'transferencias_area_acerto',
  'simulacao_caixa_futuro',
  'dashboard_relatorios',
  'documentos',
  'reservas_area_comum',
  'auditoria',
] as const

/** Rótulos curtos para o cabeçalho da matriz. */
export const MODULOS_CURTO: Record<string, string> = {
  contas_lancamentos: 'Contas',
  necessidades_cotacoes_fornecedores: 'Necessidades',
  decisoes_compromissos: 'Decisões',
  pagamentos_fila_execucao: 'Pagamentos',
  transferencias_area_acerto: 'Acerto',
  simulacao_caixa_futuro: 'Simulação',
  dashboard_relatorios: 'Dashboard',
  documentos: 'Documentos',
  reservas_area_comum: 'Reservas',
  auditoria: 'Auditoria',
}

export const NIVEL_LABEL: Record<NivelPermissao, string> = {
  visualizar: 'Ver',
  editar: 'Editar',
}

/** módulo -> nível. Módulo ausente = sem acesso. */
export type LinhaAcesso = Record<string, NivelPermissao>
/** condomínioId -> linha */
export type MapaAcesso = Record<string, LinhaAcesso>
export type ModoAplicacao = 'substituir' | 'acrescentar'

/** Auditoria é sempre somente leitura (RF19); Conselho Fiscal também (RN30). */
export function niveisPermitidos(
  modulo: string,
  somenteVisualizar: boolean,
): NivelPermissao[] {
  return modulo === 'auditoria' || somenteVisualizar
    ? ['visualizar']
    : ['visualizar', 'editar']
}

/** Clique na célula: sem acesso → Ver → Editar → sem acesso. */
export function proximoNivel(
  modulo: string,
  atual: NivelPermissao | undefined,
  somenteVisualizar: boolean,
): NivelPermissao | null {
  const ciclo: (NivelPermissao | null)[] = [
    null,
    ...niveisPermitidos(modulo, somenteVisualizar),
  ]
  const i = ciclo.indexOf(atual ?? null)
  return ciclo[(i + 1) % ciclo.length]
}

export function mapaDePermissoes(permissoes: AcessoPermissaoItem[]): MapaAcesso {
  const mapa: MapaAcesso = {}
  for (const p of permissoes) {
    ;(mapa[p.condominioId] ??= {})[p.modulo] = p.nivel
  }
  return mapa
}

export function linhaDoModelo(modelo: ModeloAcesso): LinhaAcesso {
  const linha: LinhaAcesso = {}
  for (const i of modelo.itens) linha[i.modulo] = i.nivel
  return linha
}

export function definirNivel(
  linha: LinhaAcesso,
  modulo: string,
  nivel: NivelPermissao | null,
): LinhaAcesso {
  const nova = { ...linha }
  if (nivel === null) delete nova[modulo]
  else nova[modulo] = nivel
  return nova
}

/** substituir = a linha vira exatamente a origem; acrescentar = origem sobrescreve só os módulos que ela tem. */
export function aplicarNaLinha(
  atual: LinhaAcesso,
  origem: LinhaAcesso,
  modo: ModoAplicacao,
): LinhaAcesso {
  return modo === 'substituir' ? { ...origem } : { ...atual, ...origem }
}

/** Conselho Fiscal (somente leitura): rebaixa qualquer "editar" para "visualizar". */
export function limitarLinha(
  linha: LinhaAcesso,
  somenteVisualizar: boolean,
): LinhaAcesso {
  if (!somenteVisualizar) return linha
  const nova: LinhaAcesso = {}
  for (const m of Object.keys(linha)) nova[m] = 'visualizar'
  return nova
}

export function linhasIguais(a: LinhaAcesso, b: LinhaAcesso): boolean {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((m) => a[m] === b[m])
}

/** Células que diferem entre o que está salvo e o rascunho (é o que vai no PUT). */
export function diferencas(
  original: MapaAcesso,
  rascunho: MapaAcesso,
  condominioIds: string[],
): AlteracaoAcesso[] {
  const saida: AlteracaoAcesso[] = []
  for (const condominioId of condominioIds) {
    const o = original[condominioId] ?? {}
    const d = rascunho[condominioId] ?? {}
    for (const modulo of new Set([...Object.keys(o), ...Object.keys(d)])) {
      if ((o[modulo] ?? null) !== (d[modulo] ?? null)) {
        saida.push({ condominioId, modulo, nivel: d[modulo] ?? null })
      }
    }
  }
  return saida
}

export type Perfil =
  | { tipo: 'sem_acesso' }
  | { tipo: 'modelo'; nome: string }
  | { tipo: 'personalizado'; modulos: number }

/** Descobre se a linha é igual a algum modelo (sem guardar vínculo no banco). */
export function detectarPerfil(
  linha: LinhaAcesso,
  modelos: ModeloAcesso[],
): Perfil {
  const modulos = Object.keys(linha).length
  if (modulos === 0) return { tipo: 'sem_acesso' }
  const igual = modelos.find((m) => linhasIguais(linha, linhaDoModelo(m)))
  return igual
    ? { tipo: 'modelo', nome: igual.nome }
    : { tipo: 'personalizado', modulos }
}
