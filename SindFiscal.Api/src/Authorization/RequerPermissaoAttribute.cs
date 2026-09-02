using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Data;
using SindFiscal.Data.Enums;

namespace SindFiscal.Authorization;

/// <summary>
/// RF03, RN23/RN29 — checa permissão granular por usuário/condomínio/módulo.
/// A rota da action precisa conter um parâmetro "condominioId" (ex.:
/// "condominios/{condominioId}/contas").
///
/// Síndico tem acesso pleno em todo condomínio que ele mesmo administra
/// (RF01/RF03) — não precisa de linha em Permissao para os próprios
/// condomínios. Colaborador e Conselheiro Fiscal dependem de uma linha em
/// Permissao (RN29, RN30).
///
/// Auditoria (módulo "auditoria") é sempre somente leitura — não existe
/// endpoint de escrita para ela (ver AuditoriaController), então este
/// atributo nunca é chamado com nivelMinimo = Editar para esse módulo.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequerPermissaoAttribute : Attribute, IAsyncActionFilter
{
    private readonly string _modulo;
    private readonly NivelPermissao _nivelMinimo;

    public RequerPermissaoAttribute(
        string modulo,
        NivelPermissao nivelMinimo = NivelPermissao.Visualizar
    )
    {
        _modulo = modulo;
        _nivelMinimo = nivelMinimo;
    }

    public async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next
    )
    {
        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();

        var usuarioIdClaim = context.HttpContext.User.FindFirst("usuario_id")?.Value;
        if (usuarioIdClaim is null || !Guid.TryParse(usuarioIdClaim, out var usuarioId))
        {
            context.Result = new UnauthorizedResult();
            return;
        }
        if (
            !context.RouteData.Values.TryGetValue("condominioId", out var condominioIdObj)
            || !Guid.TryParse(condominioIdObj?.ToString(), out var condominioId)
        )
        {
            context.Result = new BadRequestObjectResult(
                "Rota precisa conter {condominioId} para a checagem de permissão (RF03)."
            );
            return;
        }

        var usuario = await db.Usuarios.FindAsync(usuarioId);
        if (usuario is null || !usuario.Ativo)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        if (usuario.Papel == PapelUsuario.Sindico)
        {
            var administraEsteCondominio = await db.Condominios.AnyAsync(c =>
                c.Id == condominioId && c.SindicoId == usuarioId
            );
            if (administraEsteCondominio)
            {
                await next();
                return;
            }
        }

        var permissao = await db.Permissoes.FirstOrDefaultAsync(p =>
            p.UsuarioId == usuarioId && p.CondominioId == condominioId && p.Modulo == _modulo
        );

        if (permissao is null || (int)permissao.Nivel < (int)_nivelMinimo)
        {
            context.Result = new ForbidResult();
            return;
        }

        await next();
    }
}
