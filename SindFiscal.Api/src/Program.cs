using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SindFiscal.Data;
using SindFiscal.Services;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------- DbContext (PostgreSQL)
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default"))
        .UseSnakeCaseNamingConvention()
); // pacote EFCore.NamingConventions — ver README.md

// ---------------------------------------------------------------- Serviços de domínio
builder.Services.AddScoped<AreaDeAcertoService>();
builder.Services.AddScoped<FilaExecucaoService>();

// ---------------------------------------------------------------- Autenticação (JWT)
var chaveJwt =
    builder.Configuration["Jwt:ChaveSecreta"]
    ?? throw new InvalidOperationException(
        "Configuração Jwt:ChaveSecreta ausente (appsettings.json ou variável de ambiente)."
    );

builder
    .Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Emissor"],
            ValidAudience = builder.Configuration["Jwt:Audiencia"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(chaveJwt)),
        };
    });

// ---------------------------------------------------------------- Autorização
// RF01/RNF01 — autenticação obrigatória por padrão em todo endpoint;
// [AllowAnonymous] no AuthController.Login é a única exceção.
builder.Services.AddAuthorization(opt =>
{
    opt.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

if (app.Environment.IsDevelopment()) { }

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
