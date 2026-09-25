using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>
/// RF08, RN04 — fornecedor pertence ao síndico e é compartilhado entre todos
/// os condomínios dele. Não usa rota aninhada em /condominios/{id}.
/// </summary>
[ApiController]
[Route("api/fornecedores")]
public class FornecedorController : ControllerBase
{
    private readonly AppDbContext _db;

    public FornecedorController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FornecedorResponse>>> Listar(CancellationToken ct)
    {
        var usuarioId = HttpContext.UsuarioIdAutenticado();
        var usuario = await _db.Usuarios.FindAsync([usuarioId], ct);
        if (usuario is null)
            return Unauthorized();

        // Síndico: seus fornecedores. Colaborador/conselheiro: fornecedores do síndico
        // dos condomínios onde tem permissão no módulo.
        Guid sindicoId;
        if (usuario.Papel == PapelUsuario.Sindico)
            sindicoId = usuarioId;
        else
        {
            var condoIds = await _db
                .Permissoes.Where(p =>
                    p.UsuarioId == usuarioId && p.Modulo == Modulos.NecessidadesCotacoesFornecedores
                )
                .Select(p => p.CondominioId)
                .Distinct()
                .ToListAsync(ct);
            var sindico = await _db
                .Condominios.Where(c => condoIds.Contains(c.Id))
                .Select(c => (Guid?)c.SindicoId)
                .FirstOrDefaultAsync(ct);
            if (sindico is null)
                return Ok(Array.Empty<FornecedorResponse>());
            sindicoId = sindico.Value;
        }

        var lista = await _db
            .Fornecedores.Where(f => f.SindicoId == sindicoId)
            .OrderBy(f => f.Nome)
            .Select(f => new FornecedorResponse(
                f.Id,
                f.Nome,
                f.Categoria,
                f.AvaliacaoNota,
                f.AvaliacaoComentario
            ))
            .ToListAsync(ct);

        return Ok(lista);
    }

    [HttpPost]
    public async Task<ActionResult<FornecedorResponse>> Criar(
        CriarFornecedorRequest request,
        CancellationToken ct
    )
    {
        var usuarioId = HttpContext.UsuarioIdAutenticado();
        var usuario = await _db.Usuarios.FindAsync([usuarioId], ct);
        if (usuario is null)
            return Unauthorized();
        if (usuario.Papel != PapelUsuario.Sindico)
            return Forbid();

        var fornecedor = new Fornecedor
        {
            Id = Guid.NewGuid(),
            SindicoId = usuarioId,
            Nome = request.Nome.Trim(),
            Categoria = request.Categoria.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Fornecedores.Add(fornecedor);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(
            nameof(Listar),
            new FornecedorResponse(
                fornecedor.Id,
                fornecedor.Nome,
                fornecedor.Categoria,
                fornecedor.AvaliacaoNota,
                fornecedor.AvaliacaoComentario
            )
        );
    }

    [HttpPost("{fornecedorId:guid}/avaliar")]
    public async Task<ActionResult<FornecedorResponse>> Avaliar(
        Guid fornecedorId,
        AvaliarFornecedorRequest request,
        CancellationToken ct
    )
    {
        var usuarioId = HttpContext.UsuarioIdAutenticado();
        var usuario = await _db.Usuarios.FindAsync([usuarioId], ct);
        if (usuario is null)
            return Unauthorized();
        if (usuario.Papel != PapelUsuario.Sindico)
            return Forbid();

        if (request.Nota is < 1 or > 5)
            return BadRequest("Nota deve ser entre 1 e 5.");

        var fornecedor = await _db.Fornecedores.FirstOrDefaultAsync(
            f => f.Id == fornecedorId && f.SindicoId == usuarioId,
            ct
        );
        if (fornecedor is null)
            return NotFound();

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
}
