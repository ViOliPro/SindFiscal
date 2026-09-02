using SindFiscal.Api.src.Enum;

namespace SindFiscal.Api.src.Entities;

/// <summary>
/// RF20 — nesta versão, apenas referência textual (nº NF, descrição do
/// comprovante etc.), sem upload real de arquivo. EntidadeTipo/EntidadeId
/// formam uma associação polimórfica SEM foreign key no banco — a integridade
/// é responsabilidade da camada de aplicação (ver nota em database/schema.sql).
/// </summary>
public class Documento
{
    public Guid Id { get; set; }
    public EntidadeDocumento EntidadeTipo { get; set; }
    public Guid EntidadeId { get; set; }
    public string TipoDocumento { get; set; } = null!;
    public string ReferenciaTexto { get; set; } = null!;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}
