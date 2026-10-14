namespace SindFiscal.Dtos;

public record FornecedorResponse(
    Guid Id,
    string Nome,
    string Categoria,
    string? Telefone,
    string? Email,
    string? Observacoes,
    short? AvaliacaoNota,
    string? AvaliacaoComentario
);

public record CriarFornecedorRequest(
    string Nome,
    string Categoria,
    string? Telefone = null,
    string? Email = null,
    string? Observacoes = null
);

/// <summary>RF08 — estrelas (1 a 5) + comentário livre.</summary>
public record AvaliarFornecedorRequest(short Nota, string? Comentario);
