using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

/// <summary>Um item que pede ação do síndico. ReferenciaId aponta para lançamento, compromisso ou necessidade, conforme o Tipo.</summary>
public record PendenciaResponse(
    TipoPendencia Tipo,
    Guid ReferenciaId,
    string Descricao,
    decimal? Valor,
    DateOnly? Data,
    string? Detalhe
);

/// <summary>
/// Contagens são totais reais; Itens vem limitado a 200 por tipo (mais recentes
/// primeiro nos lançamentos), para a tela não pesar em bases grandes.
/// </summary>
public record PendenciasResponse(
    int Total,
    int LancamentosSemPagamento,
    int CompromissosSemFundo,
    int NecessidadesSemValor,
    IReadOnlyList<PendenciaResponse> Itens
);

public record DispensarConciliacaoRequest(string Motivo);
