namespace SindFiscal.Dtos;

public record ReservaResponse(
    Guid Id,
    Guid FundoDestinoId,
    string Unidade,
    string MoradorNome,
    decimal ValorDestinadoAoFundo,
    bool? PagoComDesconto,
    DateOnly PeriodoReferencia
);

/// <summary>
/// RF21, RN23 — registro manual pela síndica, com base na lista que ela já levanta
/// (hoje via CondoMob) por volta do dia 25 de cada mês. ValorDestinadoAoFundo é o
/// valor líquido (ex.: R$ 250) e NÃO muda em função de PagoComDesconto — esse campo
/// é só informativo.
/// </summary>
public record RegistrarReservaRequest(
    Guid FundoDestinoId,
    string Unidade,
    string MoradorNome,
    decimal ValorDestinadoAoFundo,
    bool? PagoComDesconto,
    DateOnly PeriodoReferencia
);

/// <summary>
/// RF21 -> RF14 — fecha o período: soma todas as reservas do mês para um fundo e
/// gera (ou atualiza) o item de destinação de receita correspondente na área de acerto.
/// </summary>
public record FecharPeriodoReservasRequest(Guid FundoDestinoId, DateOnly PeriodoReferencia);
