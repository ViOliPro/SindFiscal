using SindFiscal.Data.Enums;

namespace SindFiscal.Entities;

/// <summary>RF03 — um módulo + nível dentro de um modelo de acesso. Módulo ausente = sem acesso.</summary>
public class ModeloAcessoItem
{
    public Guid Id { get; set; }
    public Guid ModeloAcessoId { get; set; }
    public string Modulo { get; set; } = null!;
    public NivelPermissao Nivel { get; set; }

    // Navegação
    public ModeloAcesso ModeloAcesso { get; set; } = null!;
}
