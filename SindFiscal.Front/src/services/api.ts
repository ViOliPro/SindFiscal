import { apiFetch } from "@/lib/api";
import type {
  AcessoResumo,
  AcessoUsuario,
  AlteracaoAcesso,
  AreaDeAcerto,
  ComparativoCotacoes,
  Condominio,
  CompromissoFinanceiro,
  CompromissoFinanceiroDetalhe,
  ContaBancaria,
  Cotacao,
  Dashboard,
  Decisao,
  FinalidadeConta,
  Fornecedor,
  Lancamento,
  LoginResponse,
  ModeloAcesso,
  Necessidade,
  NivelPermissao,
  Pagamento,
  Permissao,
  Prioridade,
  SalvarModeloAcesso,
  ResultadoDecisao,
  SituacaoNecessidade,
  StatusCompromisso,
  TipoLancamento,
  TipoPagamento,
  TipoRegraAporte,
  Transferencia,
  Usuario,
  Documento,
  EntidadeDocumento,
  Reserva,
  ListaDespesasFuturas,
  FiltroDespesasFuturas,
  GerarRecorrentesPeriodoResultado,
  MotivoTransferencia,
  Pendencias,
  ProjecaoFundos,
  ReceitaRecorrente,
  RelatorioMensal,
} from "@/types";

// ---------------------------------------------------------------- Auth
export function login(email: string, senha: string) {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, senha }),
  });
}

export function bootstrap(nome: string, email: string, senha: string) {
  return apiFetch<LoginResponse>("/auth/bootstrap", {
    method: "POST",
    body: JSON.stringify({ nome, email, senha }),
  });
}

export function me() {
  return apiFetch<Usuario>("/auth/me");
}

export function listarCondominios(incluirInativos = false) {
  const qs = incluirInativos ? "?incluirInativos=true" : "";
  return apiFetch<Condominio[]>(`/condominios${qs}`);
}

export function criarCondominio(data: { nome: string; cnpj?: string | null }) {
  return apiFetch<Condominio>("/condominios", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function atualizarCondominio(
  condominioId: string,
  data: {
    nome: string;
    cnpj?: string | null;
    valorAlcadaAprovacao?: number | null;
  },
) {
  return apiFetch<Condominio>(`/condominios/${condominioId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function excluirCondominio(condominioId: string) {
  return apiFetch<void>(`/condominios/${condominioId}`, { method: "DELETE" });
}

export function reativarCondominio(condominioId: string) {
  return apiFetch<Condominio>(`/condominios/${condominioId}/reativar`, {
    method: "POST",
  });
}

export function listarUsuarios() {
  return apiFetch<Usuario[]>("/usuarios");
}

export function criarColaborador(
  nome: string,
  email: string,
  senhaProvisoria: string,
) {
  return apiFetch<Usuario>("/usuarios/colaboradores", {
    method: "POST",
    body: JSON.stringify({ nome, email, senhaProvisoria }),
  });
}

export function listarPermissoes(condominioId: string) {
  return apiFetch<Permissao[]>(`/condominios/${condominioId}/permissoes`);
}

export function concederPermissao(
  condominioId: string,
  usuarioId: string,
  modulo: string,
  nivel: NivelPermissao,
) {
  return apiFetch<Permissao>(`/condominios/${condominioId}/permissoes`, {
    method: "POST",
    body: JSON.stringify({ usuarioId, modulo, nivel }),
  });
}

// ---------------------------------------------------------------- Contas / Lançamentos
export function listarContas(condominioId: string) {
  return apiFetch<ContaBancaria[]>(`/condominios/${condominioId}/contas`);
}

export function criarConta(
  condominioId: string,
  data: {
    nome: string;
    finalidade: FinalidadeConta;
    ehContaOperacional: boolean;
    regraAporteTipo?: TipoRegraAporte | null;
    regraAporteValor?: number | null;
    tetoMaximo?: number | null;
  },
) {
  return apiFetch<ContaBancaria>(`/condominios/${condominioId}/contas`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function atualizarRegraAporte(
  condominioId: string,
  contaId: string,
  data: {
    regraAporteTipo?: TipoRegraAporte | null;
    regraAporteValor?: number | null;
    tetoMaximo?: number | null;
  },
) {
  return apiFetch<ContaBancaria>(
    `/condominios/${condominioId}/contas/${contaId}/regra-aporte`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

export function excluirConta(condominioId: string, contaId: string) {
  return apiFetch<void>(`/condominios/${condominioId}/contas/${contaId}`, {
    method: "DELETE",
  });
}

export function listarLancamentos(
  condominioId: string,
  params?: { contaBancariaId?: string; de?: string; ate?: string },
) {
  const q = new URLSearchParams();
  if (params?.contaBancariaId) q.set("contaBancariaId", params.contaBancariaId);
  if (params?.de) q.set("de", params.de);
  if (params?.ate) q.set("ate", params.ate);
  const qs = q.toString();
  return apiFetch<Lancamento[]>(
    `/condominios/${condominioId}/lancamentos${qs ? `?${qs}` : ""}`,
  );
}

export function registrarLancamento(
  condominioId: string,
  data: {
    contaBancariaId: string;
    data: string;
    tipo: TipoLancamento;
    valor: number;
    descricao?: string;
  },
) {
  return apiFetch<Lancamento>(`/condominios/${condominioId}/lancamentos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function estornarLancamento(
  condominioId: string,
  lancamentoId: string,
  motivo: string,
) {
  return apiFetch<Lancamento>(
    `/condominios/${condominioId}/lancamentos/${lancamentoId}/estornar`,
    { method: "POST", body: JSON.stringify({ motivo }) },
  );
}

// ---------------------------------------------------------------- Dashboard
export function obterDashboard(condominioId: string) {
  return apiFetch<Dashboard>(`/condominios/${condominioId}/dashboard`);
}

export function relatorioPrestacaoContas(
  condominioId: string,
  inicio: string,
  fim: string,
) {
  const q = new URLSearchParams({ inicio, fim });
  return apiFetch<unknown>(
    `/condominios/${condominioId}/dashboard/relatorio-prestacao-contas?${q}`,
  );
}

// ---------------------------------------------------------------- Fornecedores (RF08)
export function listarFornecedores() {
  return apiFetch<Fornecedor[]>("/fornecedores");
}

export function criarFornecedor(data: {
  nome: string;
  categoria: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
}) {
  return apiFetch<Fornecedor>("/fornecedores", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function avaliarFornecedor(
  fornecedorId: string,
  nota: number,
  comentario?: string,
) {
  return apiFetch<Fornecedor>(`/fornecedores/${fornecedorId}/avaliar`, {
    method: "POST",
    body: JSON.stringify({ nota, comentario }),
  });
}

// ---------------------------------------------------------------- Necessidades (RF06)
export function listarNecessidades(
  condominioId: string,
  situacao?: SituacaoNecessidade,
) {
  const qs = situacao ? `?situacao=${situacao}` : "";
  return apiFetch<Necessidade[]>(
    `/condominios/${condominioId}/necessidades${qs}`,
  );
}

export function obterNecessidade(condominioId: string, necessidadeId: string) {
  return apiFetch<Necessidade>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}`,
  );
}

export function criarNecessidade(
  condominioId: string,
  data: {
    descricao: string;
    categoria: string;
    prioridade?: Prioridade | null;
    escopoTexto?: string;
    responsavelId?: string | null;
  },
) {
  return apiFetch<Necessidade>(`/condominios/${condominioId}/necessidades`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function atualizarSituacaoNecessidade(
  condominioId: string,
  necessidadeId: string,
  situacao: SituacaoNecessidade,
) {
  return apiFetch<Necessidade>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}/situacao`,
    { method: "PATCH", body: JSON.stringify({ situacao }) },
  );
}

// ---------------------------------------------------------------- Cotações (RF07)
export function listarCotacoes(condominioId: string, necessidadeId: string) {
  return apiFetch<Cotacao[]>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}/cotacoes`,
  );
}

export function comparativoCotacoes(
  condominioId: string,
  necessidadeId: string,
) {
  return apiFetch<ComparativoCotacoes>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}/cotacoes/comparativo`,
  );
}

export function registrarCotacao(
  condominioId: string,
  necessidadeId: string,
  data: {
    fornecedorId: string;
    valor: number;
    prazoExecucaoDias?: number | null;
    garantiaDescricao?: string;
    condicoesPagamento?: string;
    validade?: string | null;
  },
) {
  return apiFetch<Cotacao>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}/cotacoes`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

// ---------------------------------------------------------------- Decisões (RF09)
export function listarDecisoes(condominioId: string, necessidadeId: string) {
  return apiFetch<Decisao[]>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}/decisoes`,
  );
}

export function registrarDecisao(
  condominioId: string,
  necessidadeId: string,
  data: {
    cotacaoEscolhidaId?: string | null;
    resultado: ResultadoDecisao;
    justificativa?: string;
    referenciaRespaldo?: string;
    data: string;
  },
) {
  return apiFetch<Decisao>(
    `/condominios/${condominioId}/necessidades/${necessidadeId}/decisoes`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

// ---------------------------------------------------------------- Compromissos (RF10/RF12/RF13)
export function listarCompromissos(
  condominioId: string,
  status?: StatusCompromisso,
) {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<CompromissoFinanceiro[]>(
    `/condominios/${condominioId}/compromissos${qs}`,
  );
}

export function obterCompromisso(condominioId: string, compromissoId: string) {
  return apiFetch<CompromissoFinanceiroDetalhe>(
    `/condominios/${condominioId}/compromissos/${compromissoId}`,
  );
}

export function criarCompromissoAvulso(
  condominioId: string,
  data: { categoria: string; valorAprovado: number },
) {
  return apiFetch<CompromissoFinanceiro>(
    `/condominios/${condominioId}/compromissos/avulsos`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function vincularGasto(
  condominioId: string,
  compromissoPaiId: string,
  data: { categoria: string; valor: number },
) {
  return apiFetch<CompromissoFinanceiro>(
    `/condominios/${condominioId}/compromissos/${compromissoPaiId}/gastos-vinculados`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function ajustarValorCompromisso(
  condominioId: string,
  compromissoId: string,
  novoValor: number,
  motivo: string,
) {
  return apiFetch<CompromissoFinanceiro>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/ajustar-valor`,
    { method: "PUT", body: JSON.stringify({ novoValor, motivo }) },
  );
}

export function cancelarCompromisso(
  condominioId: string,
  compromissoId: string,
  motivo?: string,
) {
  return apiFetch<CompromissoFinanceiro>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/cancelar`,
    { method: "POST", body: JSON.stringify({ motivo }) },
  );
}

export function entrarNaFila(condominioId: string, compromissoId: string) {
  return apiFetch<void>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/entrar-na-fila`,
    { method: "POST" },
  );
}

export function adiarCompromisso(condominioId: string, compromissoId: string) {
  return apiFetch<void>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/adiar`,
    { method: "POST" },
  );
}

export function sairDaFila(condominioId: string, compromissoId: string) {
  return apiFetch<void>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/sair-da-fila`,
    { method: "POST" },
  );
}

export function iniciarExecucao(condominioId: string, compromissoId: string) {
  return apiFetch<void>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/iniciar-execucao`,
    { method: "POST" },
  );
}

export function concluirCompromisso(
  condominioId: string,
  compromissoId: string,
) {
  return apiFetch<void>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/concluir`,
    { method: "POST" },
  );
}

export function reordenarFila(
  condominioId: string,
  compromissoIdsEmOrdem: string[],
) {
  return apiFetch<void>(
    `/condominios/${condominioId}/compromissos/fila-execucao/reordenar`,
    { method: "PUT", body: JSON.stringify({ compromissoIdsEmOrdem }) },
  );
}

// ---------------------------------------------------------------- Pagamentos (RF11)
export function listarPagamentos(condominioId: string, compromissoId: string) {
  return apiFetch<Pagamento[]>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/pagamentos`,
  );
}

export function registrarPagamento(
  condominioId: string,
  compromissoId: string,
  data: {
    fundoResponsavelId: string;
    tipo: TipoPagamento;
    valor: number;
    data: string;
    lancamentoIdParaReconciliar?: string | null;
  },
) {
  return apiFetch<Pagamento>(
    `/condominios/${condominioId}/compromissos/${compromissoId}/pagamentos`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

// ---------------------------------------------------------------- Área de Acerto (RF14)
export function listarAreaDeAcerto(condominioId: string) {
  return apiFetch<AreaDeAcerto>(`/condominios/${condominioId}/area-de-acerto`);
}

export function consolidarItensAcerto(
  condominioId: string,
  transferenciaIdsParaConsolidar: string[],
) {
  return apiFetch<Transferencia>(
    `/condominios/${condominioId}/area-de-acerto/consolidar`,
    {
      method: "POST",
      body: JSON.stringify({ transferenciaIdsParaConsolidar }),
    },
  );
}

export function confirmarExecucaoAcerto(
  condominioId: string,
  transferenciaId: string,
  dataExecucao: string,
) {
  return apiFetch<void>(
    `/condominios/${condominioId}/area-de-acerto/${transferenciaId}/confirmar-execucao`,
    { method: "POST", body: JSON.stringify({ dataExecucao }) },
  );
}

// ---------------------------------------------------------------- Gestão de acessos (RF03)
export function resumoAcessos() {
  return apiFetch<AcessoResumo>("/acessos/resumo");
}

export function obterAcessosUsuario(usuarioId: string) {
  return apiFetch<AcessoUsuario>(`/acessos/usuarios/${usuarioId}`);
}

/** Grava várias células da matriz de uma vez (nivel = null remove). */
export function salvarAcessosUsuario(
  usuarioId: string,
  alteracoes: AlteracaoAcesso[],
) {
  return apiFetch<AcessoUsuario>(`/acessos/usuarios/${usuarioId}`, {
    method: "PUT",
    body: JSON.stringify({ alteracoes }),
  });
}

export function listarModelosAcesso() {
  return apiFetch<ModeloAcesso[]>("/modelos-acesso");
}

export function criarModeloAcesso(data: SalvarModeloAcesso) {
  return apiFetch<ModeloAcesso>("/modelos-acesso", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function atualizarModeloAcesso(modeloId: string, data: SalvarModeloAcesso) {
  return apiFetch<ModeloAcesso>(`/modelos-acesso/${modeloId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function excluirModeloAcesso(modeloId: string) {
  return apiFetch<void>(`/modelos-acesso/${modeloId}`, { method: "DELETE" });
}

/** Cria Consulta / Operacional / Gestor (os que ainda não existirem). */
export function criarModelosPadrao() {
  return apiFetch<ModeloAcesso[]>("/modelos-acesso/padrao", { method: "POST" });
}

// ---------------------------------------------------------------- Documentos (RF20)
export function listarDocumentos(
  condominioId: string,
  entidadeTipo: EntidadeDocumento,
  entidadeId: string,
) {
  const q = new URLSearchParams({ entidadeTipo, entidadeId });
  return apiFetch<Documento[]>(
    `/condominios/${condominioId}/documentos?${q}`,
  );
}

export function registrarDocumento(
  condominioId: string,
  data: {
    entidadeTipo: EntidadeDocumento;
    entidadeId: string;
    tipoDocumento: string;
    referenciaTexto: string;
  },
) {
  return apiFetch<Documento>(`/condominios/${condominioId}/documentos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function atualizarDocumento(
  condominioId: string,
  documentoId: string,
  data: { tipoDocumento: string; referenciaTexto: string },
) {
  return apiFetch<Documento>(
    `/condominios/${condominioId}/documentos/${documentoId}`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

// ---------------------------------------------------------------- Reservas (RF21)
export function listarReservas(
  condominioId: string,
  opts?: { fundoDestinoId?: string; periodoReferencia?: string },
) {
  const q = new URLSearchParams();
  if (opts?.fundoDestinoId) q.set("fundoDestinoId", opts.fundoDestinoId);
  if (opts?.periodoReferencia) q.set("periodoReferencia", opts.periodoReferencia);
  const qs = q.toString();
  return apiFetch<Reserva[]>(
    `/condominios/${condominioId}/reservas${qs ? `?${qs}` : ""}`,
  );
}

export function registrarReserva(
  condominioId: string,
  data: {
    fundoDestinoId: string;
    unidade: string;
    moradorNome: string;
    valorDestinadoAoFundo: number;
    pagoComDesconto?: boolean | null;
    periodoReferencia: string;
  },
) {
  return apiFetch<Reserva>(`/condominios/${condominioId}/reservas`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fecharPeriodoReservas(
  condominioId: string,
  fundoDestinoId: string,
  periodoReferencia: string,
) {
  return apiFetch<Transferencia>(
    `/condominios/${condominioId}/reservas/fechar-periodo`,
    {
      method: "POST",
      body: JSON.stringify({ fundoDestinoId, periodoReferencia }),
    },
  );
}

// ---------------------------------------------------------------- Despesas futuras (RF13/RF16)
export function listarDespesasFuturas(
  condominioId: string,
  filtro: FiltroDespesasFuturas = {},
) {
  const q = new URLSearchParams();
  if (filtro.fundoId) q.set("fundoId", filtro.fundoId);
  if (filtro.semFundo) q.set("semFundo", "true");
  if (filtro.etapa) q.set("etapa", filtro.etapa);
  if (filtro.prioridade) q.set("prioridade", filtro.prioridade);
  if (filtro.fornecedorId) q.set("fornecedorId", filtro.fornecedorId);
  if (filtro.de) q.set("de", filtro.de);
  if (filtro.ate) q.set("ate", filtro.ate);
  if (filtro.busca) q.set("busca", filtro.busca);
  const qs = q.toString();
  return apiFetch<ListaDespesasFuturas>(
    `/condominios/${condominioId}/despesas-futuras${qs ? `?${qs}` : ""}`,
  );
}

export function obterProjecaoFundos(condominioId: string, ate?: string) {
  const qs = ate ? `?ate=${encodeURIComponent(ate)}` : "";
  return apiFetch<ProjecaoFundos>(
    `/condominios/${condominioId}/despesas-futuras/projecao${qs}`,
  );
}

export function atualizarPlanejamentoCompromisso(
  condominioId: string,
  compromissoId: string,
  data: {
    prioridade: Prioridade | null;
    dataPrevista: string | null;
    fundoPrevistoId: string | null;
  },
) {
  return apiFetch<void>(
    `/condominios/${condominioId}/despesas-futuras/compromissos/${compromissoId}/planejamento`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export function atualizarPlanejamentoNecessidade(
  condominioId: string,
  necessidadeId: string,
  data: {
    prioridade: Prioridade | null;
    dataPrevista: string | null;
    fundoPrevistoId: string | null;
    valorEstimado: number | null;
  },
) {
  return apiFetch<void>(
    `/condominios/${condominioId}/despesas-futuras/necessidades/${necessidadeId}/planejamento`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export function definirFundoNoPlanejamento(
  condominioId: string,
  contaId: string,
  considerar: boolean,
) {
  return apiFetch<void>(
    `/condominios/${condominioId}/despesas-futuras/fundos/${contaId}/considerar`,
    { method: "PUT", body: JSON.stringify({ considerar }) },
  );
}

// ---------------------------------------------------------------- Receitas recorrentes (RF14, RN20, RN22)
export interface ReceitaRecorrenteInput {
  descricao: string;
  valor: number;
  contaOrigemId: string | null;
  contaDestinoId: string;
  motivo: MotivoTransferencia;
  dataInicio: string;
  dataFim: string | null;
}

export function listarReceitasRecorrentes(condominioId: string) {
  return apiFetch<ReceitaRecorrente[]>(
    `/condominios/${condominioId}/receitas-recorrentes`,
  );
}

export function criarReceitaRecorrente(
  condominioId: string,
  data: ReceitaRecorrenteInput,
) {
  return apiFetch<ReceitaRecorrente>(
    `/condominios/${condominioId}/receitas-recorrentes`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function atualizarReceitaRecorrente(
  condominioId: string,
  id: string,
  data: ReceitaRecorrenteInput & { ativa: boolean },
) {
  return apiFetch<ReceitaRecorrente>(
    `/condominios/${condominioId}/receitas-recorrentes/${id}`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export function gerarRecorrentesDoPeriodo(
  condominioId: string,
  periodoReferencia: string,
) {
  return apiFetch<GerarRecorrentesPeriodoResultado>(
    `/condominios/${condominioId}/receitas-recorrentes/gerar-periodo`,
    { method: "POST", body: JSON.stringify({ periodoReferencia }) },
  );
}

// ---------------------------------------------------------------- Pendências (RF17)
export function listarPendencias(condominioId: string, desde?: string) {
  const q = desde ? `?desde=${encodeURIComponent(desde)}` : "";
  return apiFetch<Pendencias>(`/condominios/${condominioId}/pendencias${q}`);
}

export function dispensarConciliacao(
  condominioId: string,
  lancamentoId: string,
  motivo: string,
) {
  return apiFetch<void>(
    `/condominios/${condominioId}/pendencias/lancamentos/${lancamentoId}/dispensar`,
    { method: "POST", body: JSON.stringify({ motivo }) },
  );
}

export function reativarConciliacao(condominioId: string, lancamentoId: string) {
  return apiFetch<void>(
    `/condominios/${condominioId}/pendencias/lancamentos/${lancamentoId}/reativar`,
    { method: "POST" },
  );
}

// ---------------------------------------------------------------- Relatório mensal (RF18)
export function obterRelatorioMensal(
  condominioId: string,
  competencia: string,
  opcoes: { limiarVariacao?: number; valorMinimo?: number } = {},
) {
  const q = new URLSearchParams({ competencia });
  if (opcoes.limiarVariacao != null)
    q.set("limiarVariacao", String(opcoes.limiarVariacao));
  if (opcoes.valorMinimo != null) q.set("valorMinimo", String(opcoes.valorMinimo));
  return apiFetch<RelatorioMensal>(
    `/condominios/${condominioId}/relatorios/mensal?${q}`,
  );
}

