namespace SindFiscal.Authorization;

/// <summary>
/// Helper compartilhado para extrair o id do usuário autenticado a partir da
/// claim "usuario_id" do JWT (ver AuthController). Centraliza uma lógica que
/// estava duplicada como método privado em vários controllers.
/// </summary>
public static class HttpContextExtensions
{
    /// <summary>
    /// Retorna o id do usuário autenticado. Deve ser chamado apenas em
    /// endpoints já protegidos por autenticação/[RequerPermissao] — nesses
    /// casos a claim sempre existe; lança exceção caso contrário para
    /// evitar um NotFound silencioso mascarando um problema de configuração.
    /// </summary>
    public static Guid UsuarioIdAutenticado(this HttpContext httpContext)
    {
        var claim = httpContext.User.FindFirst("usuario_id")?.Value;
        if (claim is null || !Guid.TryParse(claim, out var usuarioId))
        {
            throw new InvalidOperationException(
                "Claim 'usuario_id' ausente ou inválida — endpoint deveria estar protegido por autenticação."
            );
        }
        return usuarioId;
    }

    /// <summary>Variante que retorna null em vez de lançar exceção, para checagens opcionais.</summary>
    public static Guid? UsuarioIdAutenticadoOuNulo(this HttpContext httpContext)
    {
        var claim = httpContext.User.FindFirst("usuario_id")?.Value;
        return claim is not null && Guid.TryParse(claim, out var usuarioId) ? usuarioId : null;
    }
}
