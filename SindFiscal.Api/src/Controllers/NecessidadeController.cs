using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>RF06 — ciclo de vida da necessidade (em_analise → … → executado).</summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/necessidades")]
[RequerPermissao(Modulos.NecessidadesCotacoesFornecedores)]
public class NecessidadeController : ControllerBase
{
    private readonly AppDbContext _db;

    public NecessidadeController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NecessidadeResponse>>> Listar(
        Guid condominioId,
        [FromQuery] SituacaoNecessidade? situacao,
        CancellationToken ct)
    {
        var query = _db.Necessidades.Where(n => n.CondominioId == condominioId);
        if (situacao is not null)
            query = query.Where(n => n.Situacao == situacao);

        var lista = await query
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => new NecessidadeResponse(
                n.Id,
                n.Descricao,
                n.Categoria,
                n.Prioridade,
                n.EscopoTexto,
                n.Situacao,
                n.ResponsavelId))
            .ToListAsync(ct);

        return Ok(lista);
    }

    [HttpGet("{necessidadeId:guid}")]
    public async Task<ActionResult<NecessidadeResponse>> Detalhar(
        Guid condominioId,
        Guid necessidadeId,
        CancellationToken ct)
    {
        var n = await _db.Necessidades
            .FirstOrDefaultAsync(x => x.Id == necessidadeId && x.CondominioId == condominioId, ct);
        if (n is null) return NotFound();

        return Ok(new NecessidadeResponse(
            n.Id, n.Descricao, n.Categoria, n.Prioridade, n.EscopoTexto, n.Situacao, n.ResponsavelId));
    }

    [HttpPost]
    [RequerPermissao(Modulos.NecessidadesCotacoesFornecedores, NivelPermissao.Editar)]
    public async Task<ActionResult<NecessidadeResponse>> Criar(
        Guid condominioId,
        CriarNecessidadeRequest request,
        CancellationToken ct)
    {
        var existeCondo = await _db.Condominios.AnyAsync(c => c.Id == condominioId, ct);
        if (!existeCondo) return NotFound("Condomínio não encontrado.");

        var necessidade = new Necessidade
        {
            Id = Guid.NewGuid(),
            CondominioId = condominioId,
            Descricao = request.Descricao.Trim(),
            Categoria = request.Categoria.Trim(),
            Prioridade = request.Prioridade,
            EscopoTexto = request.EscopoTexto,
            ResponsavelId = request.ResponsavelId,
            Situacao = SituacaoNecessidade.EmAnalise,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Necessidades.Add(necessidade);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(
            nameof(Detalhar),
            new { condominioId, necessidadeId = necessidade.Id },
            new NecessidadeResponse(
                necessidade.Id,
                necessidade.Descricao,
                necessidade.Categoria,
                necessidade.Prioridade,
                necessidade.EscopoTexto,
                necessidade.Situacao,
                necessidade.ResponsavelId));
    }

    [HttpPatch("{necessidadeId:guid}/situacao")]
    [RequerPermissao(Modulos.NecessidadesCotacoesFornecedores, NivelPermissao.Editar)]
    public async Task<ActionResult<NecessidadeResponse>> AtualizarSituacao(
        Guid condominioId,
        Guid necessidadeId,
        AtualizarSituacaoNecessidadeRequest request,
        CancellationToken ct)
    {
        var n = await _db.Necessidades
            .FirstOrDefaultAsync(x => x.Id == necessidadeId && x.CondominioId == condominioId, ct);
        if (n is null) return NotFound();

        n.Situacao = request.Situacao;
        n.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Ok(new NecessidadeResponse(
            n.Id, n.Descricao, n.Categoria, n.Prioridade, n.EscopoTexto, n.Situacao, n.ResponsavelId));
    }
}
