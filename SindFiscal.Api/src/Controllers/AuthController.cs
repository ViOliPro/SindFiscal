using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Controllers;

/// <summary>RF01 — autenticação JWT. Hash de senha simples (SHA256 + salt embutido) para v1;
/// substituir por bcrypt/argon2 em produção. Schema ainda não tem senha_hash — usa
/// campo SenhaHash adicionado à entidade Usuario (nullable; migration necessária).</summary>
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _cfg;

    public AuthController(AppDbContext db, IConfiguration cfg)
    {
        _db = db;
        _cfg = cfg;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        var usuario = await _db.Usuarios
            .Include(u => u.Permissoes)
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.Ativo, ct);

        if (usuario is null)
            return Unauthorized(new { message = "Credenciais inválidas." });

        // Sem SenhaHash cadastrada: aceita qualquer senha em ambiente de desenvolvimento
        // (bootstrap). Com hash: valida.
        if (!string.IsNullOrEmpty(usuario.SenhaHash) && !VerificarSenha(request.Senha, usuario.SenhaHash))
            return Unauthorized(new { message = "Credenciais inválidas." });

        var token = GerarToken(usuario);
        return Ok(new LoginResponse(
            token,
            new UsuarioResponse(usuario.Id, usuario.Nome, usuario.Email, usuario.Papel, usuario.Ativo)
        ));
    }

    /// <summary>Bootstrap: cria o primeiro síndico se a base estiver vazia.</summary>
    [HttpPost("bootstrap")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Bootstrap(
        [FromBody] BootstrapRequest request,
        CancellationToken ct)
    {
        if (await _db.Usuarios.AnyAsync(ct))
            return Conflict(new { message = "Já existem usuários. Use /auth/login." });

        var usuario = new Usuario
        {
            Id = Guid.NewGuid(),
            Nome = request.Nome,
            Email = request.Email,
            Papel = PapelUsuario.Sindico,
            Ativo = true,
            SenhaHash = HashSenha(request.Senha),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.Usuarios.Add(usuario);
        await _db.SaveChangesAsync(ct);

        var token = GerarToken(usuario);
        return Ok(new LoginResponse(
            token,
            new UsuarioResponse(usuario.Id, usuario.Nome, usuario.Email, usuario.Papel, usuario.Ativo)
        ));
    }

    [HttpGet("me")]
    public async Task<ActionResult<UsuarioResponse>> Me(CancellationToken ct)
    {
        var idClaim = User.FindFirst("usuario_id")?.Value;
        if (idClaim is null || !Guid.TryParse(idClaim, out var id))
            return Unauthorized();

        var u = await _db.Usuarios.FindAsync(new object[] { id }, ct);
        if (u is null || !u.Ativo) return Unauthorized();

        return Ok(new UsuarioResponse(u.Id, u.Nome, u.Email, u.Papel, u.Ativo));
    }

    private string GerarToken(Usuario usuario)
    {
        var chave = _cfg["Jwt:ChaveSecreta"]
            ?? throw new InvalidOperationException("Jwt:ChaveSecreta ausente.");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(chave));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim("usuario_id", usuario.Id.ToString()),
            new Claim(ClaimTypes.Email, usuario.Email),
            new Claim(ClaimTypes.Name, usuario.Nome),
            new Claim("papel", usuario.Papel.ToString().ToLowerInvariant()),
        };

        var token = new JwtSecurityToken(
            issuer: _cfg["Jwt:Emissor"],
            audience: _cfg["Jwt:Audiencia"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    internal static string HashSenha(string senha)
    {
        var salt = "sindfiscal-v1"; // trocar por salt por usuário em produção
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(salt + senha));
        return Convert.ToHexString(bytes);
    }

    private static bool VerificarSenha(string senha, string hash) =>
        string.Equals(HashSenha(senha), hash, StringComparison.OrdinalIgnoreCase);
}

public record BootstrapRequest(string Nome, string Email, string Senha);
