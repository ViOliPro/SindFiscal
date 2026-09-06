using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

public record CompromissoFinanceiroResponse(
    Guid Id,
    Guid? NecessidadeId,
    Guid? CompromissoPaiId,
    string Categoria,
    decimal ValorAprovado,
    StatusCompromisso Status,
    int? PrioridadeFila,
    decimal TotalGastosVinculados,
    decimal TotalPago,
    decimal SaldoRemanescente
);

/// <summary>RF10 — pode ser gerado a partir de uma decisão de aprovação, ou avulso (RN15).</summary>
public record CriarCompromissoAvulsoRequest(string Categoria, decimal ValorAprovado);

/// <summary>RF12 — gasto avulso vinculado a um compromisso "pai", sem exigir orçamento fixo prévio (RN13).</summary>
public record VincularGastoRequest(string Categoria, decimal Valor);

/// <summary>RF13, RN11 — reordenação manual da fila; nesta fase não há critério automático.</summary>
public record ReordenarFilaExecucaoRequest(IReadOnlyList<Guid> CompromissoIdsEmOrdem);
