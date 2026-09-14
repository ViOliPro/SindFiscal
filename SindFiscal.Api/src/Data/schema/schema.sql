-- ============================================================================
-- Sistema de Gestão Financeira e Administrativa para Síndico Profissional
-- Schema físico — PostgreSQL
--
-- Convenções adotadas:
--   - Chaves primárias: uuid (gen_random_uuid()), para suportar múltiplos
--     condomínios/tenants sem expor sequência incremental.
--   - Nomenclatura: snake_case, em português, espelhando a Especificação de
--     Requisitos (RF/RNF/RN) e o Diagrama Entidade-Relacionamento conceitual.
--   - Valores monetários: numeric(14,2) (nunca float/double).
--   - Enums fechados de negócio: implementados como text + CHECK constraint
--     (em vez de tipo ENUM nativo do Postgres), para permitir evolução da
--     lista de valores via migration simples, sem ALTER TYPE.
--   - created_at/updated_at em todas as tabelas, como apoio a RNF04/RNF06
--     (histórico) — não substituem o registro_auditoria, que é o mecanismo
--     de auditoria de negócio propriamente dito (RF19/RNF14).
--   - Associações polimórficas (documento, registro_auditoria) usam
--     entidade_tipo + entidade_id SEM foreign key (validação em nível de
--     aplicação), com CHECK restringindo os tipos válidos — abordagem
--     padrão para anexos/auditoria que precisam referenciar múltiplas
--     tabelas.
--   - Nenhuma tabela ou coluna referencia uma administradora específica
--     (RN01–RN03, RNF13) — config_integracao é agnóstica de fornecedor.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- fornece gen_random_uuid()

-- ----------------------------------------------------------------------------
-- USUARIO
-- ----------------------------------------------------------------------------
CREATE TABLE usuario (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            varchar(150) NOT NULL,
    email           varchar(200) NOT NULL UNIQUE,
    papel           varchar(20) NOT NULL
                        CHECK (papel IN ('sindico', 'colaborador', 'conselheiro_fiscal')),
    ativo           boolean NOT NULL DEFAULT true,
    senha_hash      varchar(255),   -- RF01 — hash simples v1 (SHA256+salt); nulo = bootstrap sem senha definida
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz
);

COMMENT ON TABLE usuario IS 'RF01, RF03 — síndico, colaboradores e conselheiros fiscais (RN29, RN30).';

-- ----------------------------------------------------------------------------
-- CONDOMINIO
-- ----------------------------------------------------------------------------
CREATE TABLE condominio (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sindico_id              uuid NOT NULL REFERENCES usuario(id),
    nome                    varchar(150) NOT NULL,
    possui_integracao_api   boolean NOT NULL DEFAULT false,
    valor_alcada_aprovacao  numeric(14,2),  -- RF10, RN07: alçada p/ validação do Conselho Fiscal, por condomínio
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz
);

CREATE INDEX ix_condominio_sindico ON condominio(sindico_id);

COMMENT ON TABLE condominio IS 'RF02 — condomínio administrado por um síndico (RN03: fonte de verdade não presumida como igual entre condomínios).';

-- ----------------------------------------------------------------------------
-- PERMISSAO (RF03, RN23/RN29 — granular por usuário/condomínio/módulo)
-- ----------------------------------------------------------------------------
CREATE TABLE permissao (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    condominio_id   uuid NOT NULL REFERENCES condominio(id) ON DELETE CASCADE,
    modulo          varchar(60) NOT NULL,
        -- valores esperados: ver Requisitos Funcionais §1.1 (11 módulos definidos)
    nivel           varchar(10) NOT NULL CHECK (nivel IN ('visualizar', 'editar')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz,
    CONSTRAINT uq_permissao UNIQUE (usuario_id, condominio_id, modulo)
);

CREATE INDEX ix_permissao_usuario_condominio ON permissao(usuario_id, condominio_id);

-- ----------------------------------------------------------------------------
-- CONFIGURACAO_INTEGRACAO (RF15, RNF13 — 1:1 com condomínio, agnóstica)
-- ----------------------------------------------------------------------------
CREATE TABLE configuracao_integracao (
    id                                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id                       uuid NOT NULL UNIQUE REFERENCES condominio(id) ON DELETE CASCADE,
    tipo_fonte_verdade                  varchar(10) NOT NULL DEFAULT 'manual'
                                            CHECK (tipo_fonte_verdade IN ('manual', 'api')),
    permite_transferencia_automatica    boolean NOT NULL DEFAULT false,
    created_at                          timestamptz NOT NULL DEFAULT now(),
    updated_at                          timestamptz
);

COMMENT ON TABLE configuracao_integracao IS 'Nesta versão, tipo_fonte_verdade é sempre manual para todos os condomínios (decisão de projeto, RF15) — campo mantido para permitir habilitar integração em fase futura sem alterar o schema.';

-- ----------------------------------------------------------------------------
-- CONTA_BANCARIA (RF04 — contas/fundos, com regra de aporte opcional)
-- ----------------------------------------------------------------------------
CREATE TABLE conta_bancaria (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id               uuid NOT NULL REFERENCES condominio(id) ON DELETE CASCADE,
    nome                        varchar(120) NOT NULL,
    finalidade                  varchar(30) NOT NULL
                                    CHECK (finalidade IN ('ordinario', 'extraordinario', 'fundo_reserva',
                                                           'fundo_trabalho', 'fundo_area_especifica')),
    eh_conta_operacional        boolean NOT NULL DEFAULT false,
    regra_aporte_tipo           varchar(12)
                                    CHECK (regra_aporte_tipo IN ('valor_fixo', 'percentual')),
    regra_aporte_valor          numeric(14,2),      -- valor fixo OU percentual (0-100), conforme regra_aporte_tipo
    teto_maximo                 numeric(14,2),      -- opcional (RN20)
    saldo_atual                 numeric(14,2) NOT NULL DEFAULT 0,
    aporte_pendente_acumulado   numeric(14,2) NOT NULL DEFAULT 0, -- RN21
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz,
    CONSTRAINT ck_conta_regra_aporte_completa
        CHECK (
            (regra_aporte_tipo IS NULL AND regra_aporte_valor IS NULL)
            OR (regra_aporte_tipo IS NOT NULL AND regra_aporte_valor IS NOT NULL)
        )
);

CREATE INDEX ix_conta_bancaria_condominio ON conta_bancaria(condominio_id);
-- No máximo uma conta operacional por condomínio:
CREATE UNIQUE INDEX uq_conta_operacional_por_condominio
    ON conta_bancaria(condominio_id) WHERE eh_conta_operacional;

COMMENT ON TABLE conta_bancaria IS 'RF04, RN20, RN21, RN27 — múltiplas contas/fundos por condomínio, com identificação da conta operacional e regra de aporte periódico opcional.';

-- ----------------------------------------------------------------------------
-- LANCAMENTO (RF05 — movimentação financeira real ou simulada)
-- ----------------------------------------------------------------------------
CREATE TABLE lancamento (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_bancaria_id   uuid NOT NULL REFERENCES conta_bancaria(id),
    data                date NOT NULL,
    tipo                varchar(10) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor               numeric(14,2) NOT NULL CHECK (valor > 0),
    origem              varchar(10) NOT NULL DEFAULT 'real'
                            CHECK (origem IN ('real', 'simulado')),         -- RF16
    fonte               varchar(12) NOT NULL DEFAULT 'manual'
                            CHECK (fonte IN ('manual', 'integracao')),      -- RF15
    descricao           text,
    estorno_de_id       uuid REFERENCES lancamento(id),                    -- RN32
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz
);

CREATE INDEX ix_lancamento_conta_data ON lancamento(conta_bancaria_id, data);
CREATE INDEX ix_lancamento_origem ON lancamento(origem);

COMMENT ON TABLE lancamento IS 'RF05, RN01–RN03, RN32 — lançamentos reais (fonte manual ou integração) e simulados (RF16), sempre distinguíveis pela coluna origem.';

-- ----------------------------------------------------------------------------
-- FORNECEDOR (RF08 — entidade do síndico, compartilhada entre condomínios)
-- ----------------------------------------------------------------------------
CREATE TABLE fornecedor (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sindico_id      uuid NOT NULL REFERENCES usuario(id),
    nome            varchar(150) NOT NULL,
    categoria       varchar(60) NOT NULL,
    avaliacao_nota  smallint CHECK (avaliacao_nota BETWEEN 1 AND 5),
    avaliacao_comentario text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz
);

CREATE INDEX ix_fornecedor_sindico ON fornecedor(sindico_id);

COMMENT ON TABLE fornecedor IS 'RF08, RN04 — fornecedor pertence ao síndico, não ao condomínio; avaliação em estrelas (1-5) + comentário livre.';

-- ----------------------------------------------------------------------------
-- NECESSIDADE (RF06)
-- ----------------------------------------------------------------------------
CREATE TABLE necessidade (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id   uuid NOT NULL REFERENCES condominio(id) ON DELETE CASCADE,
    responsavel_id  uuid REFERENCES usuario(id),
    descricao       text NOT NULL,
    categoria       varchar(60) NOT NULL,
        -- ex.: manutencao, obra, aquisicao, servicos, seguranca, administrativo, outros
    prioridade      varchar(10) CHECK (prioridade IN ('alta', 'media', 'baixa')),
    escopo_texto    text,                          -- RN06: escopo comum p/ comparação justa de cotações
    situacao        varchar(20) NOT NULL DEFAULT 'em_analise'
                        CHECK (situacao IN ('em_analise', 'em_orcamento', 'aprovado',
                                             'reprovado', 'adiado', 'executado')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz
);

CREATE INDEX ix_necessidade_condominio ON necessidade(condominio_id);
CREATE INDEX ix_necessidade_situacao ON necessidade(situacao);

-- ----------------------------------------------------------------------------
-- COTACAO (RF07)
-- ----------------------------------------------------------------------------
CREATE TABLE cotacao (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    necessidade_id          uuid NOT NULL REFERENCES necessidade(id) ON DELETE CASCADE,
    fornecedor_id           uuid NOT NULL REFERENCES fornecedor(id),
    valor                   numeric(14,2) NOT NULL CHECK (valor >= 0),
    prazo_execucao_dias     integer,
    garantia_descricao      varchar(200),
    condicoes_pagamento     varchar(200),
    validade                date,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz
);

CREATE INDEX ix_cotacao_necessidade ON cotacao(necessidade_id);
CREATE INDEX ix_cotacao_fornecedor ON cotacao(fornecedor_id);

COMMENT ON TABLE cotacao IS 'RF07, RN05, RN06 — quantidade livre de cotações por necessidade (1 a N).';

-- ----------------------------------------------------------------------------
-- DECISAO (RF09 — evento histórico, nunca sobrescrito)
-- ----------------------------------------------------------------------------
CREATE TABLE decisao (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    necessidade_id          uuid NOT NULL REFERENCES necessidade(id),
    cotacao_escolhida_id    uuid REFERENCES cotacao(id),
    responsavel_id          uuid NOT NULL REFERENCES usuario(id),
    data                    date NOT NULL,
    resultado               varchar(10) NOT NULL
                                CHECK (resultado IN ('aprovado', 'reprovado', 'adiado')),
    justificativa           text,
    referencia_respaldo     varchar(200),   -- nº da ata / assembleia (RF09)
    created_at              timestamptz NOT NULL DEFAULT now()
    -- Sem updated_at deliberadamente: decisão é evento histórico imutável (RNF05/RNF06).
    -- Alteração de escopo pós-aprovação gera NOVO registro de decisão (RN09), nunca update.
);

CREATE INDEX ix_decisao_necessidade ON decisao(necessidade_id);

-- ----------------------------------------------------------------------------
-- COMPROMISSO_FINANCEIRO (RF10, RF12, RF13 — inclui auto-relação pai/filho)
-- ----------------------------------------------------------------------------
CREATE TABLE compromisso_financeiro (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id           uuid NOT NULL REFERENCES condominio(id) ON DELETE CASCADE,
    necessidade_id          uuid REFERENCES necessidade(id),          -- 0..1 (RN15: pode ser avulso)
    compromisso_pai_id      uuid REFERENCES compromisso_financeiro(id), -- 0..1 (RF12, RN13/RN14)
    categoria               varchar(60) NOT NULL,
    valor_aprovado           numeric(14,2) NOT NULL CHECK (valor_aprovado >= 0),
    status                  varchar(20) NOT NULL DEFAULT 'aguardando_execucao'
                                CHECK (status IN ('aguardando_execucao', 'em_fila_execucao',
                                                   'em_execucao', 'concluido', 'cancelado')),
    prioridade_fila         integer,        -- posição manual na fila (RF13, RN11) — sem critério automático
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz
);

CREATE INDEX ix_compromisso_condominio ON compromisso_financeiro(condominio_id);
CREATE INDEX ix_compromisso_pai ON compromisso_financeiro(compromisso_pai_id);
CREATE INDEX ix_compromisso_status_fila ON compromisso_financeiro(condominio_id, status, prioridade_fila);

COMMENT ON TABLE compromisso_financeiro IS 'RF10, RF12, RF13, RN07, RN11–RN14 — compromisso "pai" pode ter "filhos" vinculados (mesma tabela, auto-relação).';

-- ----------------------------------------------------------------------------
-- PAGAMENTO (RF11 — parcial, entrada/adiantamento/parcela/total)
-- ----------------------------------------------------------------------------
CREATE TABLE pagamento (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    compromisso_id          uuid NOT NULL REFERENCES compromisso_financeiro(id) ON DELETE CASCADE,
    fundo_responsavel_id    uuid NOT NULL REFERENCES conta_bancaria(id),   -- RF11, RN19
    lancamento_id           uuid REFERENCES lancamento(id),                -- 0..1, reconciliação
    tipo                    varchar(12) NOT NULL
                                CHECK (tipo IN ('entrada', 'adiantamento', 'parcela', 'total')),
    valor                   numeric(14,2) NOT NULL CHECK (valor > 0),
    data                    date NOT NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz
);

CREATE INDEX ix_pagamento_compromisso ON pagamento(compromisso_id);
CREATE INDEX ix_pagamento_fundo_responsavel ON pagamento(fundo_responsavel_id);
CREATE INDEX ix_pagamento_lancamento ON pagamento(lancamento_id);

COMMENT ON TABLE pagamento IS 'RF11, RN15, RN16, RN19 — fundo_responsavel_id pode divergir da conta do lancamento_id vinculado; essa divergência é o gatilho da área de acerto (RN19).';

-- ----------------------------------------------------------------------------
-- RESERVA (RF21 — reservas de área comum, ex.: espaço gourmet via CondoMob)
-- ----------------------------------------------------------------------------
CREATE TABLE reserva (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id               uuid NOT NULL REFERENCES condominio(id) ON DELETE CASCADE,
    fundo_destino_id             uuid NOT NULL REFERENCES conta_bancaria(id),
    unidade                     varchar(20) NOT NULL,       -- apartamento/unidade
    morador_nome                varchar(150) NOT NULL,
    valor_destinado_ao_fundo    numeric(14,2) NOT NULL CHECK (valor_destinado_ao_fundo > 0),
    pago_com_desconto           boolean,                    -- informativo (RN23); não afeta o valor
    periodo_referencia          date NOT NULL,              -- mês/ano de referência da reserva
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz
);

CREATE INDEX ix_reserva_condominio_periodo ON reserva(condominio_id, periodo_referencia);
CREATE INDEX ix_reserva_fundo_destino ON reserva(fundo_destino_id);

COMMENT ON TABLE reserva IS 'RF21, RN23 — origem: lista que a síndica levanta via CondoMob e repassa à administradora; valor não muda com o desconto de pontualidade.';

-- ----------------------------------------------------------------------------
-- TRANSFERENCIA / ÁREA DE ACERTO (RF14 — reposição, aporte, destinação de receita)
-- ----------------------------------------------------------------------------
CREATE TABLE transferencia (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id       uuid NOT NULL REFERENCES condominio(id) ON DELETE CASCADE,
    conta_origem_id     uuid NOT NULL REFERENCES conta_bancaria(id),
    conta_destino_id    uuid NOT NULL REFERENCES conta_bancaria(id),
    valor               numeric(14,2) NOT NULL CHECK (valor > 0),
    tipo                varchar(10) NOT NULL DEFAULT 'individual'
                            CHECK (tipo IN ('total', 'individual')),          -- RN17
    modo                varchar(16) NOT NULL DEFAULT 'checklist_manual'
                            CHECK (modo IN ('automatica', 'checklist_manual')), -- RN18
    origem              varchar(30) NOT NULL DEFAULT 'sugerida_pelo_sistema'
                            CHECK (origem IN ('manual', 'sugerida_pelo_sistema')),
    motivo              varchar(20) NOT NULL
                            CHECK (motivo IN ('reposicao', 'aporte', 'destinacao_receita')), -- RF14 (a)(b)(c)
    status              varchar(16) NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('sem_ajuste', 'pendente', 'ajustado')),  -- RN24
    data_execucao       date,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz,
    CONSTRAINT ck_transferencia_contas_diferentes CHECK (conta_origem_id <> conta_destino_id)
);

CREATE INDEX ix_transferencia_condominio_status ON transferencia(condominio_id, status);
CREATE INDEX ix_transferencia_motivo ON transferencia(motivo);

-- Tabela de junção: quais pagamentos compõem um item de transferência
-- (suporta RN17: uma transferência pode consolidar N pagamentos de reposição).
CREATE TABLE transferencia_pagamento (
    transferencia_id    uuid NOT NULL REFERENCES transferencia(id) ON DELETE CASCADE,
    pagamento_id        uuid NOT NULL REFERENCES pagamento(id),
    PRIMARY KEY (transferencia_id, pagamento_id)
);

-- Tabela de junção: quais reservas compõem um item de destinação de receita
-- (suporta RN23: soma do período compõe um único item de acerto).
CREATE TABLE transferencia_reserva (
    transferencia_id    uuid NOT NULL REFERENCES transferencia(id) ON DELETE CASCADE,
    reserva_id          uuid NOT NULL REFERENCES reserva(id),
    PRIMARY KEY (transferencia_id, reserva_id)
);

COMMENT ON TABLE transferencia IS 'RF14, RN17–RN24 — área de acerto; motivo distingue reposição, aporte periódico e destinação de receita.';

-- ----------------------------------------------------------------------------
-- DOCUMENTO (RF20 — referência textual, sem upload de arquivo nesta versão)
-- ----------------------------------------------------------------------------
CREATE TABLE documento (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entidade_tipo       varchar(30) NOT NULL
                            CHECK (entidade_tipo IN ('necessidade', 'compromisso_financeiro',
                                                      'pagamento', 'decisao', 'fornecedor')),
    entidade_id         uuid NOT NULL,          -- sem FK (associação polimórfica) — ver nota no topo do arquivo
    tipo_documento      varchar(40) NOT NULL,   -- ex.: nota_fiscal, comprovante, ata, certificado
    referencia_texto    text NOT NULL,          -- nº da NF, descrição do comprovante etc. (sem upload)
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz
);

CREATE INDEX ix_documento_entidade ON documento(entidade_tipo, entidade_id);

COMMENT ON TABLE documento IS 'RF20 — nesta versão, apenas referência textual (nº NF, descrição). Upload real de arquivo é evolução futura; quando implementado, adicionar coluna arquivo_ref/arquivo_url nesta mesma tabela.';

-- ----------------------------------------------------------------------------
-- REGISTRO_AUDITORIA (RF19, RNF04, RNF14 — imutável)
-- ----------------------------------------------------------------------------
CREATE TABLE registro_auditoria (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entidade_tipo       varchar(30) NOT NULL,   -- sem CHECK fechado: auditoria cobre qualquer tabela de negócio
    entidade_id         uuid NOT NULL,          -- sem FK (associação polimórfica)
    condominio_id       uuid REFERENCES condominio(id), -- nulo quando a entidade não pertence a um condomínio (ex.: Fornecedor, RN04)
    usuario_id          uuid NOT NULL REFERENCES usuario(id),
    data_hora           timestamptz NOT NULL DEFAULT now(),
    campo_alterado      varchar(60) NOT NULL,
    valor_anterior      text,
    valor_novo          text
    -- Tabela somente-INSERT: nenhuma coluna de update, nenhum UPDATE/DELETE
    -- deve ser permitido a nível de aplicação e de permissões de banco (RNF14).
);

CREATE INDEX ix_auditoria_entidade ON registro_auditoria(entidade_tipo, entidade_id);
CREATE INDEX ix_auditoria_usuario ON registro_auditoria(usuario_id);
CREATE INDEX ix_auditoria_data ON registro_auditoria(data_hora);
CREATE INDEX ix_auditoria_condominio ON registro_auditoria(condominio_id);

COMMENT ON TABLE registro_auditoria IS 'RF19, RNF04, RNF14 — recomenda-se REVOKE UPDATE, DELETE ON registro_auditoria FROM roles de aplicação, permitindo apenas INSERT/SELECT, para reforçar a imutabilidade a nível de banco.';

-- ============================================================================
-- Fim do schema inicial.
-- Pontos deliberadamente fora deste schema (ver Especificação, Seção 8 -
-- Pontos em Aberto, já todos resolvidos, e Seção 2 - Escopo):
--   - Upload de arquivo real (RF20): reavaliar quando aprovado.
--   - Estrutura de custo/cobertura de API por administradora (RF15).
-- ============================================================================
