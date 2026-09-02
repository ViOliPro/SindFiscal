using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;

namespace SindFiscal.Controllers;

/// <summary>
/// RF17, RF18, RNF05 — dashboard e relatórios. O cálculo de SaldoLivre aqui é
/// DELIBERADAMENTE sem clamping em zero — a planilha original do cliente
/// forçava "Saldo livre" a nunca ficar negativo (MAX(saldo,0)), o que fazia
/// o indicador "Total em caixa" divergir da soma de seus componentes
/// exatamente na situação mais crítica (quando o condomínio está no
/// vermelho). Aqui, todos os indicadores derivam da mesma query, sempre —
/// não existem dois caminhos de cálculo que possam divergir entre si.
/// </summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/dashboard")]
[RequerPermissao(Modulos.DashboardRelatorios)]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public DashboardController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<DashboardResponse>> Obter(
        Guid condominioId,
        CancellationToken ct
    )
    {
        var saldoBancarioTotal = await _db
            .ContasBancarias.Where(c => c.CondominioId == condominioId)
            .SumAsync(c => c.SaldoAtual, ct);

        var statusComprometidos = new[]
        {
            StatusCompromisso.AguardandoExecucao,
            StatusCompromisso.EmFilaExecucao,
            StatusCompromisso.EmExecucao,
        };
        var valorComprometidoTotal = await _db
            .CompromissosFinanceiros.Where(c =>
                c.CondominioId == condominioId && statusComprometidos.Contains(c.Status)
            )
            .SumAsync(c => c.ValorAprovado, ct);

        var saldoLivre = saldoBancarioTotal - valorComprometidoTotal; // sem MAX(0, ...) — ver comentário da classe
        var percentualComprometido =
            saldoBancarioTotal == 0 ? 0 : valorComprometidoTotal / saldoBancarioTotal;

        var valorEmFilaDeExecucao = await _db
            .CompromissosFinanceiros.Where(c =>
                c.CondominioId == condominioId && c.Status == StatusCompromisso.EmFilaExecucao
            )
            .SumAsync(c => c.ValorAprovado, ct);

        var itensPendentesAreaDeAcerto = await _db.Transferencias.CountAsync(
            t => t.CondominioId == condominioId && t.Status == StatusTransferencia.Pendente,
            ct
        );

        var itensEmAnaliseOuOrcamento = await _db.Necessidades.CountAsync(
            n =>
                n.CondominioId == condominioId
                && (
                    n.Situacao == SituacaoNecessidade.EmAnalise
                    || n.Situacao == SituacaoNecessidade.EmOrcamento
                ),
            ct
        );

        return Ok(
            new DashboardResponse(
                saldoBancarioTotal,
                valorComprometidoTotal,
                saldoLivre,
                percentualComprometido,
                saldoLivre < 0, // NecessidadeDeArrecadacaoExtra
                valorEmFilaDeExecucao,
                itensPendentesAreaDeAcerto,
                itensEmAnaliseOuOrcamento
            )
        );
    }

    /// <summary>RF18 — relatório de prestação de contas, parametrizável por período.</summary>
    [HttpGet("relatorio-prestacao-contas")]
    public async Task<ActionResult<RelatorioPrestacaoContasResponse>> RelatorioPrestacaoContas(
        Guid condominioId,
        [FromQuery] DateOnly inicio,
        [FromQuery] DateOnly fim,
        CancellationToken ct
    )
    {
        var lancamentosNoPeriodo = await _db
            .Lancamentos.Where(l =>
                l.ContaBancaria.CondominioId == condominioId
                && l.Origem == OrigemLancamento.Real
                && l.Data >= inicio
                && l.Data <= fim
            )
            .ToListAsync(ct);

        var totalEntradas = lancamentosNoPeriodo
            .Where(l => l.Tipo == TipoLancamento.Entrada)
            .Sum(l => l.Valor);
        var totalSaidas = lancamentosNoPeriodo
            .Where(l => l.Tipo == TipoLancamento.Saida)
            .Sum(l => l.Valor);

        var inicioDateTime = new DateTimeOffset(
            inicio.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)
        );
        var fimDateTime = new DateTimeOffset(fim.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc));

        var compromissos = await _db
            .CompromissosFinanceiros.Where(c =>
                c.CondominioId == condominioId
                && c.CreatedAt >= inicioDateTime
                && c.CreatedAt <= fimDateTime
            )
            .Select(c => new CompromissoFinanceiroResponse(
                c.Id,
                c.NecessidadeId,
                c.CompromissoPaiId,
                c.Categoria,
                c.ValorAprovado,
                c.Status,
                c.PrioridadeFila,
                0,
                0,
                c.ValorAprovado
            ))
            .ToListAsync(ct);

        var transferencias = await _db
            .Transferencias.Where(t =>
                t.CondominioId == condominioId
                && t.DataExecucao != null
                && t.DataExecucao >= inicio
                && t.DataExecucao <= fim
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
            new RelatorioPrestacaoContasResponse(
                inicio,
                fim,
                totalEntradas,
                totalSaidas,
                compromissos,
                transferencias
            )
        );
    }
}
