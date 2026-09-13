using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>RF05 — lançamentos manuais (módulo contas_lancamentos).</summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/lancamentos")]
[RequerPermissao(Modulos.ContasLancamentos)]
public class LancamentoController : ControllerBase
{
    private readonly AppDbContext _db;

    public LancamentoController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<LancamentoResponse>>> Listar(
        Guid condominioId,
        [FromQuery] Guid? contaBancariaId,
        [FromQuery] DateOnly? de,
        [FromQuery] DateOnly? ate,
        CancellationToken ct)
    {
        var contaIds = await _db.ContasBancarias
            .Where(c => c.CondominioId == condominioId)
            .Select(c => c.Id)
            .ToListAsync(ct);

        var query = _db.Lancamentos
            .Where(l => contaIds.Contains(l.ContaBancariaId) && l.Origem == OrigemLancamento.Real);

        if (contaBancariaId is not null)
            query = query.Where(l => l.ContaBancariaId == contaBancariaId);
        if (de is not null)
            query = query.Where(l => l.Data >= de);
        if (ate is not null)
            query = query.Where(l => l.Data <= ate);

        var lista = await query.OrderByDescending(l => l.Data).ThenByDescending(l => l.CreatedAt)
            .Take(200).ToListAsync(ct);

        return Ok(lista.Select(ParaResponse).ToList());
    }

    [HttpPost]
    [RequerPermissao(Modulos.ContasLancamentos, NivelPermissao.Editar)]
    public async Task<ActionResult<LancamentoResponse>> RegistrarManual(
        Guid condominioId, RegistrarLancamentoManualRequest request, CancellationToken ct)
    {
        var conta = await _db.ContasBancarias.FirstOrDefaultAsync(
            c => c.Id == request.ContaBancariaId && c.CondominioId == condominioId, ct);
        if (conta is null) return NotFound(new { message = "Conta não encontrada neste condomínio." });

        if (request.Valor <= 0)
            return BadRequest(new { message = "Valor deve ser positivo." });

        var lancamento = new Lancamento
        {
            Id = Guid.NewGuid(),
            ContaBancariaId = request.ContaBancariaId,
            Data = request.Data,
            Tipo = request.Tipo,
            Valor = request.Valor,
            Origem = OrigemLancamento.Real,
            Fonte = FonteLancamento.Manual,
            Descricao = request.Descricao,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Lancamentos.Add(lancamento);

        if (request.Tipo == TipoLancamento.Entrada)
            conta.SaldoAtual += request.Valor;
        else
            conta.SaldoAtual -= request.Valor;
        conta.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Listar), new { condominioId }, ParaResponse(lancamento));
    }

    [HttpPost("{lancamentoId:guid}/estornar")]
    [RequerPermissao(Modulos.ContasLancamentos, NivelPermissao.Editar)]
    public async Task<ActionResult<LancamentoResponse>> Estornar(
        Guid condominioId, Guid lancamentoId, EstornarLancamentoRequest request, CancellationToken ct)
    {
        var original = await _db.Lancamentos
            .Include(l => l.ContaBancaria)
            .FirstOrDefaultAsync(l => l.Id == lancamentoId, ct);

        if (original is null || original.ContaBancaria.CondominioId != condominioId)
            return NotFound();
        if (original.EstornoDeId is not null)
            return BadRequest(new { message = "Não é possível estornar um estorno." });
        if (await _db.Lancamentos.AnyAsync(l => l.EstornoDeId == lancamentoId, ct))
            return Conflict(new { message = "Lançamento já possui estorno." });

        var tipoInverso = original.Tipo == TipoLancamento.Entrada
            ? TipoLancamento.Saida
            : TipoLancamento.Entrada;

        var estorno = new Lancamento
        {
            Id = Guid.NewGuid(),
            ContaBancariaId = original.ContaBancariaId,
            Data = DateOnly.FromDateTime(DateTime.UtcNow),
            Tipo = tipoInverso,
            Valor = original.Valor,
            Origem = OrigemLancamento.Real,
            Fonte = FonteLancamento.Manual,
            Descricao = $"Estorno: {request.Motivo}",
            EstornoDeId = original.Id,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Lancamentos.Add(estorno);

        if (tipoInverso == TipoLancamento.Entrada)
            original.ContaBancaria.SaldoAtual += original.Valor;
        else
            original.ContaBancaria.SaldoAtual -= original.Valor;
        original.ContaBancaria.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(ParaResponse(estorno));
    }

    private static LancamentoResponse ParaResponse(Lancamento l) => new(
        l.Id, l.ContaBancariaId, l.Data, l.Tipo, l.Valor, l.Origem, l.Fonte, l.Descricao, l.EstornoDeId);
}
