using SindFiscal.Data.Enums;

namespace SindFiscal.Authorization;

/// <summary>
/// RF03, RN29, RN30 — regras de negócio sobre O QUE pode ser concedido, num lugar só
/// (usado pela matriz de acessos, pelos modelos de acesso e pelo endpoint legado de permissões).
/// </summary>
public static class RegrasAcesso
{
    /// <summary>Retorna a mensagem de erro, ou null se a concessão é válida.</summary>
    public static string? Validar(string modulo, NivelPermissao nivel, PapelUsuario papelDoUsuario)
    {
        if (!Modulos.EhDelegavel(modulo))
            return $"Módulo \"{modulo}\" inválido ou exclusivo do síndico.";

        if (modulo == Modulos.Auditoria && nivel != NivelPermissao.Visualizar)
            return "Auditoria é sempre somente leitura (RF19).";

        if (papelDoUsuario == PapelUsuario.ConselheiroFiscal && nivel != NivelPermissao.Visualizar)
            return "O Conselho Fiscal tem acesso somente leitura (RN30).";

        return null;
    }

    /// <summary>
    /// Sugestão inicial de modelos (o síndico pode editar/excluir depois).
    /// Módulo ausente = sem acesso.
    /// </summary>
    public static readonly IReadOnlyList<(
        string Nome,
        string Descricao,
        (string Modulo, NivelPermissao Nivel)[] Itens
    )> ModelosPadrao = new[]
    {
        (
            "Consulta",
            "Só visualiza os módulos operacionais e financeiros.",
            new[]
            {
                (Modulos.ContasLancamentos, NivelPermissao.Visualizar),
                (Modulos.NecessidadesCotacoesFornecedores, NivelPermissao.Visualizar),
                (Modulos.DecisoesCompromissos, NivelPermissao.Visualizar),
                (Modulos.PagamentosFilaExecucao, NivelPermissao.Visualizar),
                (Modulos.TransferenciasAreaAcerto, NivelPermissao.Visualizar),
                (Modulos.SimulacaoCaixaFuturo, NivelPermissao.Visualizar),
                (Modulos.DashboardRelatorios, NivelPermissao.Visualizar),
                (Modulos.Documentos, NivelPermissao.Visualizar),
                (Modulos.ReservasAreaComum, NivelPermissao.Visualizar),
            }
        ),
        (
            "Operacional",
            "Edita o dia a dia (cotações, pagamentos, documentos, reservas); o resto só visualiza.",
            new[]
            {
                (Modulos.ContasLancamentos, NivelPermissao.Visualizar),
                (Modulos.NecessidadesCotacoesFornecedores, NivelPermissao.Editar),
                (Modulos.DecisoesCompromissos, NivelPermissao.Visualizar),
                (Modulos.PagamentosFilaExecucao, NivelPermissao.Editar),
                (Modulos.TransferenciasAreaAcerto, NivelPermissao.Visualizar),
                (Modulos.SimulacaoCaixaFuturo, NivelPermissao.Visualizar),
                (Modulos.DashboardRelatorios, NivelPermissao.Visualizar),
                (Modulos.Documentos, NivelPermissao.Editar),
                (Modulos.ReservasAreaComum, NivelPermissao.Editar),
            }
        ),
        (
            "Gestor",
            "Edita todos os módulos delegáveis e consulta a auditoria.",
            new[]
            {
                (Modulos.ContasLancamentos, NivelPermissao.Editar),
                (Modulos.NecessidadesCotacoesFornecedores, NivelPermissao.Editar),
                (Modulos.DecisoesCompromissos, NivelPermissao.Editar),
                (Modulos.PagamentosFilaExecucao, NivelPermissao.Editar),
                (Modulos.TransferenciasAreaAcerto, NivelPermissao.Editar),
                (Modulos.SimulacaoCaixaFuturo, NivelPermissao.Editar),
                (Modulos.DashboardRelatorios, NivelPermissao.Editar),
                (Modulos.Documentos, NivelPermissao.Editar),
                (Modulos.ReservasAreaComum, NivelPermissao.Editar),
                (Modulos.Auditoria, NivelPermissao.Visualizar),
            }
        ),
    };
}
