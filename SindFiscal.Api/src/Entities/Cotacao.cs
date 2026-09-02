namespace SindFiscal.Entities;

/// <summary>RF07, RN05, RN06 — quantidade livre de cotações por necessidade (1 a N).</summary>
public class Cotacao
{
    public Guid Id { get; set; }
    public Guid NecessidadeId { get; set; }
    public Guid FornecedorId { get; set; }
    public decimal Valor { get; set; }
    public int? PrazoExecucaoDias { get; set; }
    public string? GarantiaDescricao { get; set; }
    public string? CondicoesPagamento { get; set; }
    public DateOnly? Validade { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public Necessidade Necessidade { get; set; } = null!;
    public Fornecedor Fornecedor { get; set; } = null!;
}
