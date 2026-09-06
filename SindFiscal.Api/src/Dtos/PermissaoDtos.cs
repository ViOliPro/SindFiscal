using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

public record PermissaoResponse(
    Guid Id,
    Guid UsuarioId,
    string UsuarioNome,
    Guid CondominioId,
    string Modulo,
    NivelPermissao Nivel
);

/// <summary>RF03 — concede/atualiza permissão de um colaborador em um módulo de um condomínio.</summary>
public record ConcederPermissaoRequest(Guid UsuarioId, string Modulo, NivelPermissao Nivel);
