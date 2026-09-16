using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>
/// RF07, RN05, RN06 — cotações de uma necessidade, quantidade livre (1 a N),
/// com comparação automática entre elas (módulo 2).
/// </summary>
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
        CancellationToken ct
    )
    {
        var necessidadeExiste = await _db.Necessidades.AnyAsync(
            n => n.Id == necessidadeId && n.CondominioId == condominioId,
            ct
        );
        if (!necessidadeExiste)
            return NotFound("Necessidade não encontrada neste condomínio.");

        var cotacoes = await MapearResponse(
            _db.Cotacoes.Where(c => c.NecessidadeId == necessidadeId)
                .OrderBy(c => c.Valor)
        ).ToListAsync(ct);

        return Ok(cotacoes);
    }

    [HttpGet("{cotacaoId:guid}")]
    public async Task<ActionResult<CotacaoResponse>> ObterPorId(
        Guid condominioId,
        Guid necessidadeId,
        Guid cotacaoId,
        CancellationToken ct
    )
    {
        var cotacao = await MapearResponse(
            _db.Cotacoes.Where(c =>
                c.Id == cotacaoId
                && c.NecessidadeId == necessidadeId
                && c.Necessidade.CondominioId == condominioId
            )
        ).FirstOrDefaultAsync(ct);

        if (cotacao is null)
            return NotFound("Cotação não encontrada para esta necessidade.");

        return Ok(cotacao);
    }

    /// <summary>RF07, RN05 — comparação automática entre as cotações da necessidade.</summary>
    [HttpGet("comparativo")]
    public async Task<ActionResult<ComparativoCotacoesResponse>> Comparativo(
        Guid condominioId,
        Guid necessidadeId,
        CancellationToken ct
    )
    {
        var necessidadeExiste = await _db.Necessidades.AnyAsync(
            n => n.Id == necessidadeId && n.CondominioId == condominioId,
            ct
        );
        if (!necessidadeExiste)
            return NotFound("Necessidade não encontrada neste condomínio.");

        var cotacoes = await MapearResponse(
            _db.Cotacoes.Where(c => c.NecessidadeId == necessidadeId).OrderBy(c => c.Valor)
        ).ToListAsync(ct);

        if (cotacoes.Count == 0)
            return NotFound("Nenhuma cotação registrada para esta necessidade ainda.");

        var menor = cotacoes.Min(c => c.Valor);
        var maior = cotacoes.Max(c => c.Valor);
        var maisBarata = cotacoes.First(c => c.Valor == menor);

        return Ok(
            new ComparativoCotacoesResponse(
                necessidadeId,
                cotacoes,
                menor,
                maior,
                maior - menor,
                maisBarata.FornecedorId
            )
        );
    }

    /// <summary>
    /// RN05 — sem limite de quantidade por necessidade. RN06 exige que a
    /// necessidade já tenha um escopo comum registrado, para garantir
    /// comparação justa entre propostas.
    /// </summary>
    [HttpPost]
    [RequerPermissao(Modulos.NecessidadesCotacoesFornecedores, NivelPermissao.Editar)]
    public async Task<ActionResult<CotacaoResponse>> Registrar(
        Guid condominioId,
        Guid necessidadeId,
        RegistrarCotacaoRequest request,
        CancellationToken ct
    )
    {
        var necessidade = await _db.Necessidades.FirstOrDefaultAsync(
            n => n.Id == necessidadeId && n.CondominioId == condominioId,
            ct
        );
        if (necessidade is null)
            return NotFound("Necessidade não encontrada neste condomínio.");

        if (
            necessidade.Situacao
            is not (SituacaoNecessidade.EmAnalise or SituacaoNecessidade.EmOrcamento)
        )
            return Conflict("Necessidade já decidida — não é mais possível registrar cotações.");

        if (string.IsNullOrWhiteSpace(necessidade.EscopoTexto))
            return BadRequest(
                "Necessidade precisa de um escopo de serviço registrado antes da primeira cotação (RN06)."
            );

        if (request.Valor < 0)
            return BadRequest("Valor da cotação não pode ser negativo.");

        // RN04 — fornecedor é entidade do síndico, compartilhada entre seus
        // condomínios; garante que não veio um id de fornecedor de outro síndico.
        var condominio = await _db.Condominios.FirstOrDefaultAsync(
            c => c.Id == condominioId,
            ct
        );
        if (condominio is null)
            return NotFound("Condomínio não encontrado.");

        var fornecedor = await _db.Fornecedores.FirstOrDefaultAsync(
            f => f.Id == request.FornecedorId && f.SindicoId == condominio.SindicoId,
            ct
        );
        if (fornecedor is null)
            return BadRequest("Fornecedor informado não pertence a este síndico.");

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

        // RF06 — assim que a primeira cotação chega, a necessidade avança
        // de "em análise" para "em orçamento" no ciclo de vida único.
        if (necessidade.Situacao == SituacaoNecessidade.EmAnalise)
        {
            necessidade.Situacao = SituacaoNecessidade.EmOrcamento;
            necessidade.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(
            nameof(ObterPorId),
            new { condominioId, necessidadeId, cotacaoId = cotacao.Id },
            new CotacaoResponse(
                cotacao.Id,
                cotacao.NecessidadeId,
                cotacao.FornecedorId,
                fornecedor.Nome,
                cotacao.Valor,
                cotacao.PrazoExecucaoDias,
                cotacao.GarantiaDescricao,
                cotacao.CondicoesPagamento,
                cotacao.Validade
            )
        );
    }

    private static IQueryable<CotacaoResponse> MapearResponse(IQueryable<Cotacao> query) =>
        query.Select(c => new CotacaoResponse(
            c.Id,
            c.NecessidadeId,
            c.FornecedorId,
            c.Fornecedor.Nome,
            c.Valor,
            c.PrazoExecucaoDias,
            c.GarantiaDescricao,
            c.CondicoesPagamento,
            c.Validade
        ));
}
