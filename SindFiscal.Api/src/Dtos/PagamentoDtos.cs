using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

public record PagamentoResponse(
    Guid Id,
    Guid CompromissoId,
    Guid FundoResponsavelId,
    Guid? LancamentoId,
    TipoPagamento Tipo,
    decimal Valor,
    DateOnly Data
);

/// <summary>
/// RF11, RN19 — FundoResponsavelId pode ser diferente da conta operacional de fato
/// usada para pagar. Quando isso acontecer, o AreaDeAcertoService gera automaticamente
/// um item de reposição pendente (ver Services/AreaDeAcertoService.cs).
/// </summary>
public record RegistrarPagamentoRequest(
    Guid FundoResponsavelId,
    TipoPagamento Tipo,
    decimal Valor,
    DateOnly Data,
    Guid? LancamentoIdParaReconciliar
);
