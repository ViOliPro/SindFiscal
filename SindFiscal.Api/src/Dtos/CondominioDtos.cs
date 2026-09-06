namespace SindFiscal.Dtos;

public record CondominioResponse(Guid Id, string Nome, bool PossuiIntegracaoApi);

public record CriarCondominioRequest(string Nome);

public record AtualizarCondominioRequest(string Nome);
