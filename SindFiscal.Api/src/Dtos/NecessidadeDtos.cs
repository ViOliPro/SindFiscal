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

/// <summary>
/// Atualização dos dados de escopo/descrição de uma necessidade — permitida
/// apenas enquanto ela ainda não tiver sido decidida (RN09: pós-decisão, toda
/// mudança de escopo deve virar novo registro de decisão, não edição direta).
/// </summary>
public record AtualizarNecessidadeRequest(
    string Descricao,
    string Categoria,
    Prioridade? Prioridade,
    string? EscopoTexto,
    Guid? ResponsavelId
);
