using Microsoft.EntityFrameworkCore;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;

namespace SindFiscal.Services;

/// <summary>
/// RF18, RNF07, RNF12 — relatório mensal de prestação de contas, no espírito do
/// relatório FISCAL: resumo, movimentação por conta, despesas por categoria com
/// variação contra o mês anterior, maiores despesas e pontos de conferência.
/// Toda a classificação nasce aqui (nunca na tela), para o relatório e qualquer
/// outra visão ficarem consistentes.
/// </summary>
public class RelatorioMensalService
{
    public const decimal LimiarVariacaoPadrao = 0.20m; // 20%
    public const decimal ValorMinimoPadrao = 100m; // ignora variação pequena em R$

    private const string SemVinculo = "Sem vínculo";

    private readonly AppDbContext _db;
    private readonly PendenciasService _pendencias;

    public RelatorioMensalService(AppDbContext db, PendenciasService pendencias)
    {
        _db = db;
        _pendencias = pendencias;
    }

    private sealed record Saida(
        Guid Id,
        DateOnly Data,
        string Descricao,
        string ContaNome,
        string? Categoria,
        Guid? FundoId,
        decimal Valor,
        bool Dispensada
    );

    public async Task<RelatorioMensalResponse> GerarAsync(
        Guid condominioId,
        DateOnly competencia,
        decimal limiarVariacao,
        decimal valorMinimo,
        CancellationToken ct = default
    )
    {
        var inicio = new DateOnly(competencia.Year, competencia.Month, 1);
        var fim = inicio.AddMonths(1).AddDays(-1);
        var inicioAnterior = inicio.AddMonths(-1);
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);

        var contas = await _db
            .ContasBancarias.AsNoTracking()
            .Where(c => c.CondominioId == condominioId)
            .OrderBy(c => c.Nome)
            .ToListAsync(ct);
        var nomes = contas.ToDictionary(c => c.Id, c => c.Nome);

        // Lançamentos reais dos dois meses, com o vínculo a pagamento/compromisso.
        var lancamentos = await _db
            .Lancamentos.AsNoTracking()
            .Include(l => l.Pagamentos)
            .ThenInclude(p => p.Compromisso)
            .Where(l =>
                l.ContaBancaria.CondominioId == condominioId
                && l.Origem == OrigemLancamento.Real
                && l.Data >= inicioAnterior
                && l.Data <= fim
            )
            .ToListAsync(ct);

        var doMes = lancamentos.Where(l => l.Data >= inicio).ToList();
        var doAnterior = lancamentos.Where(l => l.Data < inicio).ToList();

        static ResumoMensal Resumir(IReadOnlyCollection<Entities.Lancamento> ls)
        {
            var e = ls.Where(l => l.Tipo == TipoLancamento.Entrada).Sum(l => l.Valor);
            var s = ls.Where(l => l.Tipo == TipoLancamento.Saida).Sum(l => l.Valor);
            return new ResumoMensal(e, s, e - s, ls.Count);
        }

        Saida ParaSaida(Entities.Lancamento l)
        {
            var pagamento = l.Pagamentos.OrderBy(p => p.Data).FirstOrDefault();
            return new Saida(
                l.Id,
                l.Data,
                string.IsNullOrWhiteSpace(l.Descricao) ? "Saída sem descrição" : l.Descricao!,
                nomes.GetValueOrDefault(l.ContaBancariaId, ""),
                pagamento?.Compromisso.Categoria,
                pagamento?.FundoResponsavelId,
                l.Valor,
                l.ConciliacaoDispensada
            );
        }

        var saidasMes = doMes.Where(l => l.Tipo == TipoLancamento.Saida).Select(ParaSaida).ToList();
        var saidasAnterior = doAnterior
            .Where(l => l.Tipo == TipoLancamento.Saida)
            .Select(ParaSaida)
            .ToList();

        // Categoria nula = sem vínculo. É agrupada à parte para nunca se misturar a uma categoria real.
        var totalMesPorCat = saidasMes
            .GroupBy(s => s.Categoria ?? SemVinculo)
            .ToDictionary(g => g.Key, g => (Total: g.Sum(x => x.Valor), Qtd: g.Count()));
        var totalAntPorCat = saidasAnterior
            .GroupBy(s => s.Categoria ?? SemVinculo)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Valor));

        ClassificacaoDespesa Classificar(string categoria, decimal mes, decimal anterior)
        {
            if (categoria == SemVinculo)
                return ClassificacaoDespesa.SemVinculo;
            if (anterior == 0m)
                return mes > 0m ? ClassificacaoDespesa.NovaDespesa : ClassificacaoDespesa.Regular;
            var variacao = mes - anterior;
            var pct = Math.Abs(variacao) / anterior;
            return pct >= limiarVariacao && Math.Abs(variacao) >= valorMinimo
                ? ClassificacaoDespesa.PontoParaConferencia
                : ClassificacaoDespesa.Regular;
        }

        var categorias = totalMesPorCat
            .Keys.Union(totalAntPorCat.Keys)
            .Select(cat =>
            {
                var mes = totalMesPorCat.TryGetValue(cat, out var m) ? m.Total : 0m;
                var qtd = totalMesPorCat.TryGetValue(cat, out var m2) ? m2.Qtd : 0;
                var ant = totalAntPorCat.GetValueOrDefault(cat, 0m);
                return new DespesaCategoriaMensal(
                    cat,
                    mes,
                    ant,
                    mes - ant,
                    ant == 0m ? null : (mes - ant) / ant,
                    Classificar(cat, mes, ant),
                    qtd
                );
            })
            .OrderByDescending(c => c.TotalMes)
            .ThenBy(c => c.Categoria, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var classificacaoPorCat = categorias.ToDictionary(c => c.Categoria, c => c.Classificacao);

        var despesas = saidasMes
            .Select(s =>
            {
                var cat = s.Categoria ?? SemVinculo;
                return new DespesaMensal(
                    s.Id,
                    s.Data,
                    s.Descricao,
                    s.ContaNome,
                    cat,
                    s.FundoId,
                    s.FundoId is Guid f ? nomes.GetValueOrDefault(f) : null,
                    s.Valor,
                    classificacaoPorCat[cat],
                    s.Dispensada
                );
            })
            .OrderByDescending(d => d.Valor)
            .ThenBy(d => d.Data)
            .ToList();

        var totalSaidas = saidasMes.Sum(s => s.Valor);
        var concentracaoTop3 =
            totalSaidas == 0m ? 0m : despesas.Take(3).Sum(d => d.Valor) / totalSaidas;

        var porConta = contas
            .Select(c =>
            {
                var ls = doMes.Where(l => l.ContaBancariaId == c.Id).ToList();
                var e = ls.Where(l => l.Tipo == TipoLancamento.Entrada).Sum(l => l.Valor);
                var s = ls.Where(l => l.Tipo == TipoLancamento.Saida).Sum(l => l.Valor);
                return new MovimentacaoContaMensal(
                    c.Id,
                    c.Nome,
                    c.Finalidade,
                    c.EhContaOperacional,
                    e,
                    s,
                    e - s,
                    c.SaldoAtual
                );
            })
            .ToList();

        var pagamentosNoMes = await _db
            .Pagamentos.AsNoTracking()
            .Where(p =>
                p.Compromisso.CondominioId == condominioId && p.Data >= inicio && p.Data <= fim
            )
            .SumAsync(p => (decimal?)p.Valor, ct) ?? 0m;

        var inicioDt = new DateTimeOffset(inicio.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        var fimDt = new DateTimeOffset(fim.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc));
        var aprovados = await _db
            .CompromissosFinanceiros.AsNoTracking()
            .Where(c =>
                c.CondominioId == condominioId
                && c.CompromissoPaiId == null
                && c.Status != StatusCompromisso.Cancelado
                && c.CreatedAt >= inicioDt
                && c.CreatedAt <= fimDt
            )
            .Select(c => c.ValorAprovado)
            .ToListAsync(ct);

        var transferencias = await _db
            .Transferencias.AsNoTracking()
            .Where(t =>
                t.CondominioId == condominioId
                && t.Status == StatusTransferencia.Ajustado
                && t.DataExecucao >= inicio
                && t.DataExecucao <= fim
            )
            .OrderBy(t => t.DataExecucao)
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
                t.DataExecucao,
                t.Descricao
            ))
            .ToListAsync(ct);

        return new RelatorioMensalResponse(
            inicio,
            inicio,
            fim,
            hoje <= fim,
            limiarVariacao,
            valorMinimo,
            Resumir(doMes),
            Resumir(doAnterior),
            pagamentosNoMes,
            aprovados.Count,
            aprovados.Sum(),
            porConta,
            categorias,
            despesas,
            concentracaoTop3,
            transferencias,
            await _pendencias.ContarAsync(condominioId, ct)
        );
    }
}
