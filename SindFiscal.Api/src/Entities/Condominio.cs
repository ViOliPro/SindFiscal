namespace SindFiscal.Entities;

/// <summary>RF02 — condomínio administrado por um síndico (RN03).</summary>
public class Condominio
{
    public Guid Id { get; set; }
    public Guid SindicoId { get; set; }
    public string Nome { get; set; } = null!;
    public bool PossuiIntegracaoApi { get; set; }

    /// <summary>
    /// RF10, RN07 — valor de alçada a partir do qual um compromisso exigiria
    /// validação do Conselho Fiscal. Configurável por condomínio (não há
    /// padrão único). Null = sem alçada definida para este condomínio.
    /// Nesta fase o sistema apenas sinaliza (RequerValidacaoConselho no
    /// CompromissoFinanceiroResponse); a formalização de um fluxo de
    /// aprovação pelo Conselho foi deliberadamente adiada (Seção 11).
    /// </summary>
    public decimal? ValorAlcadaAprovacao { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public Usuario Sindico { get; set; } = null!;
    public ConfiguracaoIntegracao? ConfiguracaoIntegracao { get; set; }
    public ICollection<ContaBancaria> ContasBancarias { get; set; } = new List<ContaBancaria>();
    public ICollection<Permissao> Permissoes { get; set; } = new List<Permissao>();
    public ICollection<Necessidade> Necessidades { get; set; } = new List<Necessidade>();
    public ICollection<CompromissoFinanceiro> Compromissos { get; set; } = new List<CompromissoFinanceiro>();
    public ICollection<Transferencia> Transferencias { get; set; } = new List<Transferencia>();
    public ICollection<Reserva> Reservas { get; set; } = new List<Reserva>();
}
