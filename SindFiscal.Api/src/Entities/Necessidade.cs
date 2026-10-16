using SindFiscal.Data.Enums;

namespace SindFiscal.Entities;

/// <summary>RF06 — necessidade/previsão, com ciclo de vida único.</summary>
public class Necessidade
{
    public Guid Id { get; set; }
    public Guid CondominioId { get; set; }
    public Guid? ResponsavelId { get; set; }
    public string Descricao { get; set; } = null!;
    public string Categoria { get; set; } = null!;
    public Prioridade? Prioridade { get; set; }

    /// <summary>RN06 — escopo comum do serviço, para garantir comparação justa entre cotações.</summary>
    public string? EscopoTexto { get; set; }

    /// <summary>Planejamento — data prevista de execução (opcional).</summary>
    public DateOnly? DataPrevista { get; set; }

    /// <summary>Planejamento — fundo que deve custear a despesa (opcional).</summary>
    public Guid? FundoPrevistoId { get; set; }

    /// <summary>Planejamento — valor estimado quando ainda não há cotação (opcional).</summary>
    public decimal? ValorEstimado { get; set; }

    public SituacaoNecessidade Situacao { get; set; } = SituacaoNecessidade.EmAnalise;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public Condominio Condominio { get; set; } = null!;
    public Usuario? Responsavel { get; set; }
    public ICollection<Cotacao> Cotacoes { get; set; } = new List<Cotacao>();
    public ICollection<Decisao> Decisoes { get; set; } = new List<Decisao>();
    public ICollection<CompromissoFinanceiro> Compromissos { get; set; } = new List<CompromissoFinanceiro>();
}
