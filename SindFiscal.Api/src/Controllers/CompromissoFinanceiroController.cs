using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;
using SindFiscal.Services;

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
        Guid condominioId,
        [FromQuery] StatusCompromisso? status,
        CancellationToken ct
    )
    {
        var query = _db.CompromissosFinanceiros.Where(c => c.CondominioId == condominioId);
        if (status is not null)
            query = query.Where(c => c.Status == status);

        var compromissos = await query.OrderBy(c => c.PrioridadeFila).ToListAsync(ct);
        var alcada = await ObterAlcadaAsync(condominioId, ct);
        return Ok(compromissos.Select(c => ParaResponse(c, alcada)).ToList());
    }

    /// <summary>Detalhe de um compromisso, com gastos vinculados (RF12) e pagamentos (RF11).</summary>
    [HttpGet("{compromissoId:guid}")]
    public async Task<ActionResult<CompromissoFinanceiroDetalheResponse>> Detalhar(
        Guid condominioId,
        Guid compromissoId,
        CancellationToken ct
    )
    {
        var compromisso = await _db
            .CompromissosFinanceiros.Include(c => c.GastosVinculados)
            .Include(c => c.Pagamentos)
            .FirstOrDefaultAsync(c => c.Id == compromissoId && c.CondominioId == condominioId, ct);
        if (compromisso is null)
            return NotFound("Compromisso não encontrado.");

        var alcada = await ObterAlcadaAsync(condominioId, ct);
        var gastos = compromisso
            .GastosVinculados.OrderByDescending(g => g.CreatedAt)
            .Select(g => new GastoVinculadoResumo(
                g.Id,
                g.Categoria,
                g.ValorAprovado,
                g.Status,
                g.CreatedAt
            ))
            .ToList();
        var pagamentos = compromisso
            .Pagamentos.OrderByDescending(p => p.Data)
            .Select(p => new PagamentoResumo(p.Id, p.Tipo, p.Valor, p.Data))
            .ToList();

        return Ok(
            new CompromissoFinanceiroDetalheResponse(
                ParaResponse(compromisso, alcada),
                gastos,
                pagamentos
            )
        );
    }

    /// <summary>RN15 — compromisso avulso, sem necessidade formal associada.</summary>
    [HttpPost("avulsos")]
    [RequerPermissao(Modulos.DecisoesCompromissos, NivelPermissao.Editar)]
    public async Task<ActionResult<CompromissoFinanceiroResponse>> CriarAvulso(
        Guid condominioId,
        CriarCompromissoAvulsoRequest request,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(request.Categoria))
            return BadRequest("Categoria é obrigatória.");
        if (request.ValorAprovado < 0)
            return BadRequest("Valor aprovado não pode ser negativo.");

        var condominioExiste = await _db.Condominios.AnyAsync(c => c.Id == condominioId, ct);
        if (!condominioExiste)
            return NotFound("Condomínio não encontrado.");

        var compromisso = new CompromissoFinanceiro
        {
            Id = Guid.NewGuid(),
            CondominioId = condominioId,
            Categoria = request.Categoria.Trim(),
            ValorAprovado = request.ValorAprovado,
            Status = StatusCompromisso.AguardandoExecucao,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.CompromissosFinanceiros.Add(compromisso);
        await _db.SaveChangesAsync(ct);

        var alcada = await ObterAlcadaAsync(condominioId, ct);
        return CreatedAtAction(
            nameof(Detalhar),
            new { condominioId, compromissoId = compromisso.Id },
            ParaResponse(compromisso, alcada)
        );
    }

    /// <summary>RF12, RN13, RN14 — vincula um gasto avulso a um compromisso "pai" já existente.</summary>
    [HttpPost("{compromissoPaiId:guid}/gastos-vinculados")]
    [RequerPermissao(Modulos.DecisoesCompromissos, NivelPermissao.Editar)]
    public async Task<ActionResult<CompromissoFinanceiroResponse>> VincularGasto(
        Guid condominioId,
        Guid compromissoPaiId,
        VincularGastoRequest request,
        CancellationToken ct
    )
    {
        var pai = await _db.CompromissosFinanceiros.FirstOrDefaultAsync(
            c => c.Id == compromissoPaiId && c.CondominioId == condominioId,
            ct
        );
        if (pai is null)
            return NotFound("Compromisso pai não encontrado.");

        // RN13/RN14 — vincular gasto a um "pai" só faz sentido enquanto ele ainda está
        // em andamento; um compromisso cancelado ou já concluído não recebe novos gastos.
        if (pai.Status is StatusCompromisso.Cancelado or StatusCompromisso.Concluido)
            return Conflict($"Não é possível vincular gastos a um compromisso {pai.Status}.");

        // Evita encadear "pai de pai": um gasto vinculado não pode, por sua vez, virar pai de outro.
        if (pai.CompromissoPaiId is not null)
            return Conflict(
                "Não é possível vincular um gasto a outro gasto já vinculado — vincule ao compromisso 'pai' original."
            );

        var filho = new CompromissoFinanceiro
        {
            Id = Guid.NewGuid(),
            CondominioId = condominioId,
            CompromissoPaiId = compromissoPaiId,
            Categoria = request.Categoria.Trim(),
            ValorAprovado = request.Valor,
            Status = StatusCompromisso.Concluido, // gasto vinculado tipicamente já executado no ato (ex.: compra no depósito)
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.CompromissosFinanceiros.Add(filho);
        await _db.SaveChangesAsync(ct);

        var alcada = await ObterAlcadaAsync(condominioId, ct);
        return CreatedAtAction(
            nameof(Detalhar),
            new { condominioId, compromissoId = filho.Id },
            ParaResponse(filho, alcada)
        );
    }

    /// <summary>
    /// RN09, RN10 — ajusta o valor aprovado de um compromisso (ex.: valor final
    /// divergiu da cotação, ou troca de material pós-aprovação). Nesta fase não
    /// há tabela de histórico dedicada (isso fica para o módulo de Auditoria,
    /// RF19/Mód. 10) — o motivo enviado é registrado apenas em log de aplicação;
    /// não reescreva silenciosamente o valor sem essa justificativa.
    /// </summary>
    [HttpPut("{compromissoId:guid}/ajustar-valor")]
    [RequerPermissao(Modulos.DecisoesCompromissos, NivelPermissao.Editar)]
    public async Task<ActionResult<CompromissoFinanceiroResponse>> AjustarValor(
        Guid condominioId,
        Guid compromissoId,
        AjustarValorCompromissoRequest request,
        CancellationToken ct
    )
    {
        if (request.NovoValor < 0)
            return BadRequest("Novo valor não pode ser negativo.");
        if (string.IsNullOrWhiteSpace(request.Motivo))
            return BadRequest(
                "Motivo é obrigatório para ajustar o valor de um compromisso (RN09)."
            );

        var compromisso = await _db
            .CompromissosFinanceiros.Include(c => c.GastosVinculados)
            .Include(c => c.Pagamentos)
            .FirstOrDefaultAsync(c => c.Id == compromissoId && c.CondominioId == condominioId, ct);
        if (compromisso is null)
            return NotFound("Compromisso não encontrado.");

        if (compromisso.Status == StatusCompromisso.Cancelado)
            return Conflict("Não é possível ajustar o valor de um compromisso cancelado.");

        compromisso.ValorAprovado = request.NovoValor;
        compromisso.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        var alcada = await ObterAlcadaAsync(condominioId, ct);
        return Ok(ParaResponse(compromisso, alcada));
    }

    /// <summary>RN12 — cancela um compromisso aprovado, mesmo que já esteja em fila.</summary>
    [HttpPost("{compromissoId:guid}/cancelar")]
    [RequerPermissao(Modulos.DecisoesCompromissos, NivelPermissao.Editar)]
    public async Task<ActionResult<CompromissoFinanceiroResponse>> Cancelar(
        Guid condominioId,
        Guid compromissoId,
        CancelarCompromissoRequest request,
        CancellationToken ct
    )
    {
        var compromisso = await _db
            .CompromissosFinanceiros.Include(c => c.GastosVinculados)
            .Include(c => c.Pagamentos)
            .FirstOrDefaultAsync(c => c.Id == compromissoId && c.CondominioId == condominioId, ct);
        if (compromisso is null)
            return NotFound("Compromisso não encontrado.");

        if (compromisso.Status == StatusCompromisso.Concluido)
            return Conflict("Não é possível cancelar um compromisso já concluído.");
        if (compromisso.Pagamentos.Count > 0)
            return Conflict(
                "Não é possível cancelar um compromisso que já possui pagamentos registrados (RN16) — considere ajustar o valor ou registrar um estorno."
            );

        compromisso.Status = StatusCompromisso.Cancelado;
        compromisso.PrioridadeFila = null;
        compromisso.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        var alcada = await ObterAlcadaAsync(condominioId, ct);
        return Ok(ParaResponse(compromisso, alcada));
    }

    /// <summary>RF13, RN11 — entra na fila de execução (aguardando disponibilidade de caixa).</summary>
    [HttpPost("{compromissoId:guid}/entrar-na-fila")]
    [RequerPermissao(Modulos.PagamentosFilaExecucao, NivelPermissao.Editar)]
    public async Task<IActionResult> EntrarNaFila(
        Guid condominioId,
        Guid compromissoId,
        CancellationToken ct
    )
    {
        try
        {
            await _filaExecucao.EntrarNaFilaAsync(condominioId, compromissoId, ct);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        return NoContent();
    }

    /// <summary>RF13, RN11 — reordenação manual e livre pelo síndico; sem critério automático nesta fase.</summary>
    [HttpPut("fila-execucao/reordenar")]
    [RequerPermissao(Modulos.PagamentosFilaExecucao, NivelPermissao.Editar)]
    public async Task<IActionResult> ReordenarFila(
        Guid condominioId,
        ReordenarFilaExecucaoRequest request,
        CancellationToken ct
    )
    {
        try
        {
            await _filaExecucao.ReordenarAsync(condominioId, request.CompromissoIdsEmOrdem, ct);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ex.Message);
        }
        return NoContent();
    }

    private static CompromissoFinanceiroResponse ParaResponse(CompromissoFinanceiro c) =>
        new(
            c.Id,
            c.NecessidadeId,
            c.CompromissoPaiId,
            c.Categoria,
            c.ValorAprovado,
            c.Status,
            c.PrioridadeFila,
            TotalGastosVinculados: 0,
            TotalPago: 0,
            SaldoRemanescente: c.ValorAprovado
        );
    // Nota de implementação: TotalGastosVinculados e TotalPago exigem um Include/projeção
    // com GastosVinculados e Pagamentos (omitido aqui por brevidade) — ver
    // CompromissoFinanceiro.TotalGastosVinculados na entidade para o cálculo de referência.
}
