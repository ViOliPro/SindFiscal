using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Services;

namespace SindFiscal.Controllers;

/// <summary>
/// RF14, RN17-RN24 — área de acerto. A maior parte da lógica de geração vive
/// em AreaDeAcertoService; este controller expõe a listagem (agrupada por
/// motivo) e as ações que o síndico realmente executa: consolidar itens e
/// confirmar execução manual.
/// </summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/area-de-acerto")]
[RequerPermissao(Modulos.TransferenciasAreaAcerto)]
public class TransferenciaController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AreaDeAcertoService _areaDeAcerto;

    public TransferenciaController(AppDbContext db, AreaDeAcertoService areaDeAcerto)
    {
        _db = db;
        _areaDeAcerto = areaDeAcerto;
    }

    /// <summary>RF14 — lista os itens pendentes, agrupados pelos três motivos (a/b/c).</summary>
    [HttpGet]
    public async Task<ActionResult<AreaDeAcertoResponse>> Listar(
        Guid condominioId,
        CancellationToken ct
    )
    {
        var pendentes = await _db
            .Transferencias.Where(t =>
                t.CondominioId == condominioId && t.Status == StatusTransferencia.Pendente
            )
            .Select(t => new TransferenciaResponse(
                t.Id,
                t.ContaOrigemId,
                t.ContaOrigem.Nome,
                t.ContaDestinoId,
                t.ContaDestino.Nome,
                t.Valor,
                t.Tipo,
                t.Modo,
                t.Origem,
                t.Motivo,
                t.Status,
                t.DataExecucao
            ))
            .ToListAsync(ct);

        return Ok(
            new AreaDeAcertoResponse(
                Reposicoes: pendentes
                    .Where(t => t.Motivo == MotivoTransferencia.Reposicao)
                    .ToList(),
                Aportes: pendentes.Where(t => t.Motivo == MotivoTransferencia.Aporte).ToList(),
                DestinacoesReceita: pendentes
                    .Where(t => t.Motivo == MotivoTransferencia.DestinacaoReceita)
                    .ToList()
            )
        );
    }

    /// <summary>
    /// RN17 — agrupa N itens pendentes individuais (mesmo motivo, mesma origem
    /// e mesmo destino) em uma única transferência a executar. Os itens
    /// originais são marcados como ajustados e substituídos por um novo item
    /// consolidado — preserva-se o histórico, não se apaga os originais.
    /// </summary>
    [HttpPost("consolidar")]
    [RequerPermissao(Modulos.TransferenciasAreaAcerto, NivelPermissao.Editar)]
    public async Task<ActionResult<TransferenciaResponse>> Consolidar(
        Guid condominioId,
        ConsolidarItensDeAcertoRequest request,
        CancellationToken ct
    )
    {
        var itens = await _db
            .Transferencias.Include(t => t.ContaOrigem)
            .Include(t => t.ContaDestino)
            .Where(t =>
                request.TransferenciaIdsParaConsolidar.Contains(t.Id)
                && t.CondominioId == condominioId
            )
            .ToListAsync(ct);

        if (itens.Count < 2)
            return BadRequest("Selecione ao menos dois itens para consolidar.");
        if (itens.Any(t => t.Status != StatusTransferencia.Pendente))
            return BadRequest("Todos os itens selecionados precisam estar pendentes.");
        if (itens.Select(t => t.Motivo).Distinct().Count() > 1)
            return BadRequest("Só é possível consolidar itens do mesmo motivo (RF14).");
        if (
            itens.Select(t => t.ContaOrigemId).Distinct().Count() > 1
            || itens.Select(t => t.ContaDestinoId).Distinct().Count() > 1
        )
            return BadRequest(
                "Só é possível consolidar itens com a mesma conta de origem e de destino."
            );

        var consolidado = new SindFiscal.Entities.Transferencia
        {
            Id = Guid.NewGuid(),
            CondominioId = condominioId,
            ContaOrigemId = itens[0].ContaOrigemId,
            ContaDestinoId = itens[0].ContaDestinoId,
            Valor = itens.Sum(t => t.Valor),
            Tipo = TipoTransferencia.Total,
            Modo = ModoTransferencia.ChecklistManual,
            Origem = OrigemTransferencia.Manual, // consolidação é uma escolha manual do síndico (RN17)
            Motivo = itens[0].Motivo,
            Status = StatusTransferencia.Pendente,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        foreach (var item in itens)
        {
            item.Status = StatusTransferencia.Ajustado; // substituído pelo item consolidado
            item.UpdatedAt = DateTimeOffset.UtcNow;
        }

        _db.Transferencias.Add(consolidado);
        await _db.SaveChangesAsync(ct);

        return Ok(
            new TransferenciaResponse(
                consolidado.Id,
                consolidado.ContaOrigemId,
                itens[0].ContaOrigem.Nome,
                consolidado.ContaDestinoId,
                itens[0].ContaDestino.Nome,
                consolidado.Valor,
                consolidado.Tipo,
                consolidado.Modo,
                consolidado.Origem,
                consolidado.Motivo,
                consolidado.Status,
                consolidado.DataExecucao
            )
        );
    }

    /// <summary>RF14 — síndico confirma que executou manualmente no site da administradora.</summary>
    [HttpPost("{transferenciaId:guid}/confirmar-execucao")]
    [RequerPermissao(Modulos.TransferenciasAreaAcerto, NivelPermissao.Editar)]
    public async Task<IActionResult> ConfirmarExecucao(
        Guid condominioId,
        Guid transferenciaId,
        ConfirmarTransferenciaExecutadaRequest request,
        CancellationToken ct
    )
    {
        var pertenceAoCondominio = await _db.Transferencias.AnyAsync(
            t => t.Id == transferenciaId && t.CondominioId == condominioId,
            ct
        );
        if (!pertenceAoCondominio)
            return NotFound();

        await _areaDeAcerto.ConfirmarExecucaoAsync(transferenciaId, request.DataExecucao, ct);
        return NoContent();
    }
}
