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
/// RF11, RN15, RN16, RN19 — pagamentos de um compromisso, com suporte a
/// múltiplos pagamentos parciais. Todo pagamento registrado passa pelo
/// AreaDeAcertoService para checar se precisa gerar uma reposição pendente
/// (RN19) — é esse acoplamento que faz a "área de acerto" funcionar de
/// verdade, em vez de depender de o síndico lembrar de checar depois.
/// </summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/compromissos/{compromissoId:guid}/pagamentos")]
[RequerPermissao(Modulos.PagamentosFilaExecucao)]
public class PagamentoController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AreaDeAcertoService _areaDeAcerto;

    public PagamentoController(AppDbContext db, AreaDeAcertoService areaDeAcerto)
    {
        _db = db;
        _areaDeAcerto = areaDeAcerto;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PagamentoResponse>>> Listar(
        Guid condominioId,
        Guid compromissoId,
        CancellationToken ct
    )
    {
        var pagamentos = await _db
            .Pagamentos.Where(p =>
                p.CompromissoId == compromissoId && p.Compromisso.CondominioId == condominioId
            )
            .Select(p => new PagamentoResponse(
                p.Id,
                p.CompromissoId,
                p.FundoResponsavelId,
                p.LancamentoId,
                p.Tipo,
                p.Valor,
                p.Data
            ))
            .ToListAsync(ct);
        return Ok(pagamentos);
    }

    [HttpPost]
    [RequerPermissao(Modulos.PagamentosFilaExecucao, NivelPermissao.Editar)]
    public async Task<ActionResult<PagamentoResponse>> Registrar(
        Guid condominioId,
        Guid compromissoId,
        RegistrarPagamentoRequest request,
        CancellationToken ct
    )
    {
        var compromissoExiste = await _db.CompromissosFinanceiros.AnyAsync(
            c => c.Id == compromissoId && c.CondominioId == condominioId,
            ct
        );
        if (!compromissoExiste)
            return NotFound("Compromisso não encontrado neste condomínio.");

        var fundoPertenceAoCondominio = await _db.ContasBancarias.AnyAsync(
            c => c.Id == request.FundoResponsavelId && c.CondominioId == condominioId,
            ct
        );
        if (!fundoPertenceAoCondominio)
            return BadRequest("Fundo responsável não pertence a este condomínio.");

        var pagamento = new Pagamento
        {
            Id = Guid.NewGuid(),
            CompromissoId = compromissoId,
            FundoResponsavelId = request.FundoResponsavelId,
            LancamentoId = request.LancamentoIdParaReconciliar,
            Tipo = request.Tipo,
            Valor = request.Valor,
            Data = request.Data,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Pagamentos.Add(pagamento);
        await _db.SaveChangesAsync(ct);

        // RN19 — dispara a checagem de divergência fundo x conta que efetivamente pagou.
        await _areaDeAcerto.GerarReposicaoSeNecessarioAsync(pagamento, ct);

        return CreatedAtAction(
            nameof(Listar),
            new { condominioId, compromissoId },
            new PagamentoResponse(
                pagamento.Id,
                pagamento.CompromissoId,
                pagamento.FundoResponsavelId,
                pagamento.LancamentoId,
                pagamento.Tipo,
                pagamento.Valor,
                pagamento.Data
            )
        );
    }
}
