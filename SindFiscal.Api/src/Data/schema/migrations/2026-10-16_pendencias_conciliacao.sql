-- Pendências de consistência (RF17): permite dispensar a conciliação de uma saída real
-- (ex.: despesa ordinária paga pela administradora, RN25), com motivo.
-- Idempotente. Em base nova, schema.sql já inclui as colunas.

ALTER TABLE lancamento
    ADD COLUMN IF NOT EXISTS conciliacao_dispensada boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS motivo_dispensa        varchar(200);
