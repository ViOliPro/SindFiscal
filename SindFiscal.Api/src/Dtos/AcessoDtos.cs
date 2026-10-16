using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

// ---------------------------------------------------------------- Gestão de acessos (RF03)

/// <summary>Visão geral da tela "Gestão de Acessos".</summary>
public record AcessoResumoResponse(
    int TotalColaboradores,
    int TotalCondominios,
    int SemAcesso,
    IReadOnlyList<AcessoColaboradorResumo> Colaboradores
);

/// <summary>CondominiosComAcesso = quantidade de condomínios ativos com pelo menos 1 módulo concedido.</summary>
public record AcessoColaboradorResumo(
    Guid UsuarioId,
    string Nome,
    string Email,
    PapelUsuario Papel,
    bool Ativo,
    int CondominiosComAcesso
);

public record CondominioResumoResponse(Guid Id, string Nome);

public record AcessoPermissaoItem(Guid CondominioId, string Modulo, NivelPermissao Nivel);

/// <summary>Tudo que a matriz de um colaborador precisa: condomínios ativos do síndico + permissões atuais.</summary>
public record AcessoUsuarioResponse(
    UsuarioResponse Usuario,
    IReadOnlyList<CondominioResumoResponse> Condominios,
    IReadOnlyList<AcessoPermissaoItem> Permissoes
);

/// <summary>Nivel = null remove a permissão (sem acesso ao módulo naquele condomínio).</summary>
public record AlteracaoAcesso(Guid CondominioId, string Modulo, NivelPermissao? Nivel);

public record SalvarAcessosRequest(IReadOnlyList<AlteracaoAcesso> Alteracoes);

// ---------------------------------------------------------------- Modelos de acesso

public record ModeloAcessoItemDto(string Modulo, NivelPermissao Nivel);

public record ModeloAcessoResponse(
    Guid Id,
    string Nome,
    string? Descricao,
    IReadOnlyList<ModeloAcessoItemDto> Itens
);

public record SalvarModeloAcessoRequest(
    string Nome,
    string? Descricao,
    IReadOnlyList<ModeloAcessoItemDto> Itens
);
