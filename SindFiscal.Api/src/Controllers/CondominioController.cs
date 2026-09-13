using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>RF02, RF03 — condomínios do síndico (módulo 11, exclusivo síndico).</summary>
[ApiController]
[Route("api/condominios")]
public class CondominioController : ControllerBase
{
    private readonly AppDbContext _db;

    public CondominioController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CondominioResponse>>> Listar(CancellationToken ct)
    {
        var usuarioId = UsuarioId();
        if (usuarioId is null) return Unauthorized();

        var usuario = await _db.Usuarios.FindAsync(new object[] { usuarioId.Value }, ct);
        if (usuario is null) return Unauthorized();

        IQueryable<Condominio> query = _db.Condominios;

        if (usuario.Papel == PapelUsuario.Sindico)
            query = query.Where(c => c.SindicoId == usuarioId);
        else
        {
            var ids = await _db.Permissoes
                .Where(p => p.UsuarioId == usuarioId)
                .Select(p => p.CondominioId)
                .Distinct()
                .ToListAsync(ct);
            query = query.Where(c => ids.Contains(c.Id));
        }

        var lista = await query.OrderBy(c => c.Nome).ToListAsync(ct);
        return Ok(lista.Select(ParaResponse).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<CondominioResponse>> Criar(
        CriarCondominioRequest request, CancellationToken ct)
    {
        var usuarioId = UsuarioId();
        if (usuarioId is null) return Unauthorized();

        var usuario = await _db.Usuarios.FindAsync(new object[] { usuarioId.Value }, ct);
        if (usuario is null || usuario.Papel != PapelUsuario.Sindico)
            return Forbid();

        var condominio = new Condominio
        {
            Id = Guid.NewGuid(),
            SindicoId = usuarioId.Value,
            Nome = request.Nome.Trim(),
            PossuiIntegracaoApi = false,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Condominios.Add(condominio);

        _db.ConfiguracoesIntegracao.Add(new ConfiguracaoIntegracao
        {
            Id = Guid.NewGuid(),
            CondominioId = condominio.Id,
            TipoFonteVerdade = TipoFonteVerdade.Manual,
            PermiteTransferenciaAutomatica = false,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(Listar), null, ParaResponse(condominio));
    }

    /// <summary>RN07 — inclui a alçada de aprovação (RF10), configurável e sem padrão único entre condomínios.</summary>
    [HttpPut("{condominioId:guid}")]
    public async Task<ActionResult<CondominioResponse>> Atualizar(
        Guid condominioId, AtualizarCondominioRequest request, CancellationToken ct)
    {
        var usuarioId = UsuarioId();
        if (usuarioId is null) return Unauthorized();

        if (request.ValorAlcadaAprovacao is < 0)
            return BadRequest("Valor de alçada não pode ser negativo.");

        var c = await _db.Condominios.FirstOrDefaultAsync(
            x => x.Id == condominioId && x.SindicoId == usuarioId, ct);
        if (c is null) return NotFound();

        c.Nome = request.Nome.Trim();
        c.ValorAlcadaAprovacao = request.ValorAlcadaAprovacao;
        c.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ParaResponse(c));
    }

    private static CondominioResponse ParaResponse(Condominio c) =>
        new(c.Id, c.Nome, c.PossuiIntegracaoApi, c.ValorAlcadaAprovacao);

    private Guid? UsuarioId()
    {
        var claim = User.FindFirst("usuario_id")?.Value;
        return claim is not null && Guid.TryParse(claim, out var id) ? id : null;
    }
}
