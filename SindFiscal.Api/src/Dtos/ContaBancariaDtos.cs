using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

public record ContaBancariaResponse(
    Guid Id,
    string Nome,
    FinalidadeConta Finalidade,
    bool EhContaOperacional,
    TipoRegraAporte? RegraAporteTipo,
    decimal? RegraAporteValor,
    decimal? TetoMaximo,
    decimal SaldoAtual,
    decimal AportePendenteAcumulado
);

public record CriarContaBancariaRequest(
    string Nome,
    FinalidadeConta Finalidade,
    bool EhContaOperacional,
    TipoRegraAporte? RegraAporteTipo,
    decimal? RegraAporteValor,
    decimal? TetoMaximo
);

public record AtualizarRegraAporteRequest(
    TipoRegraAporte? RegraAporteTipo,
    decimal? RegraAporteValor,
    decimal? TetoMaximo
);
