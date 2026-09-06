namespace SindFiscal.Entities;

/// <summary>
/// Tabela de junção — quais pagamentos compõem um item de transferência de
/// reposição (RN17: uma transferência pode consolidar N pagamentos).
/// Chave primária composta (TransferenciaId, PagamentoId).
/// </summary>
public class TransferenciaPagamento
{
    public Guid TransferenciaId { get; set; }
    public Guid PagamentoId { get; set; }

    // Navegação
    public Transferencia Transferencia { get; set; } = null!;
    public Pagamento Pagamento { get; set; } = null!;
}
