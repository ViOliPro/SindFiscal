-- Despesas futuras e projeção por fundo (RF13, RF16)
-- Adiciona campos de planejamento a necessidade e compromisso_financeiro, e a
-- flag de "fundo considerado no planejamento" a conta_bancaria.
-- Idempotente: seguro rodar mais de uma vez.
--
-- Uso: só é necessário se o banco já foi provisionado a partir de uma versão
-- anterior de schema.sql. Em uma base nova, schema.sql já inclui as colunas.

ALTER TABLE conta_bancaria
    ADD COLUMN IF NOT EXISTS considerado_no_planejamento boolean NOT NULL DEFAULT true;

-- A conta operacional é a conta física movimentada pela administradora, não um
-- fundo com finalidade própria: por padrão fica fora dos totais do planejamento.
UPDATE conta_bancaria SET considerado_no_planejamento = false WHERE eh_conta_operacional;

ALTER TABLE necessidade
    ADD COLUMN IF NOT EXISTS data_prevista     date,
    ADD COLUMN IF NOT EXISTS fundo_previsto_id uuid REFERENCES conta_bancaria(id),
    ADD COLUMN IF NOT EXISTS valor_estimado    numeric(14,2) CHECK (valor_estimado IS NULL OR valor_estimado >= 0);

ALTER TABLE compromisso_financeiro
    ADD COLUMN IF NOT EXISTS prioridade        varchar(10) CHECK (prioridade IN ('alta', 'media', 'baixa')),
    ADD COLUMN IF NOT EXISTS data_prevista     date,
    ADD COLUMN IF NOT EXISTS fundo_previsto_id uuid REFERENCES conta_bancaria(id);

CREATE INDEX IF NOT EXISTS ix_necessidade_fundo_previsto ON necessidade(fundo_previsto_id);
CREATE INDEX IF NOT EXISTS ix_compromisso_fundo_previsto ON compromisso_financeiro(fundo_previsto_id);
