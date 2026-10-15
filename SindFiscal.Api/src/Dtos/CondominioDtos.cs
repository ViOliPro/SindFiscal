namespace SindFiscal.Dtos;

public record CondominioResponse(
    Guid Id,
    string Nome,
    string? Cnpj,
    bool PossuiIntegracaoApi,
    decimal? ValorAlcadaAprovacao,
    bool Ativo
);

public record CriarCondominioRequest(string Nome, string? Cnpj = null);

/// <summary>
/// RF10, RN07 — ValorAlcadaAprovacao é sempre substituído pelo valor enviado
/// (null = "sem alçada configurada para este condomínio").
/// Cnpj: null ou vazio remove o CNPJ; valor informado deve ser único.
/// </summary>
public record AtualizarCondominioRequest(
    string Nome,
    string? Cnpj,
    decimal? ValorAlcadaAprovacao
);
