using SindFiscal.Api.src.Enum;

namespace SindFiscal.Api.src.Entities;

/// <summary>
/// RF15, RNF13 — 1:1 com condomínio. Agnóstica de fornecedor (RN01–RN03):
/// nesta versão, TipoFonteVerdade é sempre Manual para todos os condomínios
/// (decisão de projeto) — campo mantido para habilitar integração futura
/// sem alterar o schema.
/// </summary>
public class ConfiguracaoIntegracao
{
    public Guid Id { get; set; }
    public Guid CondominioId { get; set; }
    public TipoFonteVerdade TipoFonteVerdade { get; set; } = TipoFonteVerdade.Manual;
    public bool PermiteTransferenciaAutomatica { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public Condominio Condominio { get; set; } = null!;
}
