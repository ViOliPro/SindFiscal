using SindFiscal.Data.Enums;

namespace SindFiscal.Entities;

/// <summary>
/// RF14, RN17–RN24 — item da área de acerto. Motivo distingue reposição,
/// aporte periódico e destinação de receita.
/// </summary>
public class Transferencia
{
    public Guid Id { get; set; }
    public Guid CondominioId { get; set; }
    public Guid ContaOrigemId { get; set; }
    public Guid ContaDestinoId { get; set; }
    public decimal Valor { get; set; }

    /// <summary>RN17 — total (consolidado) ou individual. Padrão: individual.</summary>
    public TipoTransferencia Tipo { get; set; } = TipoTransferencia.Individual;

    /// <summary>RN18 — automática (via integração) ou checklist manual.</summary>
    public ModoTransferencia Modo { get; set; } = ModoTransferencia.ChecklistManual;

    public OrigemTransferencia Origem { get; set; } = OrigemTransferencia.SugeridaPeloSistema;

    /// <summary>RF14 (a) reposição, (b) aporte, (c) destinação de receita.</summary>
    public MotivoTransferencia Motivo { get; set; }

    /// <summary>RN24 — sem_ajuste | pendente | ajustado.</summary>
    public StatusTransferencia Status { get; set; } = StatusTransferencia.Pendente;

    public DateOnly? DataExecucao { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public Condominio Condominio { get; set; } = null!;
    public ContaBancaria ContaOrigem { get; set; } = null!;
    public ContaBancaria ContaDestino { get; set; } = null!;

    /// <summary>RN17 — pagamentos de reposição consolidados neste item (quando Motivo = Reposicao).</summary>
    public ICollection<TransferenciaPagamento> Pagamentos { get; set; } = new List<TransferenciaPagamento>();

    /// <summary>RN23 — reservas do período consolidadas neste item (quando Motivo = DestinacaoReceita).</summary>
    public ICollection<TransferenciaReserva> Reservas { get; set; } = new List<TransferenciaReserva>();
}
