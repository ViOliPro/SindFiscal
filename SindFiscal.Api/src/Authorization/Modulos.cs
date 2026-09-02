namespace SindFiscal.Authorization;

/// <summary>
/// Códigos dos 11 módulos definidos na Especificação (Requisitos Funcionais
/// §1.1). Usados como valor da coluna permissao.modulo e nos atributos
/// [RequerPermissao] dos controllers — mantenha os dois sincronizados.
/// </summary>
public static class Modulos
{
    public const string ContasLancamentos = "contas_lancamentos";                         // RF04, RF05
    public const string NecessidadesCotacoesFornecedores = "necessidades_cotacoes_fornecedores"; // RF06, RF07, RF08
    public const string DecisoesCompromissos = "decisoes_compromissos";                   // RF09, RF10, RF12
    public const string PagamentosFilaExecucao = "pagamentos_fila_execucao";              // RF11, RF13
    public const string TransferenciasAreaAcerto = "transferencias_area_acerto";          // RF14
    public const string SimulacaoCaixaFuturo = "simulacao_caixa_futuro";                  // RF16
    public const string DashboardRelatorios = "dashboard_relatorios";                     // RF17, RF18
    public const string Documentos = "documentos";                                        // RF20
    public const string ReservasAreaComum = "reservas_area_comum";                        // RF21
    public const string Auditoria = "auditoria";                                          // RF19 — sempre leitura
    public const string CondominiosUsuariosIntegracoes = "condominios_usuarios_integracoes"; // RF01, RF02, RF03, RF15 — exclusivo síndico
}
