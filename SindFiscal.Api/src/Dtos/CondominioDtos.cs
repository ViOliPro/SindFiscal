namespace SindFiscal.Dtos;

public record CondominioResponse(
    Guid Id,
    string Nome,
    bool PossuiIntegracaoApi,
    decimal? ValorAlcadaAprovacao
);

public record CriarCondominioRequest(string Nome);

/// <summary>
/// RF10, RN07 — ValorAlcadaAprovacao é sempre substituído pelo valor enviado
/// (null = "sem alçada configurada para este condomínio").
/// </summary>
public record AtualizarCondominioRequest(string Nome, decimal? ValorAlcadaAprovacao);
