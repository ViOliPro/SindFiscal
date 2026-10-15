-- =============================================================================
-- Migration: modelos de acesso (RF03) — tabelas modelo_acesso e modelo_acesso_item
-- Idempotente. Não altera a tabela permissao (continua sendo a fonte de verdade).
-- =============================================================================

CREATE TABLE IF NOT EXISTS modelo_acesso (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sindico_id      uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    nome            varchar(60) NOT NULL,
    descricao       varchar(200),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz,
    CONSTRAINT uq_modelo_acesso_nome UNIQUE (sindico_id, nome)
);

CREATE TABLE IF NOT EXISTS modelo_acesso_item (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    modelo_acesso_id    uuid NOT NULL REFERENCES modelo_acesso(id) ON DELETE CASCADE,
    modulo              varchar(60) NOT NULL,
    nivel               varchar(10) NOT NULL CHECK (nivel IN ('visualizar', 'editar')),
    CONSTRAINT uq_modelo_acesso_item UNIQUE (modelo_acesso_id, modulo)
);

COMMENT ON TABLE modelo_acesso IS 'Perfis de acesso reutilizáveis (Consulta, Operacional, Gestor). Aplicar copia os itens para permissao.';
