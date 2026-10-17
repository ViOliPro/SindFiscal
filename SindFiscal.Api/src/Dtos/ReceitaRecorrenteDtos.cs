using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

public record ReceitaRecorrenteResponse(
    Guid Id,
    string Descricao,
    decimal Valor,
    Guid ContaOrigemId,
    string ContaOrigemNome,
    Guid ContaDestinoId,
    string ContaDestinoNome,
    MotivoTransferencia Motivo,
    DateOnly DataInicio,
    DateOnly? DataFim,
    bool Ativa,
    /// <summary>Competência (1º dia do mês) do último item já gerado por esta recorrência.</summary>
    DateOnly? UltimoPeriodoGerado
);

/// <summary>
/// Cria uma recorrência mensal. Motivo: aporte ou destinacao_receita. Sem
/// ContaOrigemId, usa a conta operacional do condomínio.
/// </summary>
public record CriarReceitaRecorrenteRequest(
    string Descricao,
    decimal Valor,
    Guid? ContaOrigemId,
    Guid ContaDestinoId,
    MotivoTransferencia Motivo,
    DateOnly DataInicio,
    DateOnly? DataFim
);

/// <summary>Atualiza uma recorrência. Itens já gerados não são alterados.</summary>
public record AtualizarReceitaRecorrenteRequest(
    string Descricao,
    decimal Valor,
    Guid? ContaOrigemId,
    Guid ContaDestinoId,
    MotivoTransferencia Motivo,
    DateOnly DataInicio,
    DateOnly? DataFim,
    bool Ativa
);

/// <summary>Qualquer dia do mês desejado; a competência é o mês inteiro.</summary>
public record GerarRecorrentesPeriodoRequest(DateOnly PeriodoReferencia);

public record GerarRecorrentesPeriodoResponse(
    int Geradas,
    int JaGeradas,
    IReadOnlyList<TransferenciaResponse> Itens
);
