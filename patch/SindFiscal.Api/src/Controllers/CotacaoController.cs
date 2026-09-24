using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>RF07, RN05 — 1..N cotações por necessidade + comparativo.</summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/necessidades/{necessidadeId:guid}/cotacoes")]
[RequerPermissao(Modulos.NecessidadesCotacoesFornecedores)]
public class CotacaoController : ControllerBase
{
    private readonly AppDbContext _db;

    public CotacaoController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CotacaoResponse>>> Listar(
        Guid condominioId,
        Guid necessidadeId,
        CancellationToken ct)
    {
        var pertence = await _db.Necessidades
            .AnyAsync(n => n.Id == necessidadeId && n.CondominioId == condominioId, ct);
        if (!pertence) return NotFound("Necessidade não encontrada neste condomínio.");

        var lista = await _db.Cotacoes
            .Where(c => c.NecessidadeId == necessidadeId)
            .Include(c => c.Fornecedor)
            .OrderBy(c => c.Valor)
            .Select(c => new CotacaoResponse(
                c.Id,
                c.NecessidadeId,
                c.FornecedorId,
                c.Fornecedor.Nome,
                c.Valor,
                c.PrazoExecucaoDias,
                c.GarantiaDescricao,
                c.CondicoesPagamento,
                c.Validade))
            .ToListAsync(ct);

        return Ok(lista);
    }

    [HttpGet("comparativo")]
    public async Task<ActionResult<ComparativoCotacoesResponse>> Comparativo(
        Guid condominioId,
        Guid necessidadeId,
        CancellationToken ct)
    {
        var pertence = await _db.Necessidades
            .AnyAsync(n => n.Id == necessidadeId && n.CondominioId == condominioId, ct);
        if (!pertence) return NotFound("Necessidade não encontrada neste condomínio.");

        var cotacoes = await _db.Cotacoes
            .Where(c => c.NecessidadeId == necessidadeId)
            .Include(c => c.Fornecedor)
            .OrderBy(c => c.Valor)
            .Select(c => new CotacaoResponse(
                c.Id,
                c.NecessidadeId,
                c.FornecedorId,
                c.Fornecedor.Nome,
                c.Valor,
                c.PrazoExecucaoDias,
                c.GarantiaDescricao,
                c.CondicoesPagamento,
                c.Validade))
            .ToListAsync(ct);

        if (cotacoes.Count == 0)
            return Ok(new ComparativoCotacoesResponse(
                necessidadeId, cotacoes, 0, 0, 0, Guid.Empty));

        var menor = cotacoes.Min(c => c.Valor);
        var maior = cotacoes.Max(c => c.Valor);
        var maisBarato = cotacoes.OrderBy(c => c.Valor).First();

        return Ok(new ComparativoCotacoesResponse(
            necessidadeId,
            cotacoes,
            menor,
            maior,
            maior - menor,
            maisBarato.FornecedorId));
    }

    [HttpPost]
    [RequerPermissao(Modulos.NecessidadesCotacoesFornecedores, NivelPermissao.Editar)]
    public async Task<ActionResult<CotacaoResponse>> Registrar(
        Guid condominioId,
        Guid necessidadeId,
        RegistrarCotacaoRequest request,
        CancellationToken ct)
    {
        var necessidade = await _db.Necessidades
            .FirstOrDefaultAsync(n => n.Id == necessidadeId && n.CondominioId == condominioId, ct);
        if (necessidade is null) return NotFound("Necessidade não encontrada neste condomínio.");

        var fornecedorExiste = await _db.Fornecedores.AnyAsync(f => f.Id == request.FornecedorId, ct);
        if (!fornecedorExiste) return BadRequest("Fornecedor não encontrado.");

        if (request.Valor <= 0)
            return BadRequest("Valor da cotação deve ser positivo.");

        var cotacao = new Cotacao
        {
            Id = Guid.NewGuid(),
            NecessidadeId = necessidadeId,
            FornecedorId = request.FornecedorId,
            Valor = request.Valor,
            PrazoExecucaoDias = request.PrazoExecucaoDias,
            GarantiaDescricao = request.GarantiaDescricao,
            CondicoesPagamento = request.CondicoesPagamento,
            Validade = request.Validade,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Cotacoes.Add(cotacao);

        // Avança ciclo de vida para EmOrcamento se ainda em análise
        if (necessidade.Situacao == SituacaoNecessidade.EmAnalise)
        {
            necessidade.Situacao = SituacaoNecessidade.EmOrcamento;
            necessidade.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        var fornecedorNome = await _db.Fornecedores
            .Where(f => f.Id == request.FornecedorId)
            .Select(f => f.Nome)
            .FirstAsync(ct);

        return CreatedAtAction(
            nameof(Listar),
            new { condominioId, necessidadeId },
            new CotacaoResponse(
                cotacao.Id,
                cotacao.NecessidadeId,
                cotacao.FornecedorId,
                fornecedorNome,
                cotacao.Valor,
                cotacao.PrazoExecucaoDias,
                cotacao.GarantiaDescricao,
                cotacao.CondicoesPagamento,
                cotacao.Validade));
    }
}
