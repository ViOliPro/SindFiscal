using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SindFiscal.Authorization;
using SindFiscal.Entities;

namespace SindFiscal.Services;

/// <summary>
/// RF19, RNF04, RNF12, RNF14 — gera automaticamente um RegistroAuditoria
/// para toda inserção/alteração em entidades financeiras ou de decisão, em
/// vez de cada controller ter que lembrar de chamar algo manualmente
/// (RNF12 — lógica centralizada, não duplicada entre módulos).
///
/// Registra um evento por campo escalar alterado (granularidade exigida por
/// RF19 — "quais valores mudaram"), mais um evento único de "(criação)" para
/// inserts. Silencioso quando não há usuário autenticado no HttpContext
/// (ex.: migrations, seed, testes) — auditoria não deve quebrar SaveChanges
/// fora de um request HTTP.
///
/// Cobre apenas as entidades "financeiras ou de decisão" citadas em RNF04 —
/// Usuario/Permissao/Condominio/ConfiguracaoIntegracao ficam de fora
/// deliberadamente (dados de acesso e configuração, não financeiros).
/// </summary>
public class AuditoriaSaveChangesInterceptor : SaveChangesInterceptor
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    private static readonly HashSet<Type> TiposAuditados = new()
    {
        typeof(Necessidade),
        typeof(Cotacao),
        typeof(Fornecedor),
        typeof(Decisao),
        typeof(CompromissoFinanceiro),
        typeof(Pagamento),
        typeof(Transferencia),
        typeof(Lancamento),
        typeof(ContaBancaria),
        typeof(Reserva),
    };

    private static readonly HashSet<string> CamposIgnorados = new() { "Id", "CreatedAt", "UpdatedAt" };

    public AuditoriaSaveChangesInterceptor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result
    )
    {
        if (eventData.Context is not null)
            RegistrarAlteracoes(eventData.Context);

        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default
    )
    {
        if (eventData.Context is not null)
            RegistrarAlteracoes(eventData.Context);

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void RegistrarAlteracoes(DbContext context)
    {
        var usuarioId = _httpContextAccessor.HttpContext?.UsuarioIdAutenticadoOuNulo();
        if (usuarioId is null)
            return;

        var agora = DateTimeOffset.UtcNow;
        var novosRegistros = new List<RegistroAuditoria>();

        foreach (var entry in context.ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified))
                continue;
            if (!TiposAuditados.Contains(entry.Entity.GetType()))
                continue;

            var entidadeId = ObterGuid(entry, "Id");
            if (entidadeId is null)
                continue;

            var condominioId = ResolverCondominioId(context, entry);
            var entidadeTipo = entry.Entity.GetType().Name;

            if (entry.State == EntityState.Added)
            {
                novosRegistros.Add(
                    new RegistroAuditoria
                    {
                        Id = Guid.NewGuid(),
                        EntidadeTipo = entidadeTipo,
                        EntidadeId = entidadeId.Value,
                        CondominioId = condominioId,
                        UsuarioId = usuarioId.Value,
                        DataHora = agora,
                        CampoAlterado = "(criação)",
                        ValorAnterior = null,
                        ValorNovo = "registro criado",
                    }
                );
                continue;
            }

            foreach (var prop in entry.Properties)
            {
                if (!prop.IsModified || CamposIgnorados.Contains(prop.Metadata.Name))
                    continue;

                var anterior = prop.OriginalValue?.ToString();
                var novo = prop.CurrentValue?.ToString();
                if (anterior == novo)
                    continue;

                novosRegistros.Add(
                    new RegistroAuditoria
                    {
                        Id = Guid.NewGuid(),
                        EntidadeTipo = entidadeTipo,
                        EntidadeId = entidadeId.Value,
                        CondominioId = condominioId,
                        UsuarioId = usuarioId.Value,
                        DataHora = agora,
                        CampoAlterado = prop.Metadata.Name,
                        ValorAnterior = anterior,
                        ValorNovo = novo,
                    }
                );
            }
        }

        foreach (var registro in novosRegistros)
            context.Add(registro);
    }

    /// <summary>
    /// Resolve o condomínio da entidade auditada. Quando a entidade tem
    /// CondominioId escalar próprio, usa direto; senão tenta achar, no
    /// próprio ChangeTracker (sem nova consulta ao banco), a entidade "pai"
    /// já carregada na mesma unidade de trabalho (comum: os controllers
    /// carregam a Necessidade/CompromissoFinanceiro/ContaBancaria antes de
    /// adicionar o filho). Fornecedor fica sempre com CondominioId nulo —
    /// é entidade do síndico, não de um condomínio específico (RN04).
    /// </summary>
    private static Guid? ResolverCondominioId(DbContext context, EntityEntry entry)
    {
        var direto = ObterGuid(entry, "CondominioId");
        if (direto is Guid g)
            return g;

        return entry.Entity switch
        {
            Cotacao c => BuscarCondominioIdRastreado<Necessidade>(context, c.NecessidadeId),
            Decisao d => BuscarCondominioIdRastreado<Necessidade>(context, d.NecessidadeId),
            Pagamento p => BuscarCondominioIdRastreado<CompromissoFinanceiro>(context, p.CompromissoId),
            Lancamento l => BuscarCondominioIdRastreado<ContaBancaria>(context, l.ContaBancariaId),
            _ => null,
        };
    }

    private static Guid? BuscarCondominioIdRastreado<TPai>(DbContext context, Guid paiId)
        where TPai : class
    {
        var rastreada = context
            .ChangeTracker.Entries<TPai>()
            .FirstOrDefault(e => ObterGuid(e, "Id") == paiId);

        return rastreada is null ? null : ObterGuid(rastreada, "CondominioId");
    }

    private static Guid? ObterGuid(EntityEntry entry, string propriedade)
    {
        var prop = entry.Properties.FirstOrDefault(p => p.Metadata.Name == propriedade);
        return prop?.CurrentValue as Guid?;
    }
}
