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
    decimal SaldoRemanescente,
    /// <summary>RF10, RN07 — true quando ValorAprovado + gastos vinculados atinge a alçada configurada no condomínio.</summary>
    bool RequerValidacaoConselho
);

/// <summary>RF12, RN13, RN14 — resumo de um gasto vinculado, usado na tela de detalhe do compromisso "pai".</summary>
public record GastoVinculadoResumo(
    Guid Id,
    string Categoria,
    decimal Valor,
    StatusCompromisso Status,
    DateTimeOffset CreatedAt
);

/// <summary>RF11 — resumo de um pagamento, usado na tela de detalhe do compromisso.</summary>
public record PagamentoResumo(Guid Id, TipoPagamento Tipo, decimal Valor, DateOnly Data);

/// <summary>Detalhe completo de um compromisso, incluindo gastos vinculados (RF12) e pagamentos (RF11).</summary>
public record CompromissoFinanceiroDetalheResponse(
    CompromissoFinanceiroResponse Compromisso,
    IReadOnlyList<GastoVinculadoResumo> GastosVinculados,
    IReadOnlyList<PagamentoResumo> Pagamentos
);

/// <summary>RF10 — pode ser gerado a partir de uma decisão de aprovação, ou avulso (RN15).</summary>
public record CriarCompromissoAvulsoRequest(string Categoria, decimal ValorAprovado);

/// <summary>RF12 — gasto avulso vinculado a um compromisso "pai", sem exigir orçamento fixo prévio (RN13).</summary>
public record VincularGastoRequest(string Categoria, decimal Valor);

/// <summary>RF13, RN11 — reordenação manual da fila; nesta fase não há critério automático.</summary>
public record ReordenarFilaExecucaoRequest(IReadOnlyList<Guid> CompromissoIdsEmOrdem);

/// <summary>
/// RN09, RN10 — ajusta o valor aprovado de um compromisso já existente (ex.:
/// valor final divergiu da cotação, ou troca de material pós-aprovação).
/// Motivo é obrigatório porque, sem uma tabela de histórico dedicada nesta
/// fase, ele é o único registro do porquê da mudança (ver nota no controller).
/// </summary>
public record AjustarValorCompromissoRequest(decimal NovoValor, string Motivo);

/// <summary>RN12 — cancelamento de um compromisso aprovado, mesmo já em fila.</summary>
public record CancelarCompromissoRequest(string? Motivo);

