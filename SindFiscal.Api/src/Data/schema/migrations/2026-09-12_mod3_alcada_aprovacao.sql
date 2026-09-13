-- Módulo 3 (Decisões + Compromissos + gastos vinculados) — RF10, RN07
-- Adiciona a alçada de aprovação configurável por condomínio.
-- Idempotente: seguro rodar mais de uma vez.
--
-- Uso: só é necessário se o banco já foi provisionado a partir de uma versão
-- anterior de schema.sql. Em uma base nova, schema.sql já inclui a coluna.

ALTER TABLE condominio
    ADD COLUMN IF NOT EXISTS valor_alcada_aprovacao numeric(14,2);
