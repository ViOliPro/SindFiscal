using SindFiscal.Api.src.Enum;

namespace SindFiscal.Api.src.Entities;

/// <summary>
/// RF11, RN15, RN16, RN19 — FundoResponsavelId pode divergir da conta do
/// LancamentoId vinculado; essa divergência é o gatilho da área de acerto (RN19).
/// </summary>
public class Pagamento
{
    public Guid Id { get; set; }
    public Guid CompromissoId { get; set; }
    public Guid FundoResponsavelId { get; set; }

    /// <summary>0..1 — vínculo de reconciliação com o lançamento real correspondente.</summary>
    public Guid? LancamentoId { get; set; }

    public TipoPagamento Tipo { get; set; }
    public decimal Valor { get; set; }
    public DateOnly Data { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public CompromissoFinanceiro Compromisso { get; set; } = null!;
    public ContaBancaria FundoResponsavel { get; set; } = null!;
    public Lancamento? Lancamento { get; set; }
    public ICollection<TransferenciaPagamento> TransferenciasVinculadas { get; set; } = new List<TransferenciaPagamento>();
}
