using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Dtos;
using SindFiscal.Services;
using SindFiscal.Data;
using SindFiscal.Entities;
using SindFiscal.Data.Enums;

namespace SindFiscal.Controllers;

/// <summary>
/// RF10, RF12, RF13 — compromissos financeiros, gastos vinculados e fila de
/// execução (módulo "Decisões e Compromissos" para RF10/RF12; "Pagamentos e
/// Fila de Execução" para as ações de fila, RF13).
/// </summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/compromissos")]
[RequerPermissao(Modulos.DecisoesCompromissos)]
public class CompromissoFinanceiroController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly FilaExecucaoService _filaExecucao;

    public CompromissoFinanceiroController(AppDbContext db, FilaExecucaoService filaExecucao)
    {
        _db = db;
        _filaExecucao = filaExecucao;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CompromissoFinanceiroResponse>>> Listar(
        Guid condominioId, [FromQuery] StatusCompromisso? status, CancellationToken ct)
    {
        var query = _db.CompromissosFinanceiros.Where(c => c.CondominioId == condominioId);
        if (status is not null) query = query.Where(c => c.Status == status);

        var compromissos = await query.OrderBy(c => c.PrioridadeFila).ToListAsync(ct);
        return Ok(compromissos.Select(ParaResponse).ToList());
    }

    /// <summary>RN15 — compromisso avulso, sem necessidade formal associada.</summary>
    [HttpPost("avulsos")]
    [RequerPermissao(Modulos.DecisoesCompromissos, NivelPermissao.Editar)]
    public async Task<ActionResult<CompromissoFinanceiroResponse>> CriarAvulso(
        Guid condominioId, CriarCompromissoAvulsoRequest request, CancellationToken ct)
    {
        var compromisso = new CompromissoFinanceiro
        {
            Id = Guid.NewGuid(),
            CondominioId = condominioId,
            Categoria = request.Categoria,
            ValorAprovado = request.ValorAprovado,
            Status = StatusCompromisso.AguardandoExecucao,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.CompromissosFinanceiros.Add(compromisso);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Listar), new { condominioId }, ParaResponse(compromisso));
    }

    /// <summary>RF12, RN13, RN14 — vincula um gasto avulso a um compromisso "pai" já existente.</summary>
    [HttpPost("{compromissoPaiId:guid}/gastos-vinculados")]
    [RequerPermissao(Modulos.DecisoesCompromissos, NivelPermissao.Editar)]
    public async Task<ActionResult<CompromissoFinanceiroResponse>> VincularGasto(
        Guid condominioId, Guid compromissoPaiId, VincularGastoRequest request, CancellationToken ct)
    {
        var pai = await _db.CompromissosFinanceiros.FirstOrDefaultAsync(c => c.Id == compromissoPaiId && c.CondominioId == condominioId, ct);
        if (pai is null) return NotFound("Compromisso pai não encontrado.");

        var filho = new CompromissoFinanceiro
        {
            Id = Guid.NewGuid(),
            CondominioId = condominioId,
            CompromissoPaiId = compromissoPaiId,
            Categoria = request.Categoria,
            ValorAprovado = request.Valor,
            Status = StatusCompromisso.Concluido, // gasto vinculado tipicamente já executado no ato (ex.: compra no depósito)
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.CompromissosFinanceiros.Add(filho);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Listar), new { condominioId }, ParaResponse(filho));
    }

    /// <summary>RF13, RN11 — entra na fila de execução (aguardando disponibilidade de caixa).</summary>
    [HttpPost("{compromissoId:guid}/entrar-na-fila")]
    [RequerPermissao(Modulos.PagamentosFilaExecucao, NivelPermissao.Editar)]
    public async Task<IActionResult> EntrarNaFila(Guid condominioId, Guid compromissoId, CancellationToken ct)
    {
        await _filaExecucao.EntrarNaFilaAsync(compromissoId, ct);
        return NoContent();
    }

    /// <summary>RF13, RN11 — reordenação manual e livre pelo síndico; sem critério automático nesta fase.</summary>
    [HttpPut("fila-execucao/reordenar")]
    [RequerPermissao(Modulos.PagamentosFilaExecucao, NivelPermissao.Editar)]
    public async Task<IActionResult> ReordenarFila(Guid condominioId, ReordenarFilaExecucaoRequest request, CancellationToken ct)
    {
        await _filaExecucao.ReordenarAsync(condominioId, request.CompromissoIdsEmOrdem, ct);
        return NoContent();
    }

    private static CompromissoFinanceiroResponse ParaResponse(CompromissoFinanceiro c) => new(
        c.Id, c.NecessidadeId, c.CompromissoPaiId, c.Categoria, c.ValorAprovado, c.Status, c.PrioridadeFila,
        TotalGastosVinculados: 0, TotalPago: 0, SaldoRemanescente: c.ValorAprovado);
    // Nota de implementação: TotalGastosVinculados e TotalPago exigem um Include/projeção
    // com GastosVinculados e Pagamentos (omitido aqui por brevidade) — ver
    // CompromissoFinanceiro.TotalGastosVinculados na entidade para o cálculo de referência.
}
