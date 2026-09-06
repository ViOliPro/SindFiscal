using SindFiscal.Data.Enums;

namespace SindFiscal.Entities;

/// <summary>
/// RF10, RF12, RF13, RN07, RN11–RN14 — compromisso financeiro. Pode ter
/// compromissos "filhos" vinculados via CompromissoPaiId (auto-relação).
/// </summary>
public class CompromissoFinanceiro
{
    public Guid Id { get; set; }
    public Guid CondominioId { get; set; }

    /// <summary>0..1 — pode ser avulso, sem necessidade formal (RN15).</summary>
    public Guid? NecessidadeId { get; set; }

    /// <summary>0..1 — gasto vinculado a um compromisso "pai" (RF12, RN13, RN14).</summary>
    public Guid? CompromissoPaiId { get; set; }

    public string Categoria { get; set; } = null!;
    public decimal ValorAprovado { get; set; }
    public StatusCompromisso Status { get; set; } = StatusCompromisso.AguardandoExecucao;

    /// <summary>Posição manual na fila de execução (RF13). Sem critério automático (RN11).</summary>
    public int? PrioridadeFila { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public Condominio Condominio { get; set; } = null!;
    public Necessidade? Necessidade { get; set; }
    public CompromissoFinanceiro? CompromissoPai { get; set; }
    public ICollection<CompromissoFinanceiro> GastosVinculados { get; set; } = new List<CompromissoFinanceiro>();
    public ICollection<Pagamento> Pagamentos { get; set; } = new List<Pagamento>();

    /// <summary>Soma efetiva dos gastos filhos vinculados (RN14) — calculada em runtime, não persistida.</summary>
    public decimal TotalGastosVinculados => GastosVinculados.Sum(g => g.ValorAprovado);
}
