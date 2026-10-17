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
/// RF14, RN20, RN22 — receitas/transferências mensais recorrentes que alimentam
/// a área de acerto. Mesmo módulo de permissão da área de acerto. Não há DELETE:
/// uma recorrência encerrada fica inativa, preservando histórico e auditoria.
/// </summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/receitas-recorrentes")]
[RequerPermissao(Modulos.TransferenciasAreaAcerto)]
public class ReceitaRecorrenteController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AreaDeAcertoService _areaDeAcerto;

    public ReceitaRecorrenteController(AppDbContext db, AreaDeAcertoService areaDeAcerto)
    {
        _db = db;
        _areaDeAcerto = areaDeAcerto;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ReceitaRecorrenteResponse>>> Listar(
        Guid condominioId,
        CancellationToken ct
    )
    {
        var lista = await _db
            .ReceitasRecorrentes.AsNoTracking()
            .Where(r => r.CondominioId == condominioId)
            .OrderByDescending(r => r.Ativa)
            .ThenBy(r => r.Descricao)
            .Select(r => new ReceitaRecorrenteResponse(
                r.Id,
                r.Descricao,
                r.Valor,
                r.ContaOrigemId,
                r.ContaOrigem.Nome,
                r.ContaDestinoId,
                r.ContaDestino.Nome,
                r.Motivo,
                r.DataInicio,
                r.DataFim,
                r.Ativa,
                _db.Transferencias
                    .Where(t => t.ReceitaRecorrenteId == r.Id)
                    .Max(t => t.PeriodoReferencia)
            ))
            .ToListAsync(ct);
        return Ok(lista);
    }

    [HttpPost]
    [RequerPermissao(Modulos.TransferenciasAreaAcerto, NivelPermissao.Editar)]
    public async Task<ActionResult<ReceitaRecorrenteResponse>> Criar(
        Guid condominioId,
        CriarReceitaRecorrenteRequest request,
        CancellationToken ct
    )
    {
        var (origemId, erro) = await ValidarAsync(
            condominioId,
            request.Descricao,
            request.Valor,
            request.ContaOrigemId,
            request.ContaDestinoId,
            request.Motivo,
            request.DataInicio,
            request.DataFim,
            ct
        );
        if (erro is not null)
            return BadRequest(erro);

        var regra = new ReceitaRecorrente
        {
            Id = Guid.NewGuid(),
            CondominioId = condominioId,
            Descricao = request.Descricao.Trim(),
            Valor = request.Valor,
            ContaOrigemId = origemId,
            ContaDestinoId = request.ContaDestinoId,
            Motivo = request.Motivo,
            DataInicio = request.DataInicio,
            DataFim = request.DataFim,
            Ativa = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.ReceitasRecorrentes.Add(regra);
        await _db.SaveChangesAsync(ct);
        return Ok(await ObterAsync(regra.Id, ct));
    }

    [HttpPut("{id:guid}")]
    [RequerPermissao(Modulos.TransferenciasAreaAcerto, NivelPermissao.Editar)]
    public async Task<ActionResult<ReceitaRecorrenteResponse>> Atualizar(
        Guid condominioId,
        Guid id,
        AtualizarReceitaRecorrenteRequest request,
        CancellationToken ct
    )
    {
        var regra = await _db.ReceitasRecorrentes.FirstOrDefaultAsync(
            r => r.Id == id && r.CondominioId == condominioId,
            ct
        );
        if (regra is null)
            return NotFound("Recorrência não encontrada.");

        var (origemId, erro) = await ValidarAsync(
            condominioId,
            request.Descricao,
            request.Valor,
            request.ContaOrigemId,
            request.ContaDestinoId,
            request.Motivo,
            request.DataInicio,
            request.DataFim,
            ct
        );
        if (erro is not null)
            return BadRequest(erro);

        regra.Descricao = request.Descricao.Trim();
        regra.Valor = request.Valor;
        regra.ContaOrigemId = origemId;
        regra.ContaDestinoId = request.ContaDestinoId;
        regra.Motivo = request.Motivo;
        regra.DataInicio = request.DataInicio;
        regra.DataFim = request.DataFim;
        regra.Ativa = request.Ativa;
        regra.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(await ObterAsync(regra.Id, ct));
    }

    /// <summary>
    /// Gera os itens pendentes da competência para todas as recorrências ativas e
    /// vigentes. Seguro chamar mais de uma vez: não duplica (ver service).
    /// </summary>
    [HttpPost("gerar-periodo")]
    [RequerPermissao(Modulos.TransferenciasAreaAcerto, NivelPermissao.Editar)]
    public async Task<ActionResult<GerarRecorrentesPeriodoResponse>> GerarPeriodo(
        Guid condominioId,
        GerarRecorrentesPeriodoRequest request,
        CancellationToken ct
    )
    {
        try
        {
            var (geradas, jaGeradas) = await _areaDeAcerto.GerarRecorrentesDoPeriodoAsync(
                condominioId,
                request.PeriodoReferencia,
                ct
            );

            var contaIds = geradas
                .SelectMany(t => new[] { t.ContaOrigemId, t.ContaDestinoId })
                .Distinct()
                .ToList();
            var nomes = await _db
                .ContasBancarias.AsNoTracking()
                .Where(c => contaIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => c.Nome, ct);

            var itens = geradas
                .Select(t => new TransferenciaResponse(
                    t.Id,
                    t.ContaOrigemId,
                    nomes.GetValueOrDefault(t.ContaOrigemId, ""),
                    t.ContaDestinoId,
                    nomes.GetValueOrDefault(t.ContaDestinoId, ""),
                    t.Valor,
                    t.Tipo,
                    t.Modo,
                    t.Origem,
                    t.Motivo,
                    t.Status,
                    t.DataExecucao,
                    t.Descricao
                ))
                .ToList();

            return Ok(new GerarRecorrentesPeriodoResponse(itens.Count, jaGeradas, itens));
        }
        catch (DbUpdateException)
        {
            // Corrida: outra requisição gerou o mesmo período entre a checagem e o INSERT.
            return Conflict("Itens deste período já foram gerados. Atualize a tela.");
        }
    }

    private async Task<ReceitaRecorrenteResponse> ObterAsync(Guid id, CancellationToken ct) =>
        await _db
            .ReceitasRecorrentes.AsNoTracking()
            .Where(r => r.Id == id)
            .Select(r => new ReceitaRecorrenteResponse(
                r.Id,
                r.Descricao,
                r.Valor,
                r.ContaOrigemId,
                r.ContaOrigem.Nome,
                r.ContaDestinoId,
                r.ContaDestino.Nome,
                r.Motivo,
                r.DataInicio,
                r.DataFim,
                r.Ativa,
                _db.Transferencias
                    .Where(t => t.ReceitaRecorrenteId == r.Id)
                    .Max(t => t.PeriodoReferencia)
            ))
            .SingleAsync(ct);

    private async Task<(Guid ContaOrigemId, string? Erro)> ValidarAsync(
        Guid condominioId,
        string descricao,
        decimal valor,
        Guid? contaOrigemId,
        Guid contaDestinoId,
        MotivoTransferencia motivo,
        DateOnly dataInicio,
        DateOnly? dataFim,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(descricao) || descricao.Trim().Length > 150)
            return (Guid.Empty, "Descrição é obrigatória (até 150 caracteres).");
        if (valor <= 0)
            return (Guid.Empty, "Valor deve ser maior que zero.");
        if (motivo == MotivoTransferencia.Reposicao)
            return (
                Guid.Empty,
                "Recorrência só pode ser aporte ou destinação de receita; reposição nasce de pagamentos (RN19)."
            );
        if (dataFim is DateOnly fim && fim < dataInicio)
            return (Guid.Empty, "Data de fim não pode ser anterior à data de início.");

        var origemId = contaOrigemId;
        if (origemId is null)
        {
            origemId = await _db
                .ContasBancarias.Where(c => c.CondominioId == condominioId && c.EhContaOperacional)
                .Select(c => (Guid?)c.Id)
                .FirstOrDefaultAsync(ct);
            if (origemId is null)
                return (Guid.Empty, "Condomínio sem conta operacional; informe a conta de origem.");
        }
        if (origemId == contaDestinoId)
            return (Guid.Empty, "Conta de origem e de destino devem ser diferentes.");

        var contasValidas = await _db.ContasBancarias.CountAsync(
            c =>
                c.CondominioId == condominioId && (c.Id == origemId || c.Id == contaDestinoId),
            ct
        );
        if (contasValidas != 2)
            return (Guid.Empty, "As contas informadas precisam pertencer a este condomínio.");

        return (origemId.Value, null);
    }
}
