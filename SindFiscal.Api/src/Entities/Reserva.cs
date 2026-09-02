namespace SindFiscal.Api.src.Entities;

/// <summary>
/// RF21, RN23 — reserva de área comum (ex.: espaço gourmet). Origem: lista que
/// a síndica levanta via CondoMob e repassa à administradora. O valor destinado
/// ao fundo NÃO muda em função do desconto de pontualidade (RN23).
/// </summary>
public class Reserva
{
    public Guid Id { get; set; }
    public Guid CondominioId { get; set; }
    public Guid FundoDestinoId { get; set; }
    public string Unidade { get; set; } = null!;
    public string MoradorNome { get; set; } = null!;
    public decimal ValorDestinadoAoFundo { get; set; }

    /// <summary>Apenas informativo (RN23) — não afeta ValorDestinadoAoFundo.</summary>
    public bool? PagoComDesconto { get; set; }

    /// <summary>Mês/ano de referência da reserva (usado para agrupar itens de destinação de receita).</summary>
    public DateOnly PeriodoReferencia { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public Condominio Condominio { get; set; } = null!;
    public ContaBancaria FundoDestino { get; set; } = null!;
    public ICollection<TransferenciaReserva> TransferenciasVinculadas { get; set; } = new List<TransferenciaReserva>();
}
