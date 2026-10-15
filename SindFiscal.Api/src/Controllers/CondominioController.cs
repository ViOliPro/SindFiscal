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

    /// <summary>Lista condomínios ativos do síndico (ou com permissão). ?incluirInativos=true para ver soft-deleted.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CondominioResponse>>> Listar(
        [FromQuery] bool incluirInativos = false,
        CancellationToken ct = default)
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

        if (!incluirInativos)
            query = query.Where(c => c.Ativo);

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

        var nome = request.Nome?.Trim() ?? "";
        if (string.IsNullOrEmpty(nome))
            return BadRequest(new { message = "Nome é obrigatório." });

        var cnpj = NormalizarCnpj(request.Cnpj);
        if (cnpj is not null)
        {
            var cnpjEmUso = await _db.Condominios.AnyAsync(
                c => c.Cnpj == cnpj, ct);
            if (cnpjEmUso)
                return Conflict(new { message = "CNPJ já cadastrado em outro condomínio." });
        }

        var condominio = new Condominio
        {
            Id = Guid.NewGuid(),
            SindicoId = usuarioId.Value,
            Nome = nome,
            Cnpj = cnpj,
            PossuiIntegracaoApi = false,
            Ativo = true,
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
            return BadRequest(new { message = "Valor de alçada não pode ser negativo." });

        var nome = request.Nome?.Trim() ?? "";
        if (string.IsNullOrEmpty(nome))
            return BadRequest(new { message = "Nome é obrigatório." });

        var c = await _db.Condominios.FirstOrDefaultAsync(
            x => x.Id == condominioId && x.SindicoId == usuarioId, ct);
        if (c is null) return NotFound();

        var cnpj = NormalizarCnpj(request.Cnpj);
        if (cnpj is not null)
        {
            var cnpjEmUso = await _db.Condominios.AnyAsync(
                x => x.Cnpj == cnpj && x.Id != condominioId, ct);
            if (cnpjEmUso)
                return Conflict(new { message = "CNPJ já cadastrado em outro condomínio." });
        }

        c.Nome = nome;
        c.Cnpj = cnpj;
        c.ValorAlcadaAprovacao = request.ValorAlcadaAprovacao;
        c.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ParaResponse(c));
    }

    /// <summary>Soft-delete: marca Ativo=false. Histórico financeiro preservado.</summary>
    [HttpDelete("{condominioId:guid}")]
    public async Task<IActionResult> Excluir(Guid condominioId, CancellationToken ct)
    {
        var usuarioId = UsuarioId();
        if (usuarioId is null) return Unauthorized();

        var c = await _db.Condominios.FirstOrDefaultAsync(
            x => x.Id == condominioId && x.SindicoId == usuarioId, ct);
        if (c is null) return NotFound();

        if (!c.Ativo)
            return NoContent(); // já inativo

        c.Ativo = false;
        c.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Reativa condomínio soft-deleted.</summary>
    [HttpPost("{condominioId:guid}/reativar")]
    public async Task<ActionResult<CondominioResponse>> Reativar(
        Guid condominioId, CancellationToken ct)
    {
        var usuarioId = UsuarioId();
        if (usuarioId is null) return Unauthorized();

        var c = await _db.Condominios.FirstOrDefaultAsync(
            x => x.Id == condominioId && x.SindicoId == usuarioId, ct);
        if (c is null) return NotFound();

        c.Ativo = true;
        c.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(ParaResponse(c));
    }

    private static CondominioResponse ParaResponse(Condominio c) =>
        new(c.Id, c.Nome, c.Cnpj, c.PossuiIntegracaoApi, c.ValorAlcadaAprovacao, c.Ativo);

    /// <summary>Mantém só dígitos; retorna null se vazio. Aceita formatado ou não.</summary>
    private static string? NormalizarCnpj(string? cnpj)
    {
        if (string.IsNullOrWhiteSpace(cnpj)) return null;
        var digits = new string(cnpj.Where(char.IsDigit).ToArray());
        return digits.Length == 0 ? null : digits;
    }

    private Guid? UsuarioId()
    {
        var claim = User.FindFirst("usuario_id")?.Value;
        return claim is not null && Guid.TryParse(claim, out var id) ? id : null;
    }
}
