namespace SindFiscal.Entities;

/// <summary>
/// Tabela de junção — quais reservas compõem um item de destinação de
/// receita (RN23: soma do período compõe um único item de acerto).
/// Chave primária composta (TransferenciaId, ReservaId).
/// </summary>
public class TransferenciaReserva
{
    public Guid TransferenciaId { get; set; }
    public Guid ReservaId { get; set; }

    // Navegação
    public Transferencia Transferencia { get; set; } = null!;
    public Reserva Reserva { get; set; } = null!;
}
