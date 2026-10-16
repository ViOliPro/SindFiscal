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
