using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SindFiscal.Data;
using SindFiscal.Services;

// Inicializa o builder e carrega as variáveis de ambiente IMEDIATAMENTE
var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddEnvironmentVariables();

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
    builder.Configuration["Jwt:key"]
    ?? throw new InvalidOperationException(
        "Configuração Jwt:key ausente (appsettings.json ou variável de ambiente)."
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
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
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

// ---------------------------------------------------------------- CORS (front Vite)
builder.Services.AddCors(opt =>
{
    opt.AddPolicy("Front", policy => policy.WithOrigins("*").AllowAnyHeader().AllowAnyMethod());
});

builder
    .Services.AddControllers()
    .AddJsonOptions(opt =>
    {
        // Todos os DTOs de resposta expõem enums de negócio (StatusCompromisso,
        // ResultadoDecisao, TipoLancamento etc.) — sem este converter, o
        // System.Text.Json padrão serializa como número (0, 1, 2...), quebrando
        // o contrato com o front (que espera strings snake_case, ex.: "aprovado").
        // Usa a mesma convenção de nomes do SnakeCaseEnumConverter (EF/coluna).
        opt.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower)
        );
    });
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

if (app.Environment.IsDevelopment()) { }

app.UseHttpsRedirection();
app.UseCors("Front");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
