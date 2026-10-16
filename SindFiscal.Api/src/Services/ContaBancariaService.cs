using Microsoft.EntityFrameworkCore;
using SindFiscal.Data;
using SindFiscal.Data.Enums;
using SindFiscal.Dtos;
using SindFiscal.Entities;

namespace SindFiscal.Services;

/// <summary>
/// RF04, RN20, RN21, RN27 — regras de contas/fundos.
/// Mantém o controller fino: validações de negócio, unicidade da conta operacional
/// e consistência da regra de aporte ficam aqui.
/// </summary>
public class ContaBancariaService
{
    private readonly AppDbContext _db;

    public ContaBancariaService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<ContaBancaria>> ListarAsync(
        Guid condominioId,
        CancellationToken ct = default)
    {
        return await _db.ContasBancarias
            .Where(c => c.CondominioId == condominioId)
            .OrderByDescending(c => c.EhContaOperacional)
            .ThenBy(c => c.Nome)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Cria conta/fundo. Lança InvalidOperationException em conflitos de negócio
    /// (conta operacional já existente, regra de aporte incompleta, nome vazio).
    /// </summary>
    public async Task<ContaBancaria> CriarAsync(
        Guid condominioId,
        CriarContaBancariaRequest request,
        CancellationToken ct = default)
    {
        var nome = (request.Nome ?? string.Empty).Trim();
        if (nome.Length < 2)
            throw new InvalidOperationException("Nome da conta deve ter pelo menos 2 caracteres.");

        ValidarRegraAporte(request.RegraAporteTipo, request.RegraAporteValor);

        // Garante que o condomínio existe (FK clara em vez de 500 genérico)
        var condominioExiste = await _db.Condominios.AnyAsync(c => c.Id == condominioId, ct);
        if (!condominioExiste)
            throw new InvalidOperationException("Condomínio não encontrado.");

        // Nome único por condomínio (case-insensitive)
        var nomeJaExiste = await _db.ContasBancarias.AnyAsync(
            c => c.CondominioId == condominioId && c.Nome.ToLower() == nome.ToLower(), ct);
        if (nomeJaExiste)
            throw new InvalidOperationException("Já existe uma conta com este nome neste condomínio.");

        if (request.EhContaOperacional)
        {
            var jaExiste = await _db.ContasBancarias.AnyAsync(
                c => c.CondominioId == condominioId && c.EhContaOperacional, ct);
            if (jaExiste)
                throw new InvalidOperationException("Já existe conta operacional neste condomínio.");
        }

        var conta = new ContaBancaria
        {
            Id = Guid.NewGuid(),
            CondominioId = condominioId,
            Nome = nome,
            Finalidade = request.Finalidade,
            EhContaOperacional = request.EhContaOperacional,
            RegraAporteTipo = request.RegraAporteTipo,
            RegraAporteValor = request.RegraAporteValor,
            TetoMaximo = request.TetoMaximo,
            SaldoAtual = 0,
            AportePendenteAcumulado = 0,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        _db.ContasBancarias.Add(conta);
        await _db.SaveChangesAsync(ct);
        return conta;
    }

    /// <summary>Atualiza apenas a regra de aporte / teto (RN20).</summary>
    public async Task<ContaBancaria> AtualizarRegraAporteAsync(
        Guid condominioId,
        Guid contaId,
        AtualizarRegraAporteRequest request,
        CancellationToken ct = default)
    {
        ValidarRegraAporte(request.RegraAporteTipo, request.RegraAporteValor);

        var conta = await _db.ContasBancarias.FirstOrDefaultAsync(
            c => c.Id == contaId && c.CondominioId == condominioId, ct)
            ?? throw new InvalidOperationException("Conta não encontrada neste condomínio.");

        conta.RegraAporteTipo = request.RegraAporteTipo;
        conta.RegraAporteValor = request.RegraAporteValor;
        conta.TetoMaximo = request.TetoMaximo;
        conta.UpdatedAt = DateTimeOffset.UtcNow;

        await _db.SaveChangesAsync(ct);
        return conta;
    }

    /// <summary>
    /// Exclui conta sem lançamentos. Conta operacional com saldo ≠ 0 ou com
    /// lançamentos vinculados é bloqueada para preservar histórico (RF05/RN32).
    /// </summary>
    public async Task ExcluirAsync(
        Guid condominioId,
        Guid contaId,
        CancellationToken ct = default)
    {
        var conta = await _db.ContasBancarias.FirstOrDefaultAsync(
            c => c.Id == contaId && c.CondominioId == condominioId, ct)
            ?? throw new InvalidOperationException("Conta não encontrada neste condomínio.");

        var temLancamentos = await _db.Lancamentos.AnyAsync(l => l.ContaBancariaId == contaId, ct);
        if (temLancamentos)
            throw new InvalidOperationException(
                "Não é possível excluir conta que possui lançamentos. Estorne-os antes.");

        if (conta.SaldoAtual != 0)
            throw new InvalidOperationException(
                "Não é possível excluir conta com saldo diferente de zero.");

        _db.ContasBancarias.Remove(conta);
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Espelha a CHECK constraint ck_conta_regra_aporte_completa do schema:
    /// ambos nulos OU ambos preenchidos.
    /// </summary>
    private static void ValidarRegraAporte(TipoRegraAporte? tipo, decimal? valor)
    {
        var temTipo = tipo is not null;
        var temValor = valor is not null;

        if (temTipo != temValor)
        {
            throw new InvalidOperationException(
                "Regra de aporte incompleta: informe tipo e valor juntos, ou deixe ambos vazios.");
        }

        if (temValor && valor <= 0)
            throw new InvalidOperationException("Valor da regra de aporte deve ser positivo.");
    }
}
