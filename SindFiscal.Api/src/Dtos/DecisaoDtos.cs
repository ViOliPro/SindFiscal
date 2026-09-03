using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

public record DecisaoResponse(
    Guid Id,
    Guid NecessidadeId,
    Guid? CotacaoEscolhidaId,
    Guid ResponsavelId,
    DateOnly Data,
    ResultadoDecisao Resultado,
    string? Justificativa,
    string? ReferenciaRespaldo
);

/// <summary>
/// RF09 — sempre cria um NOVO registro de decisão (nunca atualiza um existente),
/// preservando o histórico mesmo quando o resultado muda (RN09).
/// Se Resultado = Aprovado, o controller também cria o CompromissoFinanceiro (RF10).
/// </summary>
public record RegistrarDecisaoRequest(
    Guid? CotacaoEscolhidaId,
    ResultadoDecisao Resultado,
    string? Justificativa,
    string? ReferenciaRespaldo,
    DateOnly Data
);
