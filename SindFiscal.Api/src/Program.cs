using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SindFiscal.Conversoes;
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
builder.Services.AddScoped<ContaBancariaService>();
builder.Services.AddScoped<DespesasFuturasService>();
builder.Services.AddScoped<PendenciasService>();
builder.Services.AddScoped<RelatorioMensalService>();

// ---------------------------------------------------------------- Autenticação (JWT)
// Alinhado com AuthController e user-secrets: Jwt:Key | Jwt:Issuer | Jwt:Audience
var chaveJwt =
    builder.Configuration["Jwt:Key"]
    ?? builder.Configuration["Jwt:key"]
    ?? throw new InvalidOperationException(
        "Configuração Jwt:Key ausente (user-secrets, appsettings ou env)."
    );
var jwtIssuer =
    builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Configuração Jwt:Issuer ausente.");
var jwtAudience =
    builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Configuração Jwt:Audience ausente.");

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
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
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
    opt.AddPolicy(
        "Front",
        policy =>
            policy
                .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
                .AllowAnyHeader()
                .AllowAnyMethod()
    );
});

builder
    .Services.AddControllers(opt =>
    {
        // Enums em query/rota (ex.: ?status=em_fila_execucao) chegam em snake_case
        // Todos os DTOs de resposta expõem enums de negócio (StatusCompromisso,
        // ResultadoDecisao, TipoLancamento etc.) — sem este converter, o
        // System.Text.Json padrão serializa como número (0, 1, 2...), quebrando
        // o contrato com o front (que espera strings snake_case, ex.: "aprovado").
        // Usa a mesma convenção de nomes do SnakeCaseEnumConverter (EF/coluna).
        opt.ModelBinderProviders.Insert(0, new SnakeCaseEnumModelBinderProvider());
    })
    .AddJsonOptions(opt =>
    {
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
