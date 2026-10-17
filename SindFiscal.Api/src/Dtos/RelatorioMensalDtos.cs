using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

/// <summary>Totais de lançamentos reais de um mês.</summary>
public record ResumoMensal(
    decimal Entradas,
    decimal Saidas,
    /// <summary>Entradas − Saídas (pode ser negativo; sem clamping, como no Dashboard).</summary>
    decimal Resultado,
    int QuantidadeLancamentos
);

public record MovimentacaoContaMensal(
    Guid ContaId,
    string Nome,
    FinalidadeConta Finalidade,
    bool EhContaOperacional,
    decimal Entradas,
    decimal Saidas,
    decimal Liquido,
    /// <summary>Saldo na data de geração do relatório (o sistema não guarda saldo histórico).</summary>
    decimal SaldoAtual
);

public record DespesaCategoriaMensal(
    string Categoria,
    decimal TotalMes,
    decimal TotalMesAnterior,
    /// <summary>TotalMes − TotalMesAnterior, sempre exibido junto do percentual (percentual sozinho engana em base pequena).</summary>
    decimal Variacao,
    /// <summary>Nulo quando não há gasto no mês anterior.</summary>
    decimal? VariacaoPercentual,
    ClassificacaoDespesa Classificacao,
    int Quantidade
);

public record DespesaMensal(
    Guid LancamentoId,
    DateOnly Data,
    string Descricao,
    string ContaNome,
    string Categoria,
    Guid? FundoResponsavelId,
    string? FundoResponsavelNome,
    decimal Valor,
    ClassificacaoDespesa Classificacao,
    bool ConciliacaoDispensada
);

/// <summary>
/// RF18 — relatório mensal de prestação de contas. Parcial = o mês ainda não
/// terminou na data de geração. Os limiares usados na classificação voltam na
/// resposta para a tela explicar o critério.
/// </summary>
public record RelatorioMensalResponse(
    DateOnly Competencia,
    DateOnly Inicio,
    DateOnly Fim,
    bool Parcial,
    decimal LimiarVariacao,
    decimal ValorMinimoVariacao,
    ResumoMensal Resumo,
    ResumoMensal MesAnterior,
    decimal PagamentosRegistradosNoMes,
    int CompromissosAprovadosNoMes,
    decimal ValorCompromissosAprovadosNoMes,
    IReadOnlyList<MovimentacaoContaMensal> PorConta,
    IReadOnlyList<DespesaCategoriaMensal> DespesasPorCategoria,
    IReadOnlyList<DespesaMensal> Despesas,
    /// <summary>Parcela das saídas do mês nas 3 maiores despesas (0 a 1).</summary>
    decimal ConcentracaoTop3,
    IReadOnlyList<TransferenciaResponse> TransferenciasExecutadas,
    int PendenciasAbertas
);
