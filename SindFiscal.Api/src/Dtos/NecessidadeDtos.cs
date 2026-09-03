using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

public record NecessidadeResponse(
    Guid Id,
    string Descricao,
    string Categoria,
    Prioridade? Prioridade,
    string? EscopoTexto,
    SituacaoNecessidade Situacao,
    Guid? ResponsavelId
);

public record CriarNecessidadeRequest(
    string Descricao,
    string Categoria,
    Prioridade? Prioridade,
    string? EscopoTexto,
    Guid? ResponsavelId
);

public record AtualizarSituacaoNecessidadeRequest(SituacaoNecessidade Situacao);
