namespace SindFiscal.Api.src.Enum;

// Cada enum abaixo corresponde a uma coluna text + CHECK constraint no schema.sql.
// A conversão para snake_case no banco é feita via SnakeCaseEnumConverter
// (ver Conversoes/SnakeCaseEnumConverter.cs), configurada no AppDbContext.

/// <summary>RF01, RF03 — papel do usuário no sistema (RN29, RN30).</summary>
public enum PapelUsuario
{
    Sindico,
    Colaborador,
    ConselheiroFiscal
}

/// <summary>RF03 — nível de permissão concedido por módulo/condomínio.</summary>
public enum NivelPermissao
{
    Visualizar,
    Editar
}

/// <summary>RF15 — fonte de verdade dos lançamentos, configurável por condomínio (RN01–RN03).</summary>
public enum TipoFonteVerdade
{
    Manual,
    Api
}

/// <summary>RF04 — finalidade da conta/fundo (RN27: segregação por finalidade).</summary>
public enum FinalidadeConta
{
    Ordinario,
    Extraordinario,
    FundoReserva,
    FundoTrabalho,
    FundoAreaEspecifica
}

/// <summary>RF04, RN20 — tipo da regra de aporte periódico de um fundo.</summary>
public enum TipoRegraAporte
{
    ValorFixo,
    Percentual
}

/// <summary>RF05 — natureza do lançamento financeiro.</summary>
public enum TipoLancamento
{
    Entrada,
    Saida
}

/// <summary>RF05, RF16 — distingue lançamento real de lançamento simulado.</summary>
public enum OrigemLancamento
{
    Real,
    Simulado
}

/// <summary>RF05, RF15 — origem do dado do lançamento.</summary>
public enum FonteLancamento
{
    Manual,
    Integracao
}

/// <summary>RF06 — prioridade de uma necessidade.</summary>
public enum Prioridade
{
    Alta,
    Media,
    Baixa
}

/// <summary>RF06 — ciclo de vida único de uma necessidade.</summary>
public enum SituacaoNecessidade
{
    EmAnalise,
    EmOrcamento,
    Aprovado,
    Reprovado,
    Adiado,
    Executado
}

/// <summary>RF09 — resultado de uma decisão (evento histórico imutável).</summary>
public enum ResultadoDecisao
{
    Aprovado,
    Reprovado,
    Adiado
}

/// <summary>RF10, RF13 — status do compromisso financeiro, incluindo a fila de execução (RN11).</summary>
public enum StatusCompromisso
{
    AguardandoExecucao,
    EmFilaExecucao,
    EmExecucao,
    Concluido,
    Cancelado
}

/// <summary>RF11 — tipo de pagamento de um compromisso (RN16).</summary>
public enum TipoPagamento
{
    Entrada,
    Adiantamento,
    Parcela,
    Total
}

/// <summary>RF14, RN17 — transferência total (consolidada) ou individual.</summary>
public enum TipoTransferencia
{
    Total,
    Individual
}

/// <summary>RF14, RN18 — execução automática (via integração) ou checklist manual.</summary>
public enum ModoTransferencia
{
    Automatica,
    ChecklistManual
}

/// <summary>RF14 — se a transferência foi criada manualmente ou sugerida pelo sistema.</summary>
public enum OrigemTransferencia
{
    Manual,
    SugeridaPeloSistema
}

/// <summary>RF14 — os três motivos de um item na área de acerto.</summary>
public enum MotivoTransferencia
{
    Reposicao,
    Aporte,
    DestinacaoReceita
}

/// <summary>RN24 — status de um item da área de acerto.</summary>
public enum StatusTransferencia
{
    SemAjuste,
    Pendente,
    Ajustado
}

/// <summary>RF20 — tipos de entidade que podem ter um documento (referência textual) vinculado.</summary>
public enum EntidadeDocumento
{
    Necessidade,
    CompromissoFinanceiro,
    Pagamento,
    Decisao,
    Fornecedor
}
