using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

/// <summary>
/// RF13, RF16 — um item da visão de despesas futuras: necessidade ainda sem
/// compromisso (Planejada) ou compromisso aberto (Aprovada/Contratada).
/// </summary>
public record DespesaFuturaResponse(
    OrigemDespesaFutura Origem,
    Guid Id,
    string Descricao,
    string Categoria,
    EtapaDespesaFutura Etapa,
    StatusCompromisso? StatusDoCompromisso,
    SituacaoNecessidade? SituacaoDaNecessidade,
    Prioridade? Prioridade,
    DateOnly? DataPrevista,
    Guid? FundoId,
    string? FundoNome,
    /// <summary>Valor aprovado (compromisso) ou estimado/menor cotação (necessidade).</summary>
    decimal Valor,
    /// <summary>Parcela ainda não paga — é o que pesa na projeção do fundo.</summary>
    decimal ValorProvisionado,
    /// <summary>true quando uma necessidade não tem valor estimado nem cotação.</summary>
    bool SemValor,
    int? QuantidadeCotacoes,
    int? PrioridadeFila,
    /// <summary>true quando a data prevista já passou e o item continua aberto.</summary>
    bool Atrasada
);

public record ListaDespesasFuturasResponse(
    IReadOnlyList<DespesaFuturaResponse> Itens,
    int Quantidade,
    decimal TotalProvisionado,
    decimal TotalAprovado,
    decimal TotalPlanejado
);

/// <summary>Projeção de um fundo após as despesas futuras (sem transferência entre fundos).</summary>
public record ProjecaoFundoResponse(
    Guid FundoId,
    string Nome,
    FinalidadeConta Finalidade,
    bool EhContaOperacional,
    bool ConsideradoNoPlanejamento,
    decimal SaldoAtual,
    decimal ProvisionadoAprovado,
    decimal ProvisionadoPlanejado,
    decimal Provisionado,
    decimal SaldoProjetadoAprovados,
    decimal SaldoProjetado,
    bool EmDeficit,
    decimal DeficitProjetado,
    int QuantidadeItens
);

/// <summary>
/// Projeção consolidada. Os totais consideram apenas fundos marcados como
/// "considerados no planejamento". NecessidadeAdicionalPorFundo soma os déficits
/// de cada fundo — é maior que a agregada quando um fundo sobra e outro falta,
/// já que o saldo de um fundo não cobre o déficit de outro.
/// </summary>
public record ProjecaoFundosResponse(
    DateOnly? AteData,
    decimal SaldoDisponivelAtual,
    decimal TotalProvisionado,
    decimal CompromissosAprovadosPendentes,
    decimal PrevisoesFuturas,
    decimal SaldoAposAprovados,
    decimal SaldoAposTudo,
    decimal NecessidadeAdicionalAgregada,
    decimal NecessidadeAdicionalPorFundo,
    int FundosEmDeficit,
    int DespesasAbertas,
    decimal ProvisionadoSemFundo,
    int QuantidadeSemFundo,
    decimal ProvisionadoForaDoPlanejamento,
    IReadOnlyList<ProjecaoFundoResponse> Fundos
);

/// <summary>Define prioridade (rótulo), data e fundo previstos de um compromisso. Nulos limpam o campo.</summary>
public record AtualizarPlanejamentoCompromissoRequest(
    Prioridade? Prioridade,
    DateOnly? DataPrevista,
    Guid? FundoPrevistoId
);

/// <summary>Define prioridade, data, fundo e valor estimado de uma necessidade. Nulos limpam o campo.</summary>
public record AtualizarPlanejamentoNecessidadeRequest(
    Prioridade? Prioridade,
    DateOnly? DataPrevista,
    Guid? FundoPrevistoId,
    decimal? ValorEstimado
);

public record DefinirFundoNoPlanejamentoRequest(bool Considerar);
