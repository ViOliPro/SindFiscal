using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Conversoes;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Services;

namespace SindFiscal.Controllers;

/// <summary>
/// RF13, RF16 — despesas futuras (necessidades planejadas + compromissos abertos)
/// e projeção de saldo por fundo. Leitura no módulo "Pagamentos e Fila de
/// Execução"; edição de planejamento exige edição do módulo dono do registro
/// (Decisões e Compromissos / Necessidades) ou de Contas e Lançamentos (fundos).
/// A prioridade categórica é rótulo informativo: não ordena a fila (RN11).
/// </summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/despesas-futuras")]
public class DespesasFuturasController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly DespesasFuturasService _servico;

    public DespesasFuturasController(AppDbContext db, DespesasFuturasService servico)
    {
        _db = db;
        _servico = servico;
    }

    [HttpGet]
    [RequerPermissao(Modulos.PagamentosFilaExecucao)]
    public async Task<ActionResult<ListaDespesasFuturasResponse>> Listar(
        Guid condominioId,
        [FromQuery] Guid? fundoId,
        [FromQuery] bool semFundo,
        [FromQuery, ModelBinder(typeof(SnakeCaseEnumModelBinder))] EtapaDespesaFutura? etapa,
        [FromQuery, ModelBinder(typeof(SnakeCaseEnumModelBinder))] Prioridade? prioridade,
        [FromQuery] DateOnly? de,
        [FromQuery] DateOnly? ate,
        [FromQuery] string? busca,
        CancellationToken ct
    )
    {
        var filtro = new FiltroDespesasFuturas(fundoId, semFundo, etapa, prioridade, de, ate, busca);
        return Ok(await _servico.ListarAsync(condominioId, filtro, ct));
    }

    [HttpGet("projecao")]
    [RequerPermissao(Modulos.PagamentosFilaExecucao)]
    public async Task<ActionResult<ProjecaoFundosResponse>> Projetar(
        Guid condominioId,
        [FromQuery] DateOnly? ate,
        CancellationToken ct
    ) => Ok(await _servico.ProjetarAsync(condominioId, ate, ct));

    [HttpPut("compromissos/{compromissoId:guid}/planejamento")]
    [RequerPermissao(Modulos.DecisoesCompromissos, NivelPermissao.Editar)]
    public async Task<IActionResult> AtualizarPlanejamentoCompromisso(
        Guid condominioId,
        Guid compromissoId,
        AtualizarPlanejamentoCompromissoRequest request,
        CancellationToken ct
    )
    {
        var compromisso = await _db.CompromissosFinanceiros.FirstOrDefaultAsync(
            c => c.Id == compromissoId && c.CondominioId == condominioId,
            ct
        );
        if (compromisso is null)
            return NotFound("Compromisso não encontrado.");
        if (compromisso.Status is StatusCompromisso.Concluido or StatusCompromisso.Cancelado)
            return Conflict($"Compromisso {compromisso.Status} não aceita alteração de planejamento.");

        var erro = await ValidarFundoAsync(condominioId, request.FundoPrevistoId, ct);
        if (erro is not null)
            return BadRequest(erro);

        compromisso.Prioridade = request.Prioridade;
        compromisso.DataPrevista = request.DataPrevista;
        compromisso.FundoPrevistoId = request.FundoPrevistoId;
        compromisso.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("necessidades/{necessidadeId:guid}/planejamento")]
    [RequerPermissao(Modulos.NecessidadesCotacoesFornecedores, NivelPermissao.Editar)]
    public async Task<IActionResult> AtualizarPlanejamentoNecessidade(
        Guid condominioId,
        Guid necessidadeId,
        AtualizarPlanejamentoNecessidadeRequest request,
        CancellationToken ct
    )
    {
        var necessidade = await _db.Necessidades.FirstOrDefaultAsync(
            n => n.Id == necessidadeId && n.CondominioId == condominioId,
            ct
        );
        if (necessidade is null)
            return NotFound("Necessidade não encontrada.");
        if (
            necessidade.Situacao
            is not (
                SituacaoNecessidade.EmAnalise
                or SituacaoNecessidade.EmOrcamento
                or SituacaoNecessidade.Adiado
            )
        )
            return Conflict(
                $"Necessidade {necessidade.Situacao} não aceita alteração de planejamento."
            );
        if (request.ValorEstimado is < 0)
            return BadRequest("Valor estimado não pode ser negativo.");

        var erro = await ValidarFundoAsync(condominioId, request.FundoPrevistoId, ct);
        if (erro is not null)
            return BadRequest(erro);

        necessidade.Prioridade = request.Prioridade;
        necessidade.DataPrevista = request.DataPrevista;
        necessidade.FundoPrevistoId = request.FundoPrevistoId;
        necessidade.ValorEstimado = request.ValorEstimado;
        necessidade.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Marca/desmarca um fundo como considerado nos totais do planejamento.</summary>
    [HttpPut("fundos/{contaId:guid}/considerar")]
    [RequerPermissao(Modulos.ContasLancamentos, NivelPermissao.Editar)]
    public async Task<IActionResult> DefinirFundoNoPlanejamento(
        Guid condominioId,
        Guid contaId,
        DefinirFundoNoPlanejamentoRequest request,
        CancellationToken ct
    )
    {
        var conta = await _db.ContasBancarias.FirstOrDefaultAsync(
            c => c.Id == contaId && c.CondominioId == condominioId,
            ct
        );
        if (conta is null)
            return NotFound("Conta/fundo não encontrado.");

        conta.ConsideradoNoPlanejamento = request.Considerar;
        conta.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private async Task<string?> ValidarFundoAsync(Guid condominioId, Guid? fundoId, CancellationToken ct)
    {
        if (fundoId is null)
            return null;
        var existe = await _db.ContasBancarias.AnyAsync(
            c => c.Id == fundoId && c.CondominioId == condominioId,
            ct
        );
        return existe ? null : "Fundo previsto não pertence a este condomínio.";
    }
}
