using Microsoft.EntityFrameworkCore;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Entities;

namespace SindFiscal.Services;

/// <summary>
/// RF14, RN17–RN22 — é aqui que a "área de acerto" deixa de ser conceito e vira
/// comportamento: detecta divergência entre o fundo responsável por um pagamento
/// e a conta que efetivamente pagou (reposição), soma reservas de um período para
/// gerar destinação de receita, e administra o saldo acumulado de aporte pendente.
///
/// Ponto de atenção para quem for implementar: os três motivos (reposição, aporte,
/// destinação de receita) têm gatilhos DIFERENTES — reposição nasce de um Pagamento,
/// aporte nasce de uma política periódica do fundo, destinação de receita nasce de
/// uma agregação de Reservas. Não tente unificar os três em um único método genérico
/// "gerar transferência" sem esses parâmetros de entrada distintos — a Especificação
/// (RF14) já registrou essa distinção como deliberada, não acidental.
/// </summary>
public class AreaDeAcertoService
{
    private readonly AppDbContext _db;

    public AreaDeAcertoService(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// RN19 — chamado logo após um Pagamento ser registrado (RF11). Se o fundo
    /// responsável divergir da conta que efetivamente pagou, cria automaticamente
    /// um item de reposição pendente na área de acerto.
    /// </summary>
    public async Task<Transferencia?> GerarReposicaoSeNecessarioAsync(Pagamento pagamento, CancellationToken ct = default)
    {
        var condominio = await _db.CompromissosFinanceiros
            .Where(c => c.Id == pagamento.CompromissoId)
            .Select(c => c.CondominioId)
            .SingleAsync(ct);

        // Conta que efetivamente pagou: a do lançamento reconciliado, se houver;
        // senão, assume-se a conta operacional do condomínio (RN19: "tipicamente
        // a conta operacional, já que a administradora quase sempre movimenta por ela").
        Guid contaQuePagouId;
        if (pagamento.LancamentoId is Guid lancamentoId)
        {
            contaQuePagouId = await _db.Lancamentos
                .Where(l => l.Id == lancamentoId)
                .Select(l => l.ContaBancariaId)
                .SingleAsync(ct);
        }
        else
        {
            contaQuePagouId = await _db.ContasBancarias
                .Where(c => c.CondominioId == condominio && c.EhContaOperacional)
                .Select(c => c.Id)
                .SingleAsync(ct);
        }

        if (contaQuePagouId == pagamento.FundoResponsavelId)
        {
            // RN22 (status "sem_ajuste") — fundo responsável e conta de saída coincidem,
            // nenhuma pendência é criada.
            return null;
        }

        var transferencia = new Transferencia
        {
            Id = Guid.NewGuid(),
            CondominioId = condominio,
            ContaOrigemId = pagamento.FundoResponsavelId, // o fundo precisa repor
            ContaDestinoId = contaQuePagouId,              // de volta para quem pagou de fato
            Valor = pagamento.Valor,
            Tipo = TipoTransferencia.Individual,            // RN17 — padrão individual
            Modo = ModoTransferencia.ChecklistManual,       // nenhum condomínio com API nesta versão (RF15)
            Origem = OrigemTransferencia.SugeridaPeloSistema,
            Motivo = MotivoTransferencia.Reposicao,
            Status = StatusTransferencia.Pendente,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        _db.Transferencias.Add(transferencia);
        _db.Add(new TransferenciaPagamento { TransferenciaId = transferencia.Id, PagamentoId = pagamento.Id });
        await _db.SaveChangesAsync(ct);
        return transferencia;
    }

    /// <summary>
    /// RF21 -> RF14(c), RN22, RN23 — fecha um período de reservas de um fundo:
    /// soma o valor líquido de todas as reservas do período (RN23: o valor não
    /// muda com o desconto de pontualidade) e gera um único item de destinação
    /// de receita consolidando todas elas (RN17: consolidação é opcional para
    /// reposição, mas aqui a agregação por período já nasce consolidada por
    /// natureza — o síndico ainda pode, se quiser, desfazer e tratar
    /// individualmente antes de confirmar a execução).
    /// </summary>
    public async Task<Transferencia> FecharPeriodoReservasAsync(
        Guid condominioId, Guid fundoDestinoId, DateOnly periodoReferencia, CancellationToken ct = default)
    {
        var reservasDoPeriodo = await _db.Reservas
            .Where(r => r.CondominioId == condominioId
                     && r.FundoDestinoId == fundoDestinoId
                     && r.PeriodoReferencia == periodoReferencia)
            .ToListAsync(ct);

        if (reservasDoPeriodo.Count == 0)
        {
            throw new InvalidOperationException(
                "Nenhuma reserva encontrada para este fundo/período — nada a fechar.");
        }

        var contaOperacionalId = await _db.ContasBancarias
            .Where(c => c.CondominioId == condominioId && c.EhContaOperacional)
            .Select(c => c.Id)
            .SingleAsync(ct);

        var valorTotal = reservasDoPeriodo.Sum(r => r.ValorDestinadoAoFundo); // RN23

        var transferencia = new Transferencia
        {
            Id = Guid.NewGuid(),
            CondominioId = condominioId,
            ContaOrigemId = contaOperacionalId,
            ContaDestinoId = fundoDestinoId,
            Valor = valorTotal,
            Tipo = TipoTransferencia.Total, // já nasce consolidada (soma do período)
            Modo = ModoTransferencia.ChecklistManual,
            Origem = OrigemTransferencia.SugeridaPeloSistema,
            Motivo = MotivoTransferencia.DestinacaoReceita,
            Status = StatusTransferencia.Pendente,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        _db.Transferencias.Add(transferencia);
        foreach (var reserva in reservasDoPeriodo)
        {
            _db.Add(new TransferenciaReserva { TransferenciaId = transferencia.Id, ReservaId = reserva.Id });
        }
        await _db.SaveChangesAsync(ct);
        return transferencia;
    }

    /// <summary>
    /// RN20, RN21 — calcula o aporte esperado do período para um fundo e o
    /// ACUMULA em AportePendenteAcumulado, sem criar pendência obrigatória
    /// (aporte pode ser pulado quando o fundo atinge o teto, ou adiado por
    /// decisão do síndico). A criação de fato do item de transferência só
    /// acontece quando o síndico decide compensar (ver
    /// <see cref="ExecutarCompensacaoAporteAsync"/>).
    ///
    /// PONTO EM ABERTO DE PRODUTO (documentar antes de implementar de verdade):
    /// quando RegraAporteTipo = Percentual, "percentual de quê" (RN20 diz
    /// "percentual da receita, por exemplo") ainda não foi fechado com o
    /// cliente — este método recebe a base de cálculo como parâmetro
    /// (<paramref name="baseDeCalculoPercentual"/>) em vez de assumir uma
    /// fonte fixa, exatamente para não travar a decisão aqui.
    /// </summary>
    public async Task AcumularAportePeriodoAsync(
        Guid fundoId, decimal? baseDeCalculoPercentual = null, CancellationToken ct = default)
    {
        var fundo = await _db.ContasBancarias.FindAsync(new object?[] { fundoId }, ct)
            ?? throw new InvalidOperationException("Fundo não encontrado.");

        if (fundo.RegraAporteTipo is null || fundo.RegraAporteValor is null)
        {
            return; // fundo sem regra de aporte configurada (RF04: opcional)
        }

        var valorAporteEsperado = fundo.RegraAporteTipo == TipoRegraAporte.ValorFixo
            ? fundo.RegraAporteValor.Value
            : (baseDeCalculoPercentual ?? 0m) * (fundo.RegraAporteValor.Value / 100m);

        if (fundo.TetoMaximo is decimal teto && fundo.SaldoAtual + fundo.AportePendenteAcumulado >= teto)
        {
            // RN20 — teto atingido: aporte deste período é dispensado, não vira pendência.
            return;
        }

        fundo.AportePendenteAcumulado += valorAporteEsperado;
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// RN21 — o síndico decide compensar total ou parcialmente o aporte
    /// pendente acumulado, em uma única transferência ou em múltiplas
    /// (chamando este método mais de uma vez com valores parciais).
    /// </summary>
    public async Task<Transferencia> ExecutarCompensacaoAporteAsync(
        Guid fundoId, decimal valorAExecutar, CancellationToken ct = default)
    {
        var fundo = await _db.ContasBancarias.FindAsync(new object?[] { fundoId }, ct)
            ?? throw new InvalidOperationException("Fundo não encontrado.");

        if (valorAExecutar <= 0 || valorAExecutar > fundo.AportePendenteAcumulado)
        {
            throw new InvalidOperationException(
                "Valor a executar deve ser positivo e não pode exceder o aporte pendente acumulado.");
        }

        var contaOperacionalId = await _db.ContasBancarias
            .Where(c => c.CondominioId == fundo.CondominioId && c.EhContaOperacional)
            .Select(c => c.Id)
            .SingleAsync(ct);

        var transferencia = new Transferencia
        {
            Id = Guid.NewGuid(),
            CondominioId = fundo.CondominioId,
            ContaOrigemId = contaOperacionalId,
            ContaDestinoId = fundo.Id,
            Valor = valorAExecutar,
            Tipo = TipoTransferencia.Total,
            Modo = ModoTransferencia.ChecklistManual,
            Origem = OrigemTransferencia.SugeridaPeloSistema,
            Motivo = MotivoTransferencia.Aporte,
            Status = StatusTransferencia.Pendente,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        fundo.AportePendenteAcumulado -= valorAExecutar;
        _db.Transferencias.Add(transferencia);
        await _db.SaveChangesAsync(ct);
        return transferencia;
    }

    /// <summary>RF14 — síndico confirma que executou manualmente no site da administradora, atualizando os saldos.</summary>
    public async Task ConfirmarExecucaoAsync(Guid transferenciaId, DateOnly dataExecucao, CancellationToken ct = default)
    {
        var transferencia = await _db.Transferencias.FindAsync(new object?[] { transferenciaId }, ct)
            ?? throw new InvalidOperationException("Transferência não encontrada.");

        if (transferencia.Status == StatusTransferencia.Ajustado)
        {
            throw new InvalidOperationException("Esta transferência já foi confirmada.");
        }

        var contaOrigem = await _db.ContasBancarias.FindAsync(new object?[] { transferencia.ContaOrigemId }, ct)
            ?? throw new InvalidOperationException("Conta de origem não encontrada.");
        var contaDestino = await _db.ContasBancarias.FindAsync(new object?[] { transferencia.ContaDestinoId }, ct)
            ?? throw new InvalidOperationException("Conta de destino não encontrada.");

        contaOrigem.SaldoAtual -= transferencia.Valor;
        contaDestino.SaldoAtual += transferencia.Valor;
        transferencia.Status = StatusTransferencia.Ajustado;
        transferencia.DataExecucao = dataExecucao;
        transferencia.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
    }
}
