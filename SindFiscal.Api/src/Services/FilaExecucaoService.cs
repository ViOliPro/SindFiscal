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
    public async Task EntrarNaFilaAsync(
        Guid condominioId,
        Guid compromissoId,
        CancellationToken ct = default
    )
    {
        var compromisso =
            await _db.CompromissosFinanceiros.FirstOrDefaultAsync(
                c => c.Id == compromissoId && c.CondominioId == condominioId,
                ct
            )
            ?? throw new InvalidOperationException("Compromisso não encontrado neste condomínio.");

        if (compromisso.Status == StatusCompromisso.EmFilaExecucao)
            return; // já na fila — no-op

        if (
            compromisso.Status
            is not (StatusCompromisso.AguardandoExecucao or StatusCompromisso.EmExecucao)
        )
        {
            throw new InvalidOperationException(
                $"Status atual ({compromisso.Status}) não permite entrar na fila."
            );
        }

        var maiorPrioridadeAtual =
            await _db
                .CompromissosFinanceiros.Where(c =>
                    c.CondominioId == condominioId && c.PrioridadeFila != null
                )
                .Select(c => (int?)c.PrioridadeFila)
                .MaxAsync(ct)
            ?? 0;

        compromisso.Status = StatusCompromisso.EmFilaExecucao;
        compromisso.PrioridadeFila = maiorPrioridadeAtual + 1;
        compromisso.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Adia: remove da fila e volta para AguardandoExecucao (libera prioridade).
    /// Antes só reordenava para o fim — agora sai da fila de fato.
    /// </summary>
    public async Task AdiarAsync(
        Guid condominioId,
        Guid compromissoId,
        CancellationToken ct = default
    )
    {
        var compromisso =
            await _db.CompromissosFinanceiros.FirstOrDefaultAsync(
                c => c.Id == compromissoId && c.CondominioId == condominioId,
                ct
            ) ?? throw new InvalidOperationException("Compromisso não encontrado.");

        if (compromisso.Status != StatusCompromisso.EmFilaExecucao)
            throw new InvalidOperationException(
                "Só é possível adiar um compromisso que já está na fila de execução."
            );

        compromisso.Status = StatusCompromisso.AguardandoExecucao;
        compromisso.PrioridadeFila = null;
        compromisso.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>Sai da fila sem concluir — volta para AguardandoExecucao.</summary>
    public async Task SairDaFilaAsync(
        Guid condominioId,
        Guid compromissoId,
        CancellationToken ct = default
    )
    {
        await AdiarAsync(condominioId, compromissoId, ct);
    }

    /// <summary>Inicia execução: EmFilaExecucao → EmExecucao.</summary>
    public async Task IniciarExecucaoAsync(
        Guid condominioId,
        Guid compromissoId,
        CancellationToken ct = default
    )
    {
        var compromisso =
            await _db.CompromissosFinanceiros.FirstOrDefaultAsync(
                c => c.Id == compromissoId && c.CondominioId == condominioId,
                ct
            ) ?? throw new InvalidOperationException("Compromisso não encontrado.");

        if (compromisso.Status is not (StatusCompromisso.EmFilaExecucao or StatusCompromisso.AguardandoExecucao))
            throw new InvalidOperationException(
                $"Status atual ({compromisso.Status}) não permite iniciar execução."
            );

        compromisso.Status = StatusCompromisso.EmExecucao;
        compromisso.PrioridadeFila = null;
        compromisso.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>Conclui o compromisso (qualquer status não-terminal).</summary>
    public async Task ConcluirAsync(
        Guid condominioId,
        Guid compromissoId,
        CancellationToken ct = default
    )
    {
        var compromisso =
            await _db.CompromissosFinanceiros.FirstOrDefaultAsync(
                c => c.Id == compromissoId && c.CondominioId == condominioId,
                ct
            ) ?? throw new InvalidOperationException("Compromisso não encontrado.");

        if (compromisso.Status is StatusCompromisso.Cancelado or StatusCompromisso.Concluido)
            throw new InvalidOperationException(
                $"Compromisso já está {compromisso.Status}."
            );

        compromisso.Status = StatusCompromisso.Concluido;
        compromisso.PrioridadeFila = null;
        compromisso.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task ReordenarAsync(
        Guid condominioId,
        IReadOnlyList<Guid> compromissoIdsEmOrdem,
        CancellationToken ct = default
    )
    {
        var compromissos = await _db
            .CompromissosFinanceiros.Where(c =>
                c.CondominioId == condominioId && c.Status == StatusCompromisso.EmFilaExecucao
            )
            .ToDictionaryAsync(c => c.Id, ct);

        if (
            compromissoIdsEmOrdem.Count != compromissos.Count
            || compromissoIdsEmOrdem.Any(id => !compromissos.ContainsKey(id))
        )
        {
            throw new InvalidOperationException(
                "A lista enviada precisa conter exatamente os compromissos atualmente em fila deste condomínio."
            );
        }

        for (var indice = 0; indice < compromissoIdsEmOrdem.Count; indice++)
        {
            compromissos[compromissoIdsEmOrdem[indice]].PrioridadeFila = indice;
        }

        await _db.SaveChangesAsync(ct);
    }
}
