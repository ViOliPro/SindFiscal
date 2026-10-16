using Microsoft.EntityFrameworkCore;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;

namespace SindFiscal.Services;

/// <summary>
/// Filtros da listagem de despesas futuras. Itens sem data prevista aparecem
/// sempre (nunca somem por causa de um filtro de período), para não esconder risco.
/// </summary>
public record FiltroDespesasFuturas(
    Guid? FundoId = null,
    bool SemFundo = false,
    EtapaDespesaFutura? Etapa = null,
    Prioridade? Prioridade = null,
    DateOnly? De = null,
    DateOnly? Ate = null,
    string? Busca = null
);

/// <summary>
/// RF13, RF16, RNF07, RNF12 — lógica única de despesas futuras e projeção por
/// fundo. A listagem e a projeção usam exatamente o mesmo conjunto de itens
/// (CarregarItensAsync), então nunca divergem entre si.
///
/// Regras: item = necessidade ainda sem compromisso (Planejada) ou compromisso
/// "pai" aberto (Aprovada/Contratada). Gastos vinculados já são gasto realizado
/// e não entram. O valor que pesa no fundo é o que ainda não foi pago. A
/// prioridade categórica é só rótulo — não altera a fila (RN11).
/// </summary>
public class DespesasFuturasService
{
    private readonly AppDbContext _db;

    public DespesasFuturasService(AppDbContext db)
    {
        _db = db;
    }

    private static readonly StatusCompromisso[] StatusAbertos =
    {
        StatusCompromisso.AguardandoExecucao,
        StatusCompromisso.EmFilaExecucao,
        StatusCompromisso.EmExecucao,
    };

    private static readonly SituacaoNecessidade[] SituacoesPlanejaveis =
    {
        SituacaoNecessidade.EmAnalise,
        SituacaoNecessidade.EmOrcamento,
        SituacaoNecessidade.Adiado,
    };

    public async Task<ListaDespesasFuturasResponse> ListarAsync(
        Guid condominioId,
        FiltroDespesasFuturas filtro,
        CancellationToken ct = default
    )
    {
        var itens = await CarregarItensAsync(condominioId, ct);
        IEnumerable<DespesaFuturaResponse> q = itens;

        if (filtro.SemFundo)
            q = q.Where(i => i.FundoId is null);
        else if (filtro.FundoId is Guid fundoId)
            q = q.Where(i => i.FundoId == fundoId);

        if (filtro.Etapa is not null)
            q = q.Where(i => i.Etapa == filtro.Etapa);
        if (filtro.Prioridade is not null)
            q = q.Where(i => i.Prioridade == filtro.Prioridade);
        if (filtro.De is DateOnly de)
            q = q.Where(i => i.DataPrevista is null || i.DataPrevista >= de);
        if (filtro.Ate is DateOnly ate)
            q = q.Where(i => i.DataPrevista is null || i.DataPrevista <= ate);
        if (!string.IsNullOrWhiteSpace(filtro.Busca))
        {
            var termo = filtro.Busca.Trim();
            q = q.Where(i =>
                i.Descricao.Contains(termo, StringComparison.OrdinalIgnoreCase)
                || i.Categoria.Contains(termo, StringComparison.OrdinalIgnoreCase)
            );
        }

        // Ordenação de exibição (não é prioridade de execução — RN11): data prevista
        // (sem data por último), depois rótulo de prioridade (alta primeiro).
        var lista = q.OrderBy(i => i.DataPrevista is null)
            .ThenBy(i => i.DataPrevista)
            .ThenBy(i => i.Prioridade is null ? 3 : (int)i.Prioridade)
            .ThenBy(i => i.Descricao, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new ListaDespesasFuturasResponse(
            lista,
            lista.Count,
            lista.Sum(i => i.ValorProvisionado),
            lista.Where(i => i.Etapa != EtapaDespesaFutura.Planejada).Sum(i => i.ValorProvisionado),
            lista.Where(i => i.Etapa == EtapaDespesaFutura.Planejada).Sum(i => i.ValorProvisionado)
        );
    }

    public async Task<ProjecaoFundosResponse> ProjetarAsync(
        Guid condominioId,
        DateOnly? ate,
        CancellationToken ct = default
    )
    {
        var itens = (await CarregarItensAsync(condominioId, ct))
            .Where(i => ate is null || i.DataPrevista is null || i.DataPrevista <= ate)
            .ToList();

        var contas = await _db
            .ContasBancarias.AsNoTracking()
            .Where(c => c.CondominioId == condominioId)
            .OrderBy(c => c.Nome)
            .ToListAsync(ct);

        var fundos = contas
            .Select(c =>
            {
                var doFundo = itens.Where(i => i.FundoId == c.Id).ToList();
                var aprovado = doFundo
                    .Where(i => i.Etapa != EtapaDespesaFutura.Planejada)
                    .Sum(i => i.ValorProvisionado);
                var planejado = doFundo
                    .Where(i => i.Etapa == EtapaDespesaFutura.Planejada)
                    .Sum(i => i.ValorProvisionado);
                var projetado = c.SaldoAtual - aprovado - planejado;
                return new ProjecaoFundoResponse(
                    c.Id,
                    c.Nome,
                    c.Finalidade,
                    c.EhContaOperacional,
                    c.ConsideradoNoPlanejamento,
                    c.SaldoAtual,
                    aprovado,
                    planejado,
                    aprovado + planejado,
                    c.SaldoAtual - aprovado,
                    projetado,
                    projetado < 0,
                    projetado < 0 ? -projetado : 0m,
                    doFundo.Count
                );
            })
            .ToList();

        var considerados = fundos.Where(f => f.ConsideradoNoPlanejamento).ToList();
        var saldoDisponivel = considerados.Sum(f => f.SaldoAtual);
        var aprovados = considerados.Sum(f => f.ProvisionadoAprovado);
        var previsoes = considerados.Sum(f => f.ProvisionadoPlanejado);
        var aposAprovados = saldoDisponivel - aprovados;
        var aposTudo = aposAprovados - previsoes;

        var semFundo = itens.Where(i => i.FundoId is null).ToList();
        var idsConsiderados = considerados.Select(f => f.FundoId).ToHashSet();
        var foraDoPlanejamento = itens
            .Where(i => i.FundoId is Guid id && !idsConsiderados.Contains(id))
            .Sum(i => i.ValorProvisionado);

        return new ProjecaoFundosResponse(
            ate,
            saldoDisponivel,
            aprovados + previsoes,
            aprovados,
            previsoes,
            aposAprovados,
            aposTudo,
            aposTudo < 0 ? -aposTudo : 0m,
            considerados.Sum(f => f.DeficitProjetado),
            considerados.Count(f => f.EmDeficit),
            itens.Count,
            semFundo.Sum(i => i.ValorProvisionado),
            semFundo.Count,
            foraDoPlanejamento,
            fundos
        );
    }

    private async Task<List<DespesaFuturaResponse>> CarregarItensAsync(
        Guid condominioId,
        CancellationToken ct
    )
    {
        var nomesFundos = await _db
            .ContasBancarias.AsNoTracking()
            .Where(c => c.CondominioId == condominioId)
            .ToDictionaryAsync(c => c.Id, c => c.Nome, ct);

        string? NomeFundo(Guid? id) =>
            id is Guid g && nomesFundos.TryGetValue(g, out var nome) ? nome : null;

        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);
        var itens = new List<DespesaFuturaResponse>();

        var compromissos = await _db
            .CompromissosFinanceiros.AsNoTracking()
            .Include(c => c.Pagamentos)
            .Include(c => c.Necessidade)
            .Where(c =>
                c.CondominioId == condominioId
                && c.CompromissoPaiId == null
                && StatusAbertos.Contains(c.Status)
            )
            .ToListAsync(ct);

        foreach (var c in compromissos)
        {
            var pago = c.Pagamentos.Sum(p => p.Valor);
            var provisionado = Math.Max(0m, c.ValorAprovado - pago);
            // Sem fundo previsto, assume o fundo do último pagamento já feito.
            var fundoId =
                c.FundoPrevistoId
                ?? c.Pagamentos.OrderByDescending(p => p.Data)
                    .Select(p => (Guid?)p.FundoResponsavelId)
                    .FirstOrDefault();
            itens.Add(
                new DespesaFuturaResponse(
                    OrigemDespesaFutura.Compromisso,
                    c.Id,
                    c.Necessidade?.Descricao ?? c.Categoria,
                    c.Categoria,
                    c.Status == StatusCompromisso.EmExecucao
                        ? EtapaDespesaFutura.Contratada
                        : EtapaDespesaFutura.Aprovada,
                    c.Status,
                    null,
                    c.Prioridade ?? c.Necessidade?.Prioridade,
                    c.DataPrevista,
                    fundoId,
                    NomeFundo(fundoId),
                    c.ValorAprovado,
                    provisionado,
                    false,
                    null,
                    c.PrioridadeFila,
                    c.DataPrevista is DateOnly d && d < hoje
                )
            );
        }

        var necessidades = await _db
            .Necessidades.AsNoTracking()
            .Include(n => n.Cotacoes)
            .Where(n =>
                n.CondominioId == condominioId
                && SituacoesPlanejaveis.Contains(n.Situacao)
                && !n.Compromissos.Any(c => c.Status != StatusCompromisso.Cancelado)
            )
            .ToListAsync(ct);

        foreach (var n in necessidades)
        {
            var temCotacao = n.Cotacoes.Count > 0;
            var valor = n.ValorEstimado ?? (temCotacao ? n.Cotacoes.Min(c => c.Valor) : 0m);
            itens.Add(
                new DespesaFuturaResponse(
                    OrigemDespesaFutura.Necessidade,
                    n.Id,
                    n.Descricao,
                    n.Categoria,
                    EtapaDespesaFutura.Planejada,
                    null,
                    n.Situacao,
                    n.Prioridade,
                    n.DataPrevista,
                    n.FundoPrevistoId,
                    NomeFundo(n.FundoPrevistoId),
                    valor,
                    valor,
                    n.ValorEstimado is null && !temCotacao,
                    n.Cotacoes.Count,
                    null,
                    n.DataPrevista is DateOnly d && d < hoje
                )
            );
        }

        return itens;
    }
}
