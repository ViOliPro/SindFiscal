namespace SindFiscal.Dtos;

/// <summary>
/// RF17, RNF05 — indicadores sempre recalculados a partir dos dados registrados
/// (nunca armazenados), para não repetir a inconsistência identificada na
/// planilha original (Total em caixa divergindo da soma de seus componentes).
/// </summary>
public record DashboardResponse(
    decimal SaldoBancarioTotal,
    decimal ValorComprometidoTotal,
    decimal SaldoLivre,
    decimal PercentualComprometido,
    bool NecessidadeDeArrecadacaoExtra,
    decimal ValorEmFilaDeExecucao,
    int ItensPendentesNaAreaDeAcerto,
    int ItensEmAnaliseOuOrcamento
);

public record RelatorioPrestacaoContasRequest(DateOnly Inicio, DateOnly Fim);

public record RelatorioPrestacaoContasResponse(
    DateOnly Inicio,
    DateOnly Fim,
    decimal TotalEntradas,
    decimal TotalSaidas,
    IReadOnlyList<CompromissoFinanceiroResponse> CompromissosNoPeriodo,
    IReadOnlyList<TransferenciaResponse> TransferenciasNoPeriodo
);
