using SindFiscal.Api.src.Enum;

namespace SindFiscal.Api.src.Entities;

/// <summary>
/// RF09 — decisão como evento histórico. Deliberadamente sem UpdatedAt:
/// alteração de escopo pós-aprovação gera NOVO registro (RN09), nunca update
/// (RNF05, RNF06).
/// </summary>
public class Decisao
{
    public Guid Id { get; set; }
    public Guid NecessidadeId { get; set; }
    public Guid? CotacaoEscolhidaId { get; set; }
    public Guid ResponsavelId { get; set; }
    public DateOnly Data { get; set; }
    public ResultadoDecisao Resultado { get; set; }
    public string? Justificativa { get; set; }

    /// <summary>Nº da ata / assembleia que respalda a decisão (RF09).</summary>
    public string? ReferenciaRespaldo { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    // Navegação
    public Necessidade Necessidade { get; set; } = null!;
    public Cotacao? CotacaoEscolhida { get; set; }
    public Usuario Responsavel { get; set; } = null!;
}
