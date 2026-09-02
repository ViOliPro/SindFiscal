namespace SindFiscal.Entities;

/// <summary>RF08, RN04 — fornecedor pertence ao síndico, compartilhado entre todos os seus condomínios.</summary>
public class Fornecedor
{
    public Guid Id { get; set; }
    public Guid SindicoId { get; set; }
    public string Nome { get; set; } = null!;
    public string Categoria { get; set; } = null!;

    /// <summary>Avaliação em estrelas, 1 a 5 (RF08). Nula até a primeira avaliação.</summary>
    public short? AvaliacaoNota { get; set; }
    public string? AvaliacaoComentario { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public Usuario Sindico { get; set; } = null!;
    public ICollection<Cotacao> Cotacoes { get; set; } = new List<Cotacao>();
}
