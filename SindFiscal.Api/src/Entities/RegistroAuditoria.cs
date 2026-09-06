namespace SindFiscal.Entities;

/// <summary>
/// RF19, RNF04, RNF14 — registro de auditoria imutável (somente INSERT).
/// EntidadeTipo é texto livre (não enum fechado) porque a auditoria cobre
/// qualquer tabela de negócio, não uma lista fixa como Documento.
/// Recomenda-se revogar UPDATE/DELETE nesta tabela para os papéis de
/// aplicação no banco (ver database/schema.sql).
/// </summary>
public class RegistroAuditoria
{
    public Guid Id { get; set; }
    public string EntidadeTipo { get; set; } = null!;
    public Guid EntidadeId { get; set; }
    public Guid UsuarioId { get; set; }
    public DateTimeOffset DataHora { get; set; }
    public string CampoAlterado { get; set; } = null!;
    public string? ValorAnterior { get; set; }
    public string? ValorNovo { get; set; }

    // Navegação
    public Usuario Usuario { get; set; } = null!;
}
