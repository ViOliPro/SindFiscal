using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>
/// RF08, RN04 — fornecedor é entidade do síndico, compartilhada entre todos
/// os condomínios que ele administra — nunca isolada por condomínio. Por
/// isso este controller, diferente da maioria, NÃO usa
/// [RequerPermissao(Modulos.X)] (que exige {condominioId} na rota): a
/// checagem de acesso é feita inline, resolvendo a qual síndico o usuário
/// autenticado pertence (como síndico dono, ou como colaborador/conselheiro
/// com permissão de módulo 2 em algum condomínio daquele síndico).
/// </summary>
[ApiController]
[Route("api/fornecedores")]
public class FornecedorController : ControllerBase
{
    private readonly AppDbContext _db;

    public FornecedorController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FornecedorResponse>>> Listar(
        [FromQuery] string? categoria,
        CancellationToken ct
    )
    {
        var acesso = await ResolverAcesso(NivelPermissao.Visualizar, ct);
        if (acesso is null)
            return Forbid();

        var query = _db.Fornecedores.Where(f => f.SindicoId == acesso.Value.SindicoId);
        if (!string.IsNullOrWhiteSpace(categoria))
            query = query.Where(f => f.Categoria == categoria);

        var fornecedores = await query
            .OrderBy(f => f.Nome)
            .Select(f => new FornecedorResponse(
                f.Id,
                f.Nome,
                f.Categoria,
                f.AvaliacaoNota,
                f.AvaliacaoComentario
            ))
            .ToListAsync(ct);

        return Ok(fornecedores);
    }

    [HttpGet("{fornecedorId:guid}")]
    public async Task<ActionResult<FornecedorResponse>> ObterPorId(
        Guid fornecedorId,
        CancellationToken ct
    )
    {
        var acesso = await ResolverAcesso(NivelPermissao.Visualizar, ct);
        if (acesso is null)
            return Forbid();

        var fornecedor = await _db.Fornecedores.FirstOrDefaultAsync(
            f => f.Id == fornecedorId && f.SindicoId == acesso.Value.SindicoId,
            ct
        );
        if (fornecedor is null)
            return NotFound("Fornecedor não encontrado para este síndico.");

        return Ok(
            new FornecedorResponse(
                fornecedor.Id,
                fornecedor.Nome,
                fornecedor.Categoria,
                fornecedor.AvaliacaoNota,
                fornecedor.AvaliacaoComentario
            )
        );
    }

    /// <summary>RF08 — cadastro compartilhado entre todos os condomínios do síndico (RN04).</summary>
    [HttpPost]
    public async Task<ActionResult<FornecedorResponse>> Criar(
        CriarFornecedorRequest request,
        CancellationToken ct
    )
    {
        var acesso = await ResolverAcesso(NivelPermissao.Editar, ct);
        if (acesso is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest("Nome é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.Categoria))
            return BadRequest("Categoria é obrigatória.");

        var jaExiste = await _db.Fornecedores.AnyAsync(
            f =>
                f.SindicoId == acesso.Value.SindicoId
                && f.Nome.ToLower() == request.Nome.Trim().ToLower(),
            ct
        );
        if (jaExiste)
            return Conflict("Já existe um fornecedor com este nome cadastrado para este síndico.");

        var fornecedor = new Fornecedor
        {
            Id = Guid.NewGuid(),
            SindicoId = acesso.Value.SindicoId,
            Nome = request.Nome.Trim(),
            Categoria = request.Categoria.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Fornecedores.Add(fornecedor);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(
            nameof(ObterPorId),
            new { fornecedorId = fornecedor.Id },
            new FornecedorResponse(
                fornecedor.Id,
                fornecedor.Nome,
                fornecedor.Categoria,
                fornecedor.AvaliacaoNota,
                fornecedor.AvaliacaoComentario
            )
        );
    }

    /// <summary>Atualização cadastral simples — não altera avaliação (use o endpoint de avaliar).</summary>
    [HttpPut("{fornecedorId:guid}")]
    public async Task<ActionResult<FornecedorResponse>> Atualizar(
        Guid fornecedorId,
        AtualizarFornecedorRequest request,
        CancellationToken ct
    )
    {
        var acesso = await ResolverAcesso(NivelPermissao.Editar, ct);
        if (acesso is null)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Nome))
            return BadRequest("Nome é obrigatório.");
        if (string.IsNullOrWhiteSpace(request.Categoria))
            return BadRequest("Categoria é obrigatória.");

        var fornecedor = await _db.Fornecedores.FirstOrDefaultAsync(
            f => f.Id == fornecedorId && f.SindicoId == acesso.Value.SindicoId,
            ct
        );
        if (fornecedor is null)
            return NotFound("Fornecedor não encontrado para este síndico.");

        fornecedor.Nome = request.Nome.Trim();
        fornecedor.Categoria = request.Categoria.Trim();
        fornecedor.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(
            new FornecedorResponse(
                fornecedor.Id,
                fornecedor.Nome,
                fornecedor.Categoria,
                fornecedor.AvaliacaoNota,
                fornecedor.AvaliacaoComentario
            )
        );
    }

    /// <summary>RF08 — avaliação em estrelas (1 a 5) + comentário livre.</summary>
    [HttpPost("{fornecedorId:guid}/avaliar")]
    public async Task<ActionResult<FornecedorResponse>> Avaliar(
        Guid fornecedorId,
        AvaliarFornecedorRequest request,
        CancellationToken ct
    )
    {
        var acesso = await ResolverAcesso(NivelPermissao.Editar, ct);
        if (acesso is null)
            return Forbid();

        if (request.Nota is < 1 or > 5)
            return BadRequest("Nota deve estar entre 1 e 5.");

        var fornecedor = await _db.Fornecedores.FirstOrDefaultAsync(
            f => f.Id == fornecedorId && f.SindicoId == acesso.Value.SindicoId,
            ct
        );
        if (fornecedor is null)
            return NotFound("Fornecedor não encontrado para este síndico.");

        fornecedor.AvaliacaoNota = request.Nota;
        fornecedor.AvaliacaoComentario = request.Comentario;
        fornecedor.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(
            new FornecedorResponse(
                fornecedor.Id,
                fornecedor.Nome,
                fornecedor.Categoria,
                fornecedor.AvaliacaoNota,
                fornecedor.AvaliacaoComentario
            )
        );
    }

    /// <summary>
    /// Resolve, para o usuário autenticado, a qual síndico o cadastro de
    /// fornecedores pertence e se ele tem o nível de permissão exigido no
    /// módulo 2 (necessidades_cotacoes_fornecedores). Síndico tem acesso
    /// pleno aos próprios fornecedores sem precisar de linha em Permissao
    /// (mesma regra usada em [RequerPermissaoAttribute]); colaborador e
    /// conselheiro fiscal dependem de ao menos uma Permissao de módulo 2 em
    /// algum condomínio do síndico.
    /// </summary>
    private async Task<(Guid SindicoId, NivelPermissao Nivel)?> ResolverAcesso(
        NivelPermissao nivelMinimo,
        CancellationToken ct
    )
    {
        var usuarioId = HttpContext.UsuarioIdAutenticadoOuNulo();
        if (usuarioId is null)
            return null;

        var usuario = await _db.Usuarios.FindAsync(new object[] { usuarioId.Value }, ct);
        if (usuario is null || !usuario.Ativo)
            return null;

        if (usuario.Papel == PapelUsuario.Sindico)
            return (usuario.Id, NivelPermissao.Editar);

        var permissao = await _db
            .Permissoes.Where(p =>
                p.UsuarioId == usuario.Id && p.Modulo == Modulos.NecessidadesCotacoesFornecedores
            )
            .OrderByDescending(p => p.Nivel)
            .Include(p => p.Condominio)
            .FirstOrDefaultAsync(ct);

        if (permissao is null || (int)permissao.Nivel < (int)nivelMinimo)
            return null;

        return (permissao.Condominio.SindicoId, permissao.Nivel);
    }
}
