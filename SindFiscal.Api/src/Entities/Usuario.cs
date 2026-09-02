using SindFiscal.Data.Enums;

namespace SindFiscal.Entities;

/// <summary>RF01, RF03 — síndico, colaboradores e conselheiros fiscais (RN29, RN30).</summary>
public class Usuario
{
    public Guid Id { get; set; }
    public string Nome { get; set; } = null!;
    public string Email { get; set; } = null!;
    public PapelUsuario Papel { get; set; }
    public bool Ativo { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public ICollection<Condominio> CondominiosAdministrados { get; set; } = new List<Condominio>();
    public ICollection<Permissao> Permissoes { get; set; } = new List<Permissao>();
    public ICollection<Fornecedor> FornecedoresCadastrados { get; set; } = new List<Fornecedor>();
}
