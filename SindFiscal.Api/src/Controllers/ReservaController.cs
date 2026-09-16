using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Dtos;
using SindFiscal.Entities;
using SindFiscal.Services;

namespace SindFiscal.Controllers;

/// <summary>
/// RF21, RN22, RN23 — reservas de área comum com fundo próprio (ex.: espaço
/// gourmet). Registro feito pela síndica com base na lista que ela já
/// levanta periodicamente (hoje via CondoMob) — este sistema não reproduz o
/// app de reservas dos moradores. "Fechar período" agrega as reservas do
/// mês em um único item de destinação de receita na área de acerto (RF14c).
/// </summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/reservas")]
[RequerPermissao(Modulos.ReservasAreaComum)]
public class ReservaController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AreaDeAcertoService _areaDeAcerto;

    public ReservaController(AppDbContext db, AreaDeAcertoService areaDeAcerto)
    {
        _db = db;
        _areaDeAcerto = areaDeAcerto;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ReservaResponse>>> Listar(
        Guid condominioId,
        [FromQuery] Guid? fundoDestinoId,
        [FromQuery] DateOnly? periodoReferencia,
        CancellationToken ct
    )
    {
        var query = _db.Reservas.Where(r => r.CondominioId == condominioId);
        if (fundoDestinoId is Guid fid)
            query = query.Where(r => r.FundoDestinoId == fid);
        if (periodoReferencia is DateOnly periodo)
            query = query.Where(r => r.PeriodoReferencia == periodo);

        var reservas = await query
            .OrderByDescending(r => r.PeriodoReferencia)
            .ThenBy(r => r.Unidade)
            .Select(r => new ReservaResponse(
                r.Id,
                r.FundoDestinoId,
                r.Unidade,
                r.MoradorNome,
                r.ValorDestinadoAoFundo,
                r.PagoComDesconto,
                r.PeriodoReferencia
            ))
            .ToListAsync(ct);

        return Ok(reservas);
    }

    /// <summary>RF21 — registro manual da reserva (unidade, morador, valor líquido destinado ao fundo).</summary>
    [HttpPost]
    [RequerPermissao(Modulos.ReservasAreaComum, NivelPermissao.Editar)]
    public async Task<ActionResult<ReservaResponse>> Registrar(
        Guid condominioId,
        RegistrarReservaRequest request,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(request.Unidade))
            return BadRequest("Unidade é obrigatória.");
        if (string.IsNullOrWhiteSpace(request.MoradorNome))
            return BadRequest("Nome do morador é obrigatório.");
        if (request.ValorDestinadoAoFundo <= 0)
            return BadRequest("Valor destinado ao fundo deve ser positivo.");

        var fundoValido = await _db.ContasBancarias.AnyAsync(
            c => c.Id == request.FundoDestinoId && c.CondominioId == condominioId,
            ct
        );
        if (!fundoValido)
            return BadRequest("Fundo de destino não pertence a este condomínio.");

        var reserva = new Reserva
        {
            Id = Guid.NewGuid(),
            CondominioId = condominioId,
            FundoDestinoId = request.FundoDestinoId,
            Unidade = request.Unidade.Trim(),
            MoradorNome = request.MoradorNome.Trim(),
            ValorDestinadoAoFundo = request.ValorDestinadoAoFundo,
            PagoComDesconto = request.PagoComDesconto,
            PeriodoReferencia = request.PeriodoReferencia,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Reservas.Add(reserva);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(
            nameof(Listar),
            new { condominioId },
            new ReservaResponse(
                reserva.Id,
                reserva.FundoDestinoId,
                reserva.Unidade,
                reserva.MoradorNome,
                reserva.ValorDestinadoAoFundo,
                reserva.PagoComDesconto,
                reserva.PeriodoReferencia
            )
        );
    }

    /// <summary>
    /// RF21 -> RF14(c) — soma as reservas do período para o fundo e gera o
    /// item de destinação de receita na área de acerto (aparece na aba
    /// "Destinações de receita" do TransferenciaController).
    /// </summary>
    [HttpPost("fechar-periodo")]
    [RequerPermissao(Modulos.ReservasAreaComum, NivelPermissao.Editar)]
    public async Task<ActionResult<TransferenciaResponse>> FecharPeriodo(
        Guid condominioId,
        FecharPeriodoReservasRequest request,
        CancellationToken ct
    )
    {
        var fundoValido = await _db.ContasBancarias.AnyAsync(
            c => c.Id == request.FundoDestinoId && c.CondominioId == condominioId,
            ct
        );
        if (!fundoValido)
            return BadRequest("Fundo de destino não pertence a este condomínio.");

        try
        {
            var transferencia = await _areaDeAcerto.FecharPeriodoReservasAsync(
                condominioId,
                request.FundoDestinoId,
                request.PeriodoReferencia,
                ct
            );

            var contas = await _db
                .ContasBancarias.Where(c =>
                    c.Id == transferencia.ContaOrigemId || c.Id == transferencia.ContaDestinoId
                )
                .ToDictionaryAsync(c => c.Id, c => c.Nome, ct);

            return Ok(
                new TransferenciaResponse(
                    transferencia.Id,
                    transferencia.ContaOrigemId,
                    contas.GetValueOrDefault(transferencia.ContaOrigemId, ""),
                    transferencia.ContaDestinoId,
                    contas.GetValueOrDefault(transferencia.ContaDestinoId, ""),
                    transferencia.Valor,
                    transferencia.Tipo,
                    transferencia.Modo,
                    transferencia.Origem,
                    transferencia.Motivo,
                    transferencia.Status,
                    transferencia.DataExecucao
                )
            );
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}
