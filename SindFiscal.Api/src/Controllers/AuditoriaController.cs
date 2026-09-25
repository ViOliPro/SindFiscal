using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Authorization;
using SindFiscal.Data;
using SindFiscal.Dtos;

namespace SindFiscal.Controllers;

/// <summary>
/// RF19, RNF04, RNF14 — leitura do rastro de auditoria. Não existe (nem deve
/// existir) endpoint de escrita aqui: a tabela é populada automaticamente
/// pelo AuditoriaSaveChangesInterceptor a cada SaveChanges, nunca por ação
/// direta de um controller (RNF14 — evento de auditoria é imutável).
/// Módulo "auditoria" é sempre somente leitura, mesmo para quem tem "editar"
/// em outros módulos (RNF14/Seção 4.1) — por isso [RequerPermissao] aqui
/// nunca é usado com NivelPermissao.Editar.
/// </summary>
[ApiController]
[Route("api/condominios/{condominioId:guid}/auditoria")]
[RequerPermissao(Modulos.Auditoria)]
public class AuditoriaController : ControllerBase
{
    private readonly AppDbContext _db;

    public AuditoriaController(AppDbContext db) => _db = db;

    /// <summary>
    /// Por padrão, lista o histórico do condomínio da rota. Quando
    /// entidadeTipo + entidadeId são informados, filtra por essa entidade
    /// específica (ex.: histórico de um Fornecedor, que não tem
    /// condominio_id próprio — RN04 — mas ainda é auditado).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RegistroAuditoriaResponse>>> Listar(
        Guid condominioId,
        [FromQuery] string? entidadeTipo,
        [FromQuery] Guid? entidadeId,
        [FromQuery] int limite,
        CancellationToken ct
    )
    {
        var tamanhoPagina = limite <= 0 ? 200 : Math.Clamp(limite, 1, 500);

        var query = _db.RegistrosAuditoria.AsQueryable();
        query =
            entidadeTipo is not null && entidadeId is Guid eid
                ? query.Where(r => r.EntidadeTipo == entidadeTipo && r.EntidadeId == eid)
                : query.Where(r => r.CondominioId == condominioId);

        var registros = await query
            .OrderByDescending(r => r.DataHora)
            .Take(tamanhoPagina)
            .Select(r => new RegistroAuditoriaResponse(
                r.Id,
                r.EntidadeTipo,
                r.EntidadeId,
                r.UsuarioId,
                r.Usuario.Nome,
                r.DataHora,
                r.CampoAlterado,
                r.ValorAnterior,
                r.ValorNovo
            ))
            .ToListAsync(ct);

        return Ok(registros);
    }
}
