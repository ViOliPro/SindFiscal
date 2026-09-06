using Microsoft.EntityFrameworkCore;
using SindFiscal.Data;
using SindFiscal.Data.Enums;

namespace SindFiscal.Services;

/// <summary>
/// RF13, RN11 — fila de execução para compromissos aprovados aguardando caixa.
/// Deliberadamente simples: nesta fase não há critério automático de
/// priorização (o cliente decidiu adiar essa definição até que o uso real
/// revele os cenários que de fato importam). Este serviço só oferece
/// reordenação manual — não tente "inferir" prioridade aqui por categoria,
/// valor ou urgência sem antes revisitar RN11 com o cliente.
/// </summary>
public class FilaExecucaoService
{
    private readonly AppDbContext _db;

    public FilaExecucaoService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>Move um compromisso aprovado para o fim da fila de execução do seu condomínio.</summary>
    public async Task EntrarNaFilaAsync(Guid compromissoId, CancellationToken ct = default)
    {
        var compromisso = await _db.CompromissosFinanceiros.FindAsync(new object?[] { compromissoId }, ct)
            ?? throw new InvalidOperationException("Compromisso não encontrado.");

        var maiorPrioridadeAtual = await _db.CompromissosFinanceiros
            .Where(c => c.CondominioId == compromisso.CondominioId && c.PrioridadeFila != null)
            .Select(c => (int?)c.PrioridadeFila)
            .MaxAsync(ct) ?? 0;

        compromisso.Status = StatusCompromisso.EmFilaExecucao;
        compromisso.PrioridadeFila = maiorPrioridadeAtual + 1;
        compromisso.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// RF13 — reordenação manual e livre pelo síndico. A lista recebida define a
    /// nova ordem integral da fila daquele condomínio (índice 0 = maior prioridade).
    /// </summary>
    public async Task ReordenarAsync(Guid condominioId, IReadOnlyList<Guid> compromissoIdsEmOrdem, CancellationToken ct = default)
    {
        var compromissos = await _db.CompromissosFinanceiros
            .Where(c => c.CondominioId == condominioId && c.Status == StatusCompromisso.EmFilaExecucao)
            .ToDictionaryAsync(c => c.Id, ct);

        if (compromissoIdsEmOrdem.Count != compromissos.Count || compromissoIdsEmOrdem.Any(id => !compromissos.ContainsKey(id)))
        {
            throw new InvalidOperationException(
                "A lista enviada precisa conter exatamente os compromissos atualmente em fila deste condomínio.");
        }

        for (var indice = 0; indice < compromissoIdsEmOrdem.Count; indice++)
        {
            compromissos[compromissoIdsEmOrdem[indice]].PrioridadeFila = indice;
        }

        await _db.SaveChangesAsync(ct);
    }
}
