namespace SindFiscal.Dtos;

public record CotacaoResponse(
    Guid Id,
    Guid NecessidadeId,
    Guid FornecedorId,
    string FornecedorNome,
    decimal Valor,
    int? PrazoExecucaoDias,
    string? GarantiaDescricao,
    string? CondicoesPagamento,
    DateOnly? Validade
);

/// <summary>RF07, RN05 — quantidade livre (1 a N), sem limite de três.</summary>
public record RegistrarCotacaoRequest(
    Guid FornecedorId,
    decimal Valor,
    int? PrazoExecucaoDias,
    string? GarantiaDescricao,
    string? CondicoesPagamento,
    DateOnly? Validade
);

/// <summary>Visão comparativa entre as cotações de uma mesma necessidade (RF07).</summary>
public record ComparativoCotacoesResponse(
    Guid NecessidadeId,
    IReadOnlyList<CotacaoResponse> Cotacoes,
    decimal MenorValor,
    decimal MaiorValor,
    decimal Diferenca,
    Guid FornecedorMaisBaratoId
);
