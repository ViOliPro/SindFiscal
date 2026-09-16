using Microsoft.EntityFrameworkCore;
using SindFiscal.Conversoes;
using SindFiscal.Data.Enums;
using SindFiscal.Entities;

namespace SindFiscal.Data;

/// <summary>
/// DbContext principal. Pressupõe o pacote EFCore.NamingConventions
/// (Npgsql.EntityFrameworkCore.PostgreSQL + UseSnakeCaseNamingConvention())
/// para converter automaticamente nomes de propriedades PascalCase em
/// colunas snake_case — os nomes de TABELA ainda são configurados
/// explicitamente abaixo (singular, para casar 1:1 com database/schema.sql).
///
/// Setup esperado no Program.cs / composition root:
///   services.AddDbContext&lt;AppDbContext&gt;(opt =&gt; opt
///       .UseNpgsql(connectionString)
///       .UseSnakeCaseNamingConvention());
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options) { }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Condominio> Condominios => Set<Condominio>();
    public DbSet<Permissao> Permissoes => Set<Permissao>();
    public DbSet<ConfiguracaoIntegracao> ConfiguracoesIntegracao => Set<ConfiguracaoIntegracao>();
    public DbSet<ContaBancaria> ContasBancarias => Set<ContaBancaria>();
    public DbSet<Lancamento> Lancamentos => Set<Lancamento>();
    public DbSet<Fornecedor> Fornecedores => Set<Fornecedor>();
    public DbSet<Necessidade> Necessidades => Set<Necessidade>();
    public DbSet<Cotacao> Cotacoes => Set<Cotacao>();
    public DbSet<Decisao> Decisoes => Set<Decisao>();
    public DbSet<CompromissoFinanceiro> CompromissosFinanceiros => Set<CompromissoFinanceiro>();
    public DbSet<Pagamento> Pagamentos => Set<Pagamento>();
    public DbSet<Reserva> Reservas => Set<Reserva>();
    public DbSet<Transferencia> Transferencias => Set<Transferencia>();
    public DbSet<Documento> Documentos => Set<Documento>();
    public DbSet<RegistroAuditoria> RegistrosAuditoria => Set<RegistroAuditoria>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        const int precisaoMoeda = 14;
        const int escalaMoeda = 2;

        // ---------------------------------------------------------------- USUARIO
        b.Entity<Usuario>(e =>
        {
            e.ToTable("usuario");
            e.HasKey(x => x.Id);
            e.Property(x => x.Nome).HasMaxLength(150).IsRequired();
            e.Property(x => x.Email).HasMaxLength(200).IsRequired();
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Papel)
                .HasConversion(SnakeCaseEnumConverter.Create<PapelUsuario>())
                .HasMaxLength(20)
                .IsRequired();
            // v1 — hash simples (SHA256+salt, ver AuthController.HashSenha); nullable
            // porque usuários existentes antes desta coluna ainda não têm hash
            // (aceitos em modo bootstrap até definirem senha — ver AuthController.Login).
            e.Property(x => x.SenhaHash).HasMaxLength(255);
        });

        // ---------------------------------------------------------------- CONDOMINIO
        b.Entity<Condominio>(e =>
        {
            e.ToTable("condominio");
            e.HasKey(x => x.Id);
            e.Property(x => x.Nome).HasMaxLength(150).IsRequired();
            e.Property(x => x.ValorAlcadaAprovacao).HasPrecision(precisaoMoeda, escalaMoeda);
            e.HasOne(x => x.Sindico)
                .WithMany(u => u.CondominiosAdministrados)
                .HasForeignKey(x => x.SindicoId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.SindicoId);
        });

        // ---------------------------------------------------------------- PERMISSAO
        b.Entity<Permissao>(e =>
        {
            e.ToTable("permissao");
            e.HasKey(x => x.Id);
            e.Property(x => x.Modulo).HasMaxLength(60).IsRequired();
            e.Property(x => x.Nivel)
                .HasConversion(SnakeCaseEnumConverter.Create<NivelPermissao>())
                .HasMaxLength(10)
                .IsRequired();
            e.HasIndex(x => new { x.UsuarioId, x.CondominioId });
            e.HasIndex(x => new
                {
                    x.UsuarioId,
                    x.CondominioId,
                    x.Modulo,
                })
                .IsUnique();
            e.HasOne(x => x.Usuario)
                .WithMany(u => u.Permissoes)
                .HasForeignKey(x => x.UsuarioId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Condominio)
                .WithMany(c => c.Permissoes)
                .HasForeignKey(x => x.CondominioId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------------- CONFIGURACAO_INTEGRACAO
        b.Entity<ConfiguracaoIntegracao>(e =>
        {
            e.ToTable("configuracao_integracao");
            e.HasKey(x => x.Id);
            e.Property(x => x.TipoFonteVerdade)
                .HasConversion(SnakeCaseEnumConverter.Create<TipoFonteVerdade>())
                .HasMaxLength(10)
                .IsRequired();
            e.HasIndex(x => x.CondominioId).IsUnique();
            e.HasOne(x => x.Condominio)
                .WithOne(c => c.ConfiguracaoIntegracao)
                .HasForeignKey<ConfiguracaoIntegracao>(x => x.CondominioId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------------- CONTA_BANCARIA
        b.Entity<ContaBancaria>(e =>
        {
            e.ToTable("conta_bancaria");
            e.HasKey(x => x.Id);
            e.Property(x => x.Nome).HasMaxLength(120).IsRequired();
            e.Property(x => x.Finalidade)
                .HasConversion(SnakeCaseEnumConverter.Create<FinalidadeConta>())
                .HasMaxLength(30)
                .IsRequired();
            e.Property(x => x.RegraAporteTipo)
                .HasConversion(SnakeCaseEnumConverter.Create<TipoRegraAporte>())
                .HasMaxLength(12);
            e.Property(x => x.RegraAporteValor).HasPrecision(precisaoMoeda, escalaMoeda);
            e.Property(x => x.TetoMaximo).HasPrecision(precisaoMoeda, escalaMoeda);
            e.Property(x => x.SaldoAtual).HasPrecision(precisaoMoeda, escalaMoeda);
            e.Property(x => x.AportePendenteAcumulado).HasPrecision(precisaoMoeda, escalaMoeda);
            e.HasIndex(x => x.CondominioId).HasDatabaseName("ix_conta_bancaria_condominio");
            // No máximo uma conta operacional por condomínio (índice único parcial —
            // ver database/schema.sql). Nome explícito garante que o EF Core trate
            // isto como um índice distinto do índice simples acima.
            e.HasIndex(x => x.CondominioId)
                .HasFilter("\"eh_conta_operacional\" = true")
                .IsUnique()
                .HasDatabaseName("uq_conta_operacional_por_condominio");
            e.HasOne(x => x.Condominio)
                .WithMany(c => c.ContasBancarias)
                .HasForeignKey(x => x.CondominioId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ---------------------------------------------------------------- LANCAMENTO
        b.Entity<Lancamento>(e =>
        {
            e.ToTable("lancamento");
            e.HasKey(x => x.Id);
            e.Property(x => x.Tipo)
                .HasConversion(SnakeCaseEnumConverter.Create<TipoLancamento>())
                .HasMaxLength(10)
                .IsRequired();
            e.Property(x => x.Origem)
                .HasConversion(SnakeCaseEnumConverter.Create<OrigemLancamento>())
                .HasMaxLength(10)
                .IsRequired();
            e.Property(x => x.Fonte)
                .HasConversion(SnakeCaseEnumConverter.Create<FonteLancamento>())
                .HasMaxLength(12)
                .IsRequired();
            e.Property(x => x.Valor).HasPrecision(precisaoMoeda, escalaMoeda);
            e.HasIndex(x => new { x.ContaBancariaId, x.Data });
            e.HasIndex(x => x.Origem);
            e.HasOne(x => x.ContaBancaria)
                .WithMany(c => c.Lancamentos)
                .HasForeignKey(x => x.ContaBancariaId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.EstornoDe)
                .WithMany()
                .HasForeignKey(x => x.EstornoDeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---------------------------------------------------------------- FORNECEDOR
        b.Entity<Fornecedor>(e =>
        {
            e.ToTable("fornecedor");
            e.HasKey(x => x.Id);
            e.Property(x => x.Nome).HasMaxLength(150).IsRequired();
            e.Property(x => x.Categoria).HasMaxLength(60).IsRequired();
            e.HasIndex(x => x.SindicoId);
            e.HasOne(x => x.Sindico)
                .WithMany(u => u.FornecedoresCadastrados)
                .HasForeignKey(x => x.SindicoId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---------------------------------------------------------------- NECESSIDADE
        b.Entity<Necessidade>(e =>
        {
            e.ToTable("necessidade");
            e.HasKey(x => x.Id);
            e.Property(x => x.Categoria).HasMaxLength(60).IsRequired();
            e.Property(x => x.Prioridade)
                .HasConversion(SnakeCaseEnumConverter.Create<Prioridade>())
                .HasMaxLength(10);
            e.Property(x => x.Situacao)
                .HasConversion(SnakeCaseEnumConverter.Create<SituacaoNecessidade>())
                .HasMaxLength(20)
                .IsRequired();
            e.HasIndex(x => x.CondominioId);
            e.HasIndex(x => x.Situacao);
            e.HasOne(x => x.Condominio)
                .WithMany(c => c.Necessidades)
                .HasForeignKey(x => x.CondominioId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Responsavel)
                .WithMany()
                .HasForeignKey(x => x.ResponsavelId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---------------------------------------------------------------- COTACAO
        b.Entity<Cotacao>(e =>
        {
            e.ToTable("cotacao");
            e.HasKey(x => x.Id);
            e.Property(x => x.Valor).HasPrecision(precisaoMoeda, escalaMoeda);
            e.Property(x => x.GarantiaDescricao).HasMaxLength(200);
            e.Property(x => x.CondicoesPagamento).HasMaxLength(200);
            e.HasIndex(x => x.NecessidadeId);
            e.HasIndex(x => x.FornecedorId);
            e.HasOne(x => x.Necessidade)
                .WithMany(n => n.Cotacoes)
                .HasForeignKey(x => x.NecessidadeId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Fornecedor)
                .WithMany(f => f.Cotacoes)
                .HasForeignKey(x => x.FornecedorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---------------------------------------------------------------- DECISAO
        b.Entity<Decisao>(e =>
        {
            e.ToTable("decisao");
            e.HasKey(x => x.Id);
            e.Property(x => x.Resultado)
                .HasConversion(SnakeCaseEnumConverter.Create<ResultadoDecisao>())
                .HasMaxLength(10)
                .IsRequired();
            e.Property(x => x.ReferenciaRespaldo).HasMaxLength(200);
            e.HasIndex(x => x.NecessidadeId);
            e.HasOne(x => x.Necessidade)
                .WithMany(n => n.Decisoes)
                .HasForeignKey(x => x.NecessidadeId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CotacaoEscolhida)
                .WithMany()
                .HasForeignKey(x => x.CotacaoEscolhidaId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Responsavel)
                .WithMany()
                .HasForeignKey(x => x.ResponsavelId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---------------------------------------------------------------- COMPROMISSO_FINANCEIRO
        b.Entity<CompromissoFinanceiro>(e =>
        {
            e.ToTable("compromisso_financeiro");
            e.HasKey(x => x.Id);
            e.Property(x => x.Categoria).HasMaxLength(60).IsRequired();
            e.Property(x => x.ValorAprovado).HasPrecision(precisaoMoeda, escalaMoeda);
            e.Property(x => x.Status)
                .HasConversion(SnakeCaseEnumConverter.Create<StatusCompromisso>())
                .HasMaxLength(20)
                .IsRequired();
            e.Ignore(x => x.TotalGastosVinculados); // calculado em runtime, não persistido
            e.HasIndex(x => x.CondominioId);
            e.HasIndex(x => x.CompromissoPaiId);
            e.HasIndex(x => new
            {
                x.CondominioId,
                x.Status,
                x.PrioridadeFila,
            });
            e.HasOne(x => x.Condominio)
                .WithMany(c => c.Compromissos)
                .HasForeignKey(x => x.CondominioId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Necessidade)
                .WithMany(n => n.Compromissos)
                .HasForeignKey(x => x.NecessidadeId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CompromissoPai)
                .WithMany(c => c.GastosVinculados)
                .HasForeignKey(x => x.CompromissoPaiId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---------------------------------------------------------------- PAGAMENTO
        b.Entity<Pagamento>(e =>
        {
            e.ToTable("pagamento");
            e.HasKey(x => x.Id);
            e.Property(x => x.Tipo)
                .HasConversion(SnakeCaseEnumConverter.Create<TipoPagamento>())
                .HasMaxLength(12)
                .IsRequired();
            e.Property(x => x.Valor).HasPrecision(precisaoMoeda, escalaMoeda);
            e.HasIndex(x => x.CompromissoId);
            e.HasIndex(x => x.FundoResponsavelId);
            e.HasIndex(x => x.LancamentoId);
            e.HasOne(x => x.Compromisso)
                .WithMany(c => c.Pagamentos)
                .HasForeignKey(x => x.CompromissoId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.FundoResponsavel)
                .WithMany(c => c.PagamentosComoFundoResponsavel)
                .HasForeignKey(x => x.FundoResponsavelId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Lancamento)
                .WithMany(l => l.Pagamentos)
                .HasForeignKey(x => x.LancamentoId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---------------------------------------------------------------- RESERVA
        b.Entity<Reserva>(e =>
        {
            e.ToTable("reserva");
            e.HasKey(x => x.Id);
            e.Property(x => x.Unidade).HasMaxLength(20).IsRequired();
            e.Property(x => x.MoradorNome).HasMaxLength(150).IsRequired();
            e.Property(x => x.ValorDestinadoAoFundo).HasPrecision(precisaoMoeda, escalaMoeda);
            e.HasIndex(x => new { x.CondominioId, x.PeriodoReferencia });
            e.HasIndex(x => x.FundoDestinoId);
            e.HasOne(x => x.Condominio)
                .WithMany(c => c.Reservas)
                .HasForeignKey(x => x.CondominioId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.FundoDestino)
                .WithMany(c => c.ReservasComoFundoDestino)
                .HasForeignKey(x => x.FundoDestinoId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---------------------------------------------------------------- TRANSFERENCIA
        b.Entity<Transferencia>(e =>
        {
            e.ToTable(
                "transferencia",
                t =>
                    t.HasCheckConstraint(
                        "ck_transferencia_contas_diferentes",
                        "\"conta_origem_id\" <> \"conta_destino_id\""
                    )
            );
            e.HasKey(x => x.Id);
            e.Property(x => x.Valor).HasPrecision(precisaoMoeda, escalaMoeda);
            e.Property(x => x.Tipo)
                .HasConversion(SnakeCaseEnumConverter.Create<TipoTransferencia>())
                .HasMaxLength(10)
                .IsRequired();
            e.Property(x => x.Modo)
                .HasConversion(SnakeCaseEnumConverter.Create<ModoTransferencia>())
                .HasMaxLength(16)
                .IsRequired();
            e.Property(x => x.Origem)
                .HasConversion(SnakeCaseEnumConverter.Create<OrigemTransferencia>())
                .HasMaxLength(30)
                .IsRequired();
            e.Property(x => x.Motivo)
                .HasConversion(SnakeCaseEnumConverter.Create<MotivoTransferencia>())
                .HasMaxLength(20)
                .IsRequired();
            e.Property(x => x.Status)
                .HasConversion(SnakeCaseEnumConverter.Create<StatusTransferencia>())
                .HasMaxLength(16)
                .IsRequired();
            e.HasIndex(x => new { x.CondominioId, x.Status });
            e.HasIndex(x => x.Motivo);
            e.HasOne(x => x.Condominio)
                .WithMany(c => c.Transferencias)
                .HasForeignKey(x => x.CondominioId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.ContaOrigem)
                .WithMany()
                .HasForeignKey(x => x.ContaOrigemId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ContaDestino)
                .WithMany()
                .HasForeignKey(x => x.ContaDestinoId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---------------------------------------------------------------- TRANSFERENCIA_PAGAMENTO (N:N)
        b.Entity<TransferenciaPagamento>(e =>
        {
            e.ToTable("transferencia_pagamento");
            e.HasKey(x => new { x.TransferenciaId, x.PagamentoId });
            e.HasOne(x => x.Transferencia)
                .WithMany(t => t.Pagamentos)
                .HasForeignKey(x => x.TransferenciaId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Pagamento)
                .WithMany(p => p.TransferenciasVinculadas)
                .HasForeignKey(x => x.PagamentoId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---------------------------------------------------------------- TRANSFERENCIA_RESERVA (N:N)
        b.Entity<TransferenciaReserva>(e =>
        {
            e.ToTable("transferencia_reserva");
            e.HasKey(x => new { x.TransferenciaId, x.ReservaId });
            e.HasOne(x => x.Transferencia)
                .WithMany(t => t.Reservas)
                .HasForeignKey(x => x.TransferenciaId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Reserva)
                .WithMany(r => r.TransferenciasVinculadas)
                .HasForeignKey(x => x.ReservaId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // ---------------------------------------------------------------- DOCUMENTO (associação polimórfica, sem FK)
        b.Entity<Documento>(e =>
        {
            e.ToTable("documento");
            e.HasKey(x => x.Id);
            e.Property(x => x.EntidadeTipo)
                .HasConversion(SnakeCaseEnumConverter.Create<EntidadeDocumento>())
                .HasMaxLength(30)
                .IsRequired();
            e.Property(x => x.TipoDocumento).HasMaxLength(40).IsRequired();
            e.Property(x => x.ReferenciaTexto).IsRequired();
            e.HasIndex(x => new { x.EntidadeTipo, x.EntidadeId });
        });

        // ---------------------------------------------------------------- REGISTRO_AUDITORIA (somente INSERT)
        b.Entity<RegistroAuditoria>(e =>
        {
            e.ToTable("registro_auditoria");
            e.HasKey(x => x.Id);
            e.Property(x => x.EntidadeTipo).HasMaxLength(30).IsRequired();
            e.Property(x => x.CampoAlterado).HasMaxLength(60).IsRequired();
            e.HasIndex(x => new { x.EntidadeTipo, x.EntidadeId });
            e.HasIndex(x => x.UsuarioId);
            e.HasIndex(x => x.DataHora);
            e.HasIndex(x => x.CondominioId);
            e.HasOne(x => x.Usuario)
                .WithMany()
                .HasForeignKey(x => x.UsuarioId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
