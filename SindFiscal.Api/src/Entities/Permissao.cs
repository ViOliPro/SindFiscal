using SindFiscal.Api.src.Enum;

namespace SindFiscal.Api.src.Entities;

/// <summary>RF03 — permissão granular por usuário/condomínio/módulo (RN29).</summary>
public class Permissao
{
    public Guid Id { get; set; }
    public Guid UsuarioId { get; set; }
    public Guid CondominioId { get; set; }

    /// <summary>Um dos 11 módulos definidos na Especificação (Requisitos Funcionais §1.1).</summary>
    public string Modulo { get; set; } = null!;

    public NivelPermissao Nivel { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public Usuario Usuario { get; set; } = null!;
    public Condominio Condominio { get; set; } = null!;
}
