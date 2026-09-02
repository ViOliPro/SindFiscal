using SindFiscal.Data.Enums;

namespace SindFiscal.Entities;

/// <summary>RF05, RN01–RN03, RN32 — movimentação financeira real ou simulada.</summary>
public class Lancamento
{
    public Guid Id { get; set; }
    public Guid ContaBancariaId { get; set; }
    public DateOnly Data { get; set; }
    public TipoLancamento Tipo { get; set; }
    public decimal Valor { get; set; }
    public OrigemLancamento Origem { get; set; } = OrigemLancamento.Real;
    public FonteLancamento Fonte { get; set; } = FonteLancamento.Manual;
    public string? Descricao { get; set; }

    /// <summary>RN32 — estorno é vinculado ao lançamento original, nunca solto.</summary>
    public Guid? EstornoDeId { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public ContaBancaria ContaBancaria { get; set; } = null!;
    public Lancamento? EstornoDe { get; set; }
    public ICollection<Pagamento> Pagamentos { get; set; } = new List<Pagamento>();
}
