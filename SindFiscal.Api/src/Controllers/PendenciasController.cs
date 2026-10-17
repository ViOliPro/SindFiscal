using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Services;

namespace SindFiscal.Controllers;

/// <summary>
/// RF17 — pendências de consistência (leitura no módulo Dashboard e Relatórios).
/// Dispensar/reativar a conciliação de uma saída altera o lançamento e exige
/// edição de Contas e Lançamentos; fica registrado na auditoria (RF19).
/// </summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/pendencias")]
public class PendenciasController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PendenciasService _pendencias;

    public PendenciasController(AppDbContext db, PendenciasService pendencias)
    {
        _db = db;
        _pendencias = pendencias;
    }

    [HttpGet]
    [RequerPermissao(Modulos.DashboardRelatorios)]
    public async Task<ActionResult<PendenciasResponse>> Listar(
        Guid condominioId,
        [FromQuery] DateOnly? desde,
        CancellationToken ct
    ) => Ok(await _pendencias.ListarAsync(condominioId, desde, ct));

    /// <summary>Marca uma saída como "não precisa de pagamento vinculado" (ex.: despesa ordinária da administradora, RN25).</summary>
    [HttpPost("lancamentos/{lancamentoId:guid}/dispensar")]
    [RequerPermissao(Modulos.ContasLancamentos, NivelPermissao.Editar)]
    public async Task<IActionResult> Dispensar(
        Guid condominioId,
        Guid lancamentoId,
        DispensarConciliacaoRequest request,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(request.Motivo) || request.Motivo.Trim().Length > 200)
            return BadRequest("Informe o motivo (até 200 caracteres).");

        var lancamento = await _db
            .Lancamentos.Include(l => l.ContaBancaria)
            .FirstOrDefaultAsync(l => l.Id == lancamentoId, ct);
        if (lancamento is null || lancamento.ContaBancaria.CondominioId != condominioId)
            return NotFound("Lançamento não encontrado.");
        if (lancamento.Tipo != TipoLancamento.Saida || lancamento.Origem != OrigemLancamento.Real)
            return BadRequest("Só saídas reais podem ser dispensadas da conciliação.");

        lancamento.ConciliacaoDispensada = true;
        lancamento.MotivoDispensa = request.Motivo.Trim();
        lancamento.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("lancamentos/{lancamentoId:guid}/reativar")]
    [RequerPermissao(Modulos.ContasLancamentos, NivelPermissao.Editar)]
    public async Task<IActionResult> Reativar(
        Guid condominioId,
        Guid lancamentoId,
        CancellationToken ct
    )
    {
        var lancamento = await _db
            .Lancamentos.Include(l => l.ContaBancaria)
            .FirstOrDefaultAsync(l => l.Id == lancamentoId, ct);
        if (lancamento is null || lancamento.ContaBancaria.CondominioId != condominioId)
            return NotFound("Lançamento não encontrado.");

        lancamento.ConciliacaoDispensada = false;
        lancamento.MotivoDispensa = null;
        lancamento.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
