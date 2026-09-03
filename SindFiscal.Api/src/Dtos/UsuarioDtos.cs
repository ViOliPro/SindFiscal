using SindFiscal.Data.Enums;

namespace SindFiscal.Dtos;

public record UsuarioResponse(Guid Id, string Nome, string Email, PapelUsuario Papel, bool Ativo);

public record CriarColaboradorRequest(string Nome, string Email, string SenhaProvisoria);

public record LoginRequest(string Email, string Senha);

public record LoginResponse(string Token, UsuarioResponse Usuario);
