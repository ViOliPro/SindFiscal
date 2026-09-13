using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>RF03 — colaboradores e permissões (módulo 11, exclusivo síndico).</summary>
[ApiController]
[Route("api")]
public class UsuarioController : ControllerBase
{
    private readonly AppDbContext _db;

    public UsuarioController(AppDbContext db) => _db = db;

    [HttpGet("usuarios")]
    public async Task<ActionResult<IReadOnlyList<UsuarioResponse>>> Listar(CancellationToken ct)
    {
        var sindicoId = await GarantirSindico(ct);
        if (sindicoId is null) return Forbid();

        var condominioIds = await _db.Condominios
            .Where(c => c.SindicoId == sindicoId)
            .Select(c => c.Id)
            .ToListAsync(ct);

        var colaboradorIds = await _db.Permissoes
            .Where(p => condominioIds.Contains(p.CondominioId))
            .Select(p => p.UsuarioId)
            .Distinct()
            .ToListAsync(ct);

        var usuarios = await _db.Usuarios
            .Where(u => u.Id == sindicoId || colaboradorIds.Contains(u.Id))
            .OrderBy(u => u.Nome)
            .ToListAsync(ct);

        return Ok(usuarios.Select(u =>
            new UsuarioResponse(u.Id, u.Nome, u.Email, u.Papel, u.Ativo)).ToList());
    }

    [HttpPost("usuarios/colaboradores")]
    public async Task<ActionResult<UsuarioResponse>> CriarColaborador(
        CriarColaboradorRequest request, CancellationToken ct)
    {
        var sindicoId = await GarantirSindico(ct);
        if (sindicoId is null) return Forbid();

        if (await _db.Usuarios.AnyAsync(u => u.Email == request.Email, ct))
            return Conflict(new { message = "E-mail já cadastrado." });

        var usuario = new Usuario
        {
            Id = Guid.NewGuid(),
            Nome = request.Nome.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            Papel = PapelUsuario.Colaborador,
            Ativo = true,
            SenhaHash = AuthController.HashSenha(request.SenhaProvisoria),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Usuarios.Add(usuario);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Listar), null,
            new UsuarioResponse(usuario.Id, usuario.Nome, usuario.Email, usuario.Papel, usuario.Ativo));
    }

    [HttpGet("condominios/{condominioId:guid}/permissoes")]
    public async Task<ActionResult<IReadOnlyList<PermissaoResponse>>> ListarPermissoes(
        Guid condominioId, CancellationToken ct)
    {
        var sindicoId = await GarantirSindico(ct);
        if (sindicoId is null) return Forbid();

        var ehDoSindico = await _db.Condominios.AnyAsync(
            c => c.Id == condominioId && c.SindicoId == sindicoId, ct);
        if (!ehDoSindico) return NotFound();

        var lista = await _db.Permissoes
            .Include(p => p.Usuario)
            .Where(p => p.CondominioId == condominioId)
            .OrderBy(p => p.Usuario.Nome)
            .ThenBy(p => p.Modulo)
            .ToListAsync(ct);

        return Ok(lista.Select(p => new PermissaoResponse(
            p.Id, p.UsuarioId, p.Usuario.Nome, p.CondominioId, p.Modulo, p.Nivel)).ToList());
    }

    [HttpPost("condominios/{condominioId:guid}/permissoes")]
    public async Task<ActionResult<PermissaoResponse>> ConcederPermissao(
        Guid condominioId, ConcederPermissaoRequest request, CancellationToken ct)
    {
        var sindicoId = await GarantirSindico(ct);
        if (sindicoId is null) return Forbid();

        var ehDoSindico = await _db.Condominios.AnyAsync(
            c => c.Id == condominioId && c.SindicoId == sindicoId, ct);
        if (!ehDoSindico) return NotFound();

        if (request.Modulo == Authorization.Modulos.CondominiosUsuariosIntegracoes)
            return BadRequest(new { message = "Módulo de condomínios/usuários é exclusivo do síndico." });

        var usuario = await _db.Usuarios.FindAsync(new object[] { request.UsuarioId }, ct);
        if (usuario is null || usuario.Papel == PapelUsuario.Sindico)
            return BadRequest(new { message = "Usuário inválido para permissão." });

        var existente = await _db.Permissoes.FirstOrDefaultAsync(
            p => p.UsuarioId == request.UsuarioId
              && p.CondominioId == condominioId
              && p.Modulo == request.Modulo, ct);

        if (existente is not null)
        {
            existente.Nivel = request.Nivel;
            existente.UpdatedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(ct);
            return Ok(new PermissaoResponse(
                existente.Id, existente.UsuarioId, usuario.Nome,
                existente.CondominioId, existente.Modulo, existente.Nivel));
        }

        var perm = new Permissao
        {
            Id = Guid.NewGuid(),
            UsuarioId = request.UsuarioId,
            CondominioId = condominioId,
            Modulo = request.Modulo,
            Nivel = request.Nivel,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Permissoes.Add(perm);
        await _db.SaveChangesAsync(ct);

        return Ok(new PermissaoResponse(
            perm.Id, perm.UsuarioId, usuario.Nome, perm.CondominioId, perm.Modulo, perm.Nivel));
    }

    private async Task<Guid?> GarantirSindico(CancellationToken ct)
    {
        var claim = User.FindFirst("usuario_id")?.Value;
        if (claim is null || !Guid.TryParse(claim, out var id)) return null;
        var u = await _db.Usuarios.FindAsync(new object[] { id }, ct);
        if (u is null || u.Papel != PapelUsuario.Sindico || !u.Ativo) return null;
        return id;
    }
}
