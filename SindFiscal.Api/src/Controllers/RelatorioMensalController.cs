using Microsoft.AspNetCore.Mvc;
using SindFiscal.Authorization;
using SindFiscal.Dtos;
using SindFiscal.Services;

namespace SindFiscal.Controllers;

/// <summary>RF18 — relatório mensal de prestação de contas (módulo Dashboard e Relatórios, somente leitura).</summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/relatorios/mensal")]
[RequerPermissao(Modulos.DashboardRelatorios)]
public class RelatorioMensalController : ControllerBase
{
    private readonly RelatorioMensalService _servico;

    public RelatorioMensalController(RelatorioMensalService servico)
    {
        _servico = servico;
    }

    /// <param name="competencia">Qualquer dia do mês desejado.</param>
    /// <param name="limiarVariacao">Variação mínima (0,20 = 20%) para marcar ponto de conferência.</param>
    /// <param name="valorMinimo">Variação mínima em R$ para marcar ponto de conferência.</param>
    [HttpGet]
    public async Task<ActionResult<RelatorioMensalResponse>> Obter(
        Guid condominioId,
        [FromQuery] DateOnly competencia,
        [FromQuery] decimal? limiarVariacao,
        [FromQuery] decimal? valorMinimo,
        CancellationToken ct
    )
    {
        var limiar = limiarVariacao ?? RelatorioMensalService.LimiarVariacaoPadrao;
        var minimo = valorMinimo ?? RelatorioMensalService.ValorMinimoPadrao;
        if (limiar <= 0 || limiar > 10)
            return BadRequest("limiarVariacao deve estar entre 0 (exclusive) e 10.");
        if (minimo < 0)
            return BadRequest("valorMinimo não pode ser negativo.");

        return Ok(await _servico.GerarAsync(condominioId, competencia, limiar, minimo, ct));
    }
}
