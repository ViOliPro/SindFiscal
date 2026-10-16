using SindFiscal.Data.Enums;

namespace SindFiscal.Entities;

/// <summary>
/// RF14, RN20, RN22 — receita ou transferência mensal recorrente que gera,
/// a cada período, um item pendente na área de acerto (ex.: receita de antena
/// que pertence ao fundo de melhorias; depósito mensal ao fundo de trabalho).
/// Mensal apenas, nesta fase. Nunca é apagada: fica inativa (histórico e auditoria).
/// Motivo só pode ser Aporte ou DestinacaoReceita — reposição nasce de pagamento (RN19).
/// </summary>
public class ReceitaRecorrente
{
    public Guid Id { get; set; }
    public Guid CondominioId { get; set; }
    public string Descricao { get; set; } = null!;
    public decimal Valor { get; set; }
    public Guid ContaOrigemId { get; set; }
    public Guid ContaDestinoId { get; set; }
    public MotivoTransferencia Motivo { get; set; }

    /// <summary>Primeira competência em que a recorrência vale (qualquer dia do mês).</summary>
    public DateOnly DataInicio { get; set; }

    /// <summary>Última competência em que vale (inclusive). Nula = sem fim.</summary>
    public DateOnly? DataFim { get; set; }

    public bool Ativa { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public Condominio Condominio { get; set; } = null!;
    public ContaBancaria ContaOrigem { get; set; } = null!;
    public ContaBancaria ContaDestino { get; set; } = null!;
}
