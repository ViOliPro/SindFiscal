using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

public record TransferenciaResponse(
    Guid Id,
    Guid ContaOrigemId,
    string ContaOrigemNome,
    Guid ContaDestinoId,
    string ContaDestinoNome,
    decimal Valor,
    TipoTransferencia Tipo,
    ModoTransferencia Modo,
    OrigemTransferencia Origem,
    MotivoTransferencia Motivo,
    StatusTransferencia Status,
    DateOnly? DataExecucao
);

/// <summary>
/// RF14, RN17 — o síndico pode agrupar (somar) N itens pendentes individuais em uma
/// única transferência a executar. Os itens de origem precisam ter o mesmo motivo,
/// conta de origem e conta de destino.
/// </summary>
public record ConsolidarItensDeAcertoRequest(IReadOnlyList<Guid> TransferenciaIdsParaConsolidar);

/// <summary>RF14 — síndico confirma que executou manualmente no site da administradora.</summary>
public record ConfirmarTransferenciaExecutadaRequest(DateOnly DataExecucao);

/// <summary>Visão agrupada da área de acerto, separada por motivo (RF14 a/b/c).</summary>
public record AreaDeAcertoResponse(
    IReadOnlyList<TransferenciaResponse> Reposicoes,
    IReadOnlyList<TransferenciaResponse> Aportes,
    IReadOnlyList<TransferenciaResponse> DestinacoesReceita
);

/// <summary>
/// RN20 — calcula o aporte esperado do período para um fundo e o acumula em
/// AportePendenteAcumulado (sem gerar pendência obrigatória — pode ser
/// dispensado no teto, ou ficar acumulado até o síndico decidir compensar).
/// BaseDeCalculoPercentual só é usado quando o fundo tem RegraAporteTipo =
/// percentual (ver nota de ponto em aberto em AreaDeAcertoService).
/// </summary>
public record AcumularAporteRequest(decimal? BaseDeCalculoPercentual);

/// <summary>RN21 — síndico decide compensar total ou parcialmente o aporte pendente acumulado de um fundo.</summary>
public record CompensarAporteRequest(decimal ValorAExecutar);
