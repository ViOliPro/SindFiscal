using SindFiscal.Data.Enums;

namespace SindFiscal.Entities;

/// <summary>RF04, RN20, RN21, RN27 — conta bancária/fundo, com regra de aporte opcional.</summary>
public class ContaBancaria
{
    public Guid Id { get; set; }
    public Guid CondominioId { get; set; }
    public string Nome { get; set; } = null!;
    public FinalidadeConta Finalidade { get; set; }

    /// <summary>Marca a conta física que a administradora efetivamente movimenta (RF04).
    /// No máximo uma por condomínio (garantido por índice único parcial no banco).</summary>
    public bool EhContaOperacional { get; set; }

    /// <summary>Regra de aporte periódico opcional (RN20). Ambos nulos ou ambos preenchidos.</summary>
    public TipoRegraAporte? RegraAporteTipo { get; set; }
    public decimal? RegraAporteValor { get; set; }
    public decimal? TetoMaximo { get; set; }

    public decimal SaldoAtual { get; set; }

    /// <summary>Saldo acumulado de aporte pendente quando um aporte é adiado (RN21).</summary>
    public decimal AportePendenteAcumulado { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public Condominio Condominio { get; set; } = null!;
    public ICollection<Lancamento> Lancamentos { get; set; } = new List<Lancamento>();
    public ICollection<Pagamento> PagamentosComoFundoResponsavel { get; set; } = new List<Pagamento>();
    public ICollection<Reserva> ReservasComoFundoDestino { get; set; } = new List<Reserva>();
}
