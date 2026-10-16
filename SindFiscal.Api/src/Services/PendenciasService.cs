using Microsoft.EntityFrameworkCore;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Services;

/// <summary>
/// RF17, RNF07, RNF12 — pendências de consistência. Inspirado na marcação
/// "fonte não definida" do relatório FISCAL: gasto que saiu do caixa sem fundo
/// responsável. Aqui isso aparece de três formas: saída real sem pagamento
/// vinculado, compromisso aberto sem fundo previsto e necessidade sem valor.
/// As consultas são montadas uma vez (Q*) e servem tanto à contagem quanto à lista.
/// </summary>
public class PendenciasService
{
    private const int LimitePorTipo = 200;
    private readonly AppDbContext _db;

    public PendenciasService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Saída real, não estornada e não dispensada, sem nenhum pagamento vinculado.
    /// Estornos (e as saídas que foram estornadas) não contam.
    /// </summary>
    private IQueryable<Lancamento> QLancamentos(Guid condominioId, DateOnly? desde)
    {
        var q = _db.Lancamentos.AsNoTracking()
            .Where(l =>
                l.ContaBancaria.CondominioId == condominioId
                && l.Origem == OrigemLancamento.Real
                && l.Tipo == TipoLancamento.Saida
                && l.EstornoDeId == null
                && !l.ConciliacaoDispensada
                && !l.Pagamentos.Any()
                && !_db.Lancamentos.Any(e => e.EstornoDeId == l.Id)
            );
        if (desde is DateOnly d)
            q = q.Where(l => l.Data >= d);
        return q;
    }

    private IQueryable<CompromissoFinanceiro> QCompromissos(Guid condominioId) =>
        _db.CompromissosFinanceiros.AsNoTracking()
            .Where(c =>
                c.CondominioId == condominioId
                && c.CompromissoPaiId == null
                && DespesasFuturasService.StatusAbertos.Contains(c.Status)
                && c.FundoPrevistoId == null
                && !c.Pagamentos.Any()
            );

    private IQueryable<Necessidade> QNecessidades(Guid condominioId) =>
        _db.Necessidades.AsNoTracking()
            .Where(n =>
                n.CondominioId == condominioId
                && DespesasFuturasService.SituacoesPlanejaveis.Contains(n.Situacao)
                && n.ValorEstimado == null
                && !n.Cotacoes.Any()
                && !n.Compromissos.Any(c => c.Status != StatusCompromisso.Cancelado)
            );

    public async Task<int> ContarAsync(Guid condominioId, CancellationToken ct = default)
    {
        var a = await QLancamentos(condominioId, null).CountAsync(ct);
        var b = await QCompromissos(condominioId).CountAsync(ct);
        var c = await QNecessidades(condominioId).CountAsync(ct);
        return a + b + c;
    }

    public async Task<PendenciasResponse> ListarAsync(
        Guid condominioId,
        DateOnly? desde,
        CancellationToken ct = default
    )
    {
        var qL = QLancamentos(condominioId, desde);
        var qtdL = await qL.CountAsync(ct);
        var lancamentos = await qL
            .OrderByDescending(l => l.Data)
            .Take(LimitePorTipo)
            .Select(l => new
            {
                l.Id,
                l.Descricao,
                l.Valor,
                l.Data,
                Conta = l.ContaBancaria.Nome,
            })
            .ToListAsync(ct);

        var qC = QCompromissos(condominioId);
        var qtdC = await qC.CountAsync(ct);
        var compromissos = await qC
            .OrderByDescending(c => c.ValorAprovado)
            .Take(LimitePorTipo)
            .Select(c => new
            {
                c.Id,
                Descricao = c.Necessidade != null ? c.Necessidade.Descricao : c.Categoria,
                c.ValorAprovado,
                c.DataPrevista,
                c.Categoria,
            })
            .ToListAsync(ct);

        var qN = QNecessidades(condominioId);
        var qtdN = await qN.CountAsync(ct);
        var necessidades = await qN
            .OrderBy(n => n.Descricao)
            .Take(LimitePorTipo)
            .Select(n => new
            {
                n.Id,
                n.Descricao,
                n.Categoria,
                n.DataPrevista,
            })
            .ToListAsync(ct);

        var itens = new List<PendenciaResponse>();
        itens.AddRange(
            lancamentos.Select(l => new PendenciaResponse(
                TipoPendencia.LancamentoSemPagamento,
                l.Id,
                string.IsNullOrWhiteSpace(l.Descricao) ? "Saída sem descrição" : l.Descricao!,
                l.Valor,
                l.Data,
                $"Conta: {l.Conta}. Sem pagamento vinculado, o fundo responsável não está definido."
            ))
        );
        itens.AddRange(
            compromissos.Select(c => new PendenciaResponse(
                TipoPendencia.CompromissoSemFundo,
                c.Id,
                c.Descricao,
                c.ValorAprovado,
                c.DataPrevista,
                $"{c.Categoria}. Defina o fundo previsto para entrar na projeção por fundo."
            ))
        );
        itens.AddRange(
            necessidades.Select(n => new PendenciaResponse(
                TipoPendencia.NecessidadeSemValor,
                n.Id,
                n.Descricao,
                null,
                n.DataPrevista,
                $"{n.Categoria}. Sem valor estimado nem cotação: não pesa na projeção."
            ))
        );

        return new PendenciasResponse(qtdL + qtdC + qtdN, qtdL, qtdC, qtdN, itens);
    }
}
