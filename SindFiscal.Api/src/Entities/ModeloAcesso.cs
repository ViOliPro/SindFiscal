namespace SindFiscal.Entities;

/// <summary>
/// RF03 — modelo (perfil) de acesso reutilizável, ex.: Consulta, Operacional, Gestor.
/// É só um "molde": ao aplicar o modelo em um colaborador/condomínio, os itens são
/// COPIADOS para a tabela permissao (que continua sendo a fonte de verdade da checagem
/// de acesso). Editar ou excluir um modelo não altera permissões já concedidas.
/// </summary>
public class ModeloAcesso
{
    public Guid Id { get; set; }
    public Guid SindicoId { get; set; }
    public string Nome { get; set; } = null!;
    public string? Descricao { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    // Navegação
    public Usuario Sindico { get; set; } = null!;
    public ICollection<ModeloAcessoItem> Itens { get; set; } = new List<ModeloAcessoItem>();
}
