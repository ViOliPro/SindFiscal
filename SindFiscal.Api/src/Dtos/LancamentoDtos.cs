using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

public record LancamentoResponse(
    Guid Id,
    Guid ContaBancariaId,
    DateOnly Data,
    TipoLancamento Tipo,
    decimal Valor,
    OrigemLancamento Origem,
    FonteLancamento Fonte,
    string? Descricao,
    Guid? EstornoDeId
);

/// <summary>RF05 — lançamento manual (fonte via integração é gerada internamente, RF15).</summary>
public record RegistrarLancamentoManualRequest(
    Guid ContaBancariaId,
    DateOnly Data,
    TipoLancamento Tipo,
    decimal Valor,
    string? Descricao
);

/// <summary>RF16 — lançamento simulado, usado só na simulação de caixa futuro; nunca afeta saldo real.</summary>
public record RegistrarLancamentoSimuladoRequest(
    Guid ContaBancariaId,
    DateOnly Data,
    TipoLancamento Tipo,
    decimal Valor,
    string? Descricao
);

/// <summary>RN32 — estorno referencia o lançamento original, nunca é solto.</summary>
public record EstornarLancamentoRequest(string Motivo);
