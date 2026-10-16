-- Receitas/transferências recorrentes na área de acerto (RF14, RN20, RN22)
-- Idempotente: seguro rodar mais de uma vez. Em base nova, schema.sql já inclui tudo isto.

CREATE TABLE IF NOT EXISTS receita_recorrente (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    condominio_id    uuid NOT NULL REFERENCES condominio(id) ON DELETE CASCADE,
    descricao        varchar(150) NOT NULL,
    valor            numeric(14,2) NOT NULL CONSTRAINT ck_receita_recorrente_valor CHECK (valor > 0),
    conta_origem_id  uuid NOT NULL REFERENCES conta_bancaria(id),
    conta_destino_id uuid NOT NULL REFERENCES conta_bancaria(id),
    motivo           varchar(20) NOT NULL CHECK (motivo IN ('aporte', 'destinacao_receita')),
    data_inicio      date NOT NULL,
    data_fim         date,
    ativa            boolean NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz,
    CONSTRAINT ck_receita_recorrente_contas_diferentes CHECK (conta_origem_id <> conta_destino_id),
    CONSTRAINT ck_receita_recorrente_periodo CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS ix_receita_recorrente_condominio_ativa
    ON receita_recorrente(condominio_id, ativa);

ALTER TABLE transferencia
    ADD COLUMN IF NOT EXISTS descricao             varchar(150),
    ADD COLUMN IF NOT EXISTS receita_recorrente_id uuid REFERENCES receita_recorrente(id),
    ADD COLUMN IF NOT EXISTS periodo_referencia    date;

-- A mesma recorrência não gera dois itens no mesmo período (NULLs não colidem).
CREATE UNIQUE INDEX IF NOT EXISTS ux_transferencia_recorrencia_periodo
    ON transferencia(receita_recorrente_id, periodo_referencia);
