namespace SindFiscal.Dtos;

/// <summary>RF19, RNF14 — somente leitura; não existe DTO de escrita (a tabela é populada internamente pelo AuditoriaService, não por endpoint).</summary>
public record RegistroAuditoriaResponse(
    Guid Id,
    string EntidadeTipo,
    Guid EntidadeId,
    Guid UsuarioId,
    string UsuarioNome,
    DateTimeOffset DataHora,
    string CampoAlterado,
    string? ValorAnterior,
    string? ValorNovo
);
