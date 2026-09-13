using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>RF04 — contas/fundos por condomínio (módulo contas_lancamentos).</summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/contas")]
[RequerPermissao(Modulos.ContasLancamentos)]
public class ContaBancariaController : ControllerBase
{
    private readonly AppDbContext _db;

    public ContaBancariaController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ContaBancariaResponse>>> Listar(
        Guid condominioId, CancellationToken ct)
    {
        var contas = await _db.ContasBancarias
            .Where(c => c.CondominioId == condominioId)
            .OrderByDescending(c => c.EhContaOperacional)
            .ThenBy(c => c.Nome)
            .ToListAsync(ct);

        return Ok(contas.Select(ParaResponse).ToList());
    }

    [HttpPost]
    [RequerPermissao(Modulos.ContasLancamentos, NivelPermissao.Editar)]
    public async Task<ActionResult<ContaBancariaResponse>> Criar(
        Guid condominioId, CriarContaBancariaRequest request, CancellationToken ct)
    {
        if (request.EhContaOperacional)
        {
            var jaExiste = await _db.ContasBancarias.AnyAsync(
                c => c.CondominioId == condominioId && c.EhContaOperacional, ct);
            if (jaExiste)
                return Conflict(new { message = "Já existe conta operacional neste condomínio." });
        }

        var conta = new ContaBancaria
        {
            Id = Guid.NewGuid(),
            CondominioId = condominioId,
            Nome = request.Nome.Trim(),
            Finalidade = request.Finalidade,
            EhContaOperacional = request.EhContaOperacional,
            RegraAporteTipo = request.RegraAporteTipo,
            RegraAporteValor = request.RegraAporteValor,
            TetoMaximo = request.TetoMaximo,
            SaldoAtual = 0,
            AportePendenteAcumulado = 0,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.ContasBancarias.Add(conta);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Listar), new { condominioId }, ParaResponse(conta));
    }

    [HttpPatch("{contaId:guid}/regra-aporte")]
    [RequerPermissao(Modulos.ContasLancamentos, NivelPermissao.Editar)]
    public async Task<ActionResult<ContaBancariaResponse>> AtualizarRegraAporte(
        Guid condominioId, Guid contaId, AtualizarRegraAporteRequest request, CancellationToken ct)
    {
        var conta = await _db.ContasBancarias.FirstOrDefaultAsync(
            c => c.Id == contaId && c.CondominioId == condominioId, ct);
        if (conta is null) return NotFound();

        conta.RegraAporteTipo = request.RegraAporteTipo;
        conta.RegraAporteValor = request.RegraAporteValor;
        conta.TetoMaximo = request.TetoMaximo;
        conta.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ParaResponse(conta));
    }

    private static ContaBancariaResponse ParaResponse(ContaBancaria c) => new(
        c.Id, c.Nome, c.Finalidade, c.EhContaOperacional,
        c.RegraAporteTipo, c.RegraAporteValor, c.TetoMaximo,
        c.SaldoAtual, c.AportePendenteAcumulado);
}
