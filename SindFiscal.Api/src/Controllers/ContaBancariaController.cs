using Microsoft.AspNetCore.Mvc;
using SindFiscal.Authorization;
using SindFiscal.Dtos;
using SindFiscal.Entities;
using SindFiscal.Services;

namespace SindFiscal.Controllers;

/// <summary>RF04 — contas/fundos por condomínio (módulo contas_lancamentos).</summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/contas")]
[RequerPermissao(Modulos.ContasLancamentos)]
public class ContaBancariaController : ControllerBase
{
    private readonly ContaBancariaService _service;

    public ContaBancariaController(ContaBancariaService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ContaBancariaResponse>>> Listar(
        Guid condominioId, CancellationToken ct)
    {
        var contas = await _service.ListarAsync(condominioId, ct);
        return Ok(contas.Select(ParaResponse).ToList());
    }

    [HttpPost]
    [RequerPermissao(Modulos.ContasLancamentos, NivelPermissao.Editar)]
    public async Task<ActionResult<ContaBancariaResponse>> Criar(
        Guid condominioId, CriarContaBancariaRequest request, CancellationToken ct)
    {
        try
        {
            var conta = await _service.CriarAsync(condominioId, request, ct);
            return CreatedAtAction(nameof(Listar), new { condominioId }, ParaResponse(conta));
        }
        catch (InvalidOperationException ex)
        {
            // Conflitos de negócio (conta operacional, regra incompleta, condomínio inexistente)
            if (ex.Message.Contains("Já existe conta operacional", StringComparison.OrdinalIgnoreCase))
                return Conflict(new { message = ex.Message });

            if (ex.Message.Contains("não encontrado", StringComparison.OrdinalIgnoreCase))
                return NotFound(new { message = ex.Message });

            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPatch("{contaId:guid}/regra-aporte")]
    [RequerPermissao(Modulos.ContasLancamentos, NivelPermissao.Editar)]
    public async Task<ActionResult<ContaBancariaResponse>> AtualizarRegraAporte(
        Guid condominioId, Guid contaId, AtualizarRegraAporteRequest request, CancellationToken ct)
    {
        try
        {
            var conta = await _service.AtualizarRegraAporteAsync(condominioId, contaId, request, ct);
            return Ok(ParaResponse(conta));
        }
        catch (InvalidOperationException ex)
        {
            if (ex.Message.Contains("não encontrada", StringComparison.OrdinalIgnoreCase))
                return NotFound(new { message = ex.Message });

            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{contaId:guid}")]
    [RequerPermissao(Modulos.ContasLancamentos, NivelPermissao.Editar)]
    public async Task<IActionResult> Excluir(Guid condominioId, Guid contaId, CancellationToken ct)
    {
        try
        {
            await _service.ExcluirAsync(condominioId, contaId, ct);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            if (ex.Message.Contains("não encontrada", StringComparison.OrdinalIgnoreCase))
                return NotFound(new { message = ex.Message });
            return Conflict(new { message = ex.Message });
        }
    }

    private static ContaBancariaResponse ParaResponse(ContaBancaria c) => new(
        c.Id, c.Nome, c.Finalidade, c.EhContaOperacional,
        c.RegraAporteTipo, c.RegraAporteValor, c.TetoMaximo,
        c.SaldoAtual, c.AportePendenteAcumulado);
}
