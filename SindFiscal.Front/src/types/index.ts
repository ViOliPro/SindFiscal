export type PapelUsuario = "sindico" | "colaborador" | "conselheiro_fiscal";
export type NivelPermissao = "visualizar" | "editar";

export type Modulo =
  | "contas_lancamentos"
  | "necessidades_cotacoes_fornecedores"
  | "decisoes_compromissos"
  | "pagamentos_fila_execucao"
  | "transferencias_area_acerto"
  | "simulacao_caixa_futuro"
  | "dashboard_relatorios"
  | "documentos"
  | "reservas_area_comum"
  | "auditoria"
  | "condominios_usuarios_integracoes";

export type FinalidadeConta =
  | "ordinario"
  | "extraordinario"
  | "fundo_reserva"
  | "fundo_trabalho"
  | "fundo_area_especifica";

export type TipoRegraAporte = "valor_fixo" | "percentual";
export type TipoLancamento = "entrada" | "saida";
export type OrigemLancamento = "real" | "simulado";
export type FonteLancamento = "manual" | "integracao";

export type Prioridade = "alta" | "media" | "baixa";
export type SituacaoNecessidade =
  | "em_analise"
  | "em_orcamento"
  | "aprovado"
  | "reprovado"
  | "adiado"
  | "executado";

export type ResultadoDecisao = "aprovado" | "reprovado" | "adiado";
export type StatusCompromisso =
  | "aguardando_execucao"
  | "em_fila_execucao"
  | "em_execucao"
  | "concluido"
  | "cancelado";
export type TipoPagamento = "entrada" | "adiantamento" | "parcela" | "total";

export type MotivoTransferencia = "reposicao" | "aporte" | "destinacao_receita";
export type StatusTransferencia = "sem_ajuste" | "pendente" | "ajustado";
export type TipoTransferencia = "total" | "individual";
export type ModoTransferencia = "automatica" | "checklist_manual";
export type OrigemTransferencia = "manual" | "sugerida_pelo_sistema";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  ativo: boolean;
}

export interface Condominio {
  id: string;
  nome: string;
  cnpj?: string | null;
  possuiIntegracaoApi: boolean;
  valorAlcadaAprovacao?: number | null;
  ativo: boolean;
}

export interface Permissao {
  id: string;
  usuarioId: string;
  usuarioNome: string;
  condominioId: string;
  modulo: string;
  nivel: NivelPermissao;
}

export interface ContaBancaria {
  id: string;
  nome: string;
  finalidade: FinalidadeConta;
  ehContaOperacional: boolean;
  regraAporteTipo: TipoRegraAporte | null;
  regraAporteValor: number | null;
  tetoMaximo: number | null;
  saldoAtual: number;
  aportePendenteAcumulado: number;
}

export interface Lancamento {
  id: string;
  contaBancariaId: string;
  data: string;
  tipo: TipoLancamento;
  valor: number;
  origem: OrigemLancamento;
  fonte: FonteLancamento;
  descricao: string | null;
  estornoDeId: string | null;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export interface Fornecedor {
  id: string;
  nome: string;
  categoria: string;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  avaliacaoNota: number | null;
  avaliacaoComentario: string | null;
}

export interface Necessidade {
  id: string;
  descricao: string;
  categoria: string;
  prioridade: Prioridade | null;
  escopoTexto: string | null;
  situacao: SituacaoNecessidade;
  responsavelId: string | null;
}

export interface Cotacao {
  id: string;
  necessidadeId: string;
  fornecedorId: string;
  fornecedorNome: string;
  valor: number;
  prazoExecucaoDias: number | null;
  garantiaDescricao: string | null;
  condicoesPagamento: string | null;
  validade: string | null;
}

export interface ComparativoCotacoes {
  necessidadeId: string;
  cotacoes: Cotacao[];
  menorValor: number;
  maiorValor: number;
  diferenca: number;
  fornecedorMaisBaratoId: string;
}

export interface Decisao {
  id: string;
  necessidadeId: string;
  cotacaoEscolhidaId: string | null;
  responsavelId: string;
  data: string;
  resultado: ResultadoDecisao;
  justificativa: string | null;
  referenciaRespaldo: string | null;
}

export interface CompromissoFinanceiro {
  id: string;
  necessidadeId: string | null;
  compromissoPaiId: string | null;
  categoria: string;
  valorAprovado: number;
  status: StatusCompromisso;
  prioridadeFila: number | null;
  totalGastosVinculados: number;
  totalPago: number;
  saldoRemanescente: number;
  requerValidacaoConselho: boolean;
}

export interface GastoVinculadoResumo {
  id: string;
  categoria: string;
  valor: number;
  status: StatusCompromisso;
  createdAt: string;
}

export interface PagamentoResumo {
  id: string;
  tipo: TipoPagamento;
  valor: number;
  data: string;
}

export interface CompromissoFinanceiroDetalhe {
  compromisso: CompromissoFinanceiro;
  gastosVinculados: GastoVinculadoResumo[];
  pagamentos: PagamentoResumo[];
}

export interface Pagamento {
  id: string;
  compromissoId: string;
  fundoResponsavelId: string;
  lancamentoId: string | null;
  tipo: TipoPagamento;
  valor: number;
  data: string;
}

export interface Transferencia {
  id: string;
  contaOrigemId: string;
  contaOrigemNome: string;
  contaDestinoId: string;
  contaDestinoNome: string;
  valor: number;
  tipo: TipoTransferencia;
  modo: ModoTransferencia;
  origem: OrigemTransferencia;
  motivo: MotivoTransferencia;
  status: StatusTransferencia;
  dataExecucao: string | null;
  /** Rótulo do item; preenchido nos itens gerados por recorrência. */
  descricao: string | null;
}

export interface AreaDeAcerto {
  reposicoes: Transferencia[];
  aportes: Transferencia[];
  destinacoesReceita: Transferencia[];
}

export interface Dashboard {
  saldoBancarioTotal: number;
  valorComprometidoTotal: number;
  saldoLivre: number;
  percentualComprometido: number;
  necessidadeDeArrecadacaoExtra: boolean;
  valorEmFilaDeExecucao: number;
  itensPendentesNaAreaDeAcerto: number;
  itensEmAnaliseOuOrcamento: number;
}

export const STATUS_COMPROMISSO_LABEL: Record<StatusCompromisso, string> = {
  aguardando_execucao: "Aguardando execução",
  em_fila_execucao: "Em fila de execução",
  em_execucao: "Em execução",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const RESULTADO_DECISAO_LABEL: Record<ResultadoDecisao, string> = {
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  adiado: "Adiado",
};

export const SITUACAO_NECESSIDADE_LABEL: Record<SituacaoNecessidade, string> = {
  em_analise: "Em análise",
  em_orcamento: "Em orçamento",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
  adiado: "Adiado",
  executado: "Executado",
};

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const MOTIVO_TRANSFERENCIA_LABEL: Record<MotivoTransferencia, string> = {
  reposicao: "Reposição",
  aporte: "Aporte",
  destinacao_receita: "Destinação de receita",
};

export const MODULOS_LABEL: Record<string, string> = {
  contas_lancamentos: "Contas e Lançamentos",
  necessidades_cotacoes_fornecedores: "Necessidades / Cotações / Fornecedores",
  decisoes_compromissos: "Decisões e Compromissos",
  pagamentos_fila_execucao: "Pagamentos e Fila",
  transferencias_area_acerto: "Área de Acerto",
  simulacao_caixa_futuro: "Simulação de Caixa",
  dashboard_relatorios: "Dashboard e Relatórios",
  documentos: "Documentos",
  reservas_area_comum: "Reservas",
  auditoria: "Auditoria",
  condominios_usuarios_integracoes: "Condomínios / Usuários",
};

export const FINALIDADE_LABEL: Record<FinalidadeConta, string> = {
  ordinario: "Ordinário",
  extraordinario: "Extraordinário",
  fundo_reserva: "Fundo de reserva",
  fundo_trabalho: "Fundo de trabalho",
  fundo_area_especifica: "Fundo área específica",
};

export const TIPO_PAGAMENTO_LABEL: Record<TipoPagamento, string> = {
  entrada: "Entrada",
  adiantamento: "Adiantamento",
  parcela: "Parcela",
  total: "Total",
};

// ---------------------------------------------------------------- Gestão de acessos (RF03)
export interface AcessoColaboradorResumo {
  usuarioId: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  ativo: boolean;
  condominiosComAcesso: number;
}

export interface AcessoResumo {
  totalColaboradores: number;
  totalCondominios: number;
  semAcesso: number;
  colaboradores: AcessoColaboradorResumo[];
}

export interface CondominioResumo {
  id: string;
  nome: string;
}

export interface AcessoPermissaoItem {
  condominioId: string;
  modulo: string;
  nivel: NivelPermissao;
}

export interface AcessoUsuario {
  usuario: Usuario;
  condominios: CondominioResumo[];
  permissoes: AcessoPermissaoItem[];
}

/** nivel = null remove a permissão. */
export interface AlteracaoAcesso {
  condominioId: string;
  modulo: string;
  nivel: NivelPermissao | null;
}

export interface ModeloAcessoItem {
  modulo: string;
  nivel: NivelPermissao;
}

export interface ModeloAcesso {
  id: string;
  nome: string;
  descricao?: string | null;
  itens: ModeloAcessoItem[];
}

export interface SalvarModeloAcesso {
  nome: string;
  descricao?: string | null;
  itens: ModeloAcessoItem[];
}

// ---------------------------------------------------------------- Documentos (RF20)
export type EntidadeDocumento =
  | "necessidade"
  | "compromisso_financeiro"
  | "pagamento"
  | "decisao"
  | "fornecedor";

export interface Documento {
  id: string;
  entidadeTipo: EntidadeDocumento;
  entidadeId: string;
  tipoDocumento: string;
  referenciaTexto: string;
}

export const ENTIDADE_DOCUMENTO_LABEL: Record<EntidadeDocumento, string> = {
  necessidade: "Necessidade",
  compromisso_financeiro: "Compromisso financeiro",
  pagamento: "Pagamento",
  decisao: "Decisão",
  fornecedor: "Fornecedor",
};

// ---------------------------------------------------------------- Reservas (RF21)
export interface Reserva {
  id: string;
  fundoDestinoId: string;
  unidade: string;
  moradorNome: string;
  valorDestinadoAoFundo: number;
  pagoComDesconto: boolean | null;
  /** DateOnly → "YYYY-MM-DD" */
  periodoReferencia: string;
}

// ---------------------------------------------------------------- Despesas futuras (RF13/RF16)
export type EtapaDespesaFutura = "planejada" | "aprovada" | "contratada";
export type OrigemDespesaFutura = "necessidade" | "compromisso";

export interface DespesaFutura {
  origem: OrigemDespesaFutura;
  id: string;
  descricao: string;
  categoria: string;
  etapa: EtapaDespesaFutura;
  statusDoCompromisso: StatusCompromisso | null;
  situacaoDaNecessidade: SituacaoNecessidade | null;
  prioridade: Prioridade | null;
  /** DateOnly → "YYYY-MM-DD" */
  dataPrevista: string | null;
  fundoId: string | null;
  fundoNome: string | null;
  valor: number;
  valorProvisionado: number;
  semValor: boolean;
  quantidadeCotacoes: number | null;
  prioridadeFila: number | null;
  atrasada: boolean;
  /** Fornecedor da cotação escolhida na aprovação; nulo se Planejada ou sem cotação escolhida. */
  fornecedorId: string | null;
  fornecedorNome: string | null;
}

export interface ListaDespesasFuturas {
  itens: DespesaFutura[];
  quantidade: number;
  totalProvisionado: number;
  totalAprovado: number;
  totalPlanejado: number;
}

export interface FiltroDespesasFuturas {
  fundoId?: string;
  semFundo?: boolean;
  etapa?: EtapaDespesaFutura;
  prioridade?: Prioridade;
  fornecedorId?: string;
  /** DateOnly → "YYYY-MM-DD" */
  de?: string;
  ate?: string;
  busca?: string;
}

export interface ProjecaoFundo {
  fundoId: string;
  nome: string;
  finalidade: FinalidadeConta;
  ehContaOperacional: boolean;
  consideradoNoPlanejamento: boolean;
  saldoAtual: number;
  provisionadoAprovado: number;
  provisionadoPlanejado: number;
  provisionado: number;
  saldoProjetadoAprovados: number;
  saldoProjetado: number;
  emDeficit: boolean;
  deficitProjetado: number;
  quantidadeItens: number;
}

export interface ProjecaoFundos {
  ateData: string | null;
  saldoDisponivelAtual: number;
  totalProvisionado: number;
  compromissosAprovadosPendentes: number;
  previsoesFuturas: number;
  saldoAposAprovados: number;
  saldoAposTudo: number;
  necessidadeAdicionalAgregada: number;
  necessidadeAdicionalPorFundo: number;
  fundosEmDeficit: number;
  despesasAbertas: number;
  provisionadoSemFundo: number;
  quantidadeSemFundo: number;
  provisionadoForaDoPlanejamento: number;
  fundos: ProjecaoFundo[];
}

export const ETAPA_DESPESA_FUTURA_LABEL: Record<EtapaDespesaFutura, string> = {
  planejada: "Planejada",
  aprovada: "Aprovada",
  contratada: "Contratada",
};

// ---------------------------------------------------------------- Receitas recorrentes (RF14, RN20, RN22)
export interface ReceitaRecorrente {
  id: string;
  descricao: string;
  valor: number;
  contaOrigemId: string;
  contaOrigemNome: string;
  contaDestinoId: string;
  contaDestinoNome: string;
  motivo: MotivoTransferencia;
  /** DateOnly → "YYYY-MM-DD" */
  dataInicio: string;
  dataFim: string | null;
  ativa: boolean;
  /** 1º dia da competência do último item gerado. */
  ultimoPeriodoGerado: string | null;
}

export interface GerarRecorrentesPeriodoResultado {
  geradas: number;
  jaGeradas: number;
  itens: Transferencia[];
}

