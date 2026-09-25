-- Módulo 10 (Auditoria) — RF19
-- Adiciona condominio_id à tabela de auditoria, para permitir filtrar o
-- histórico por condomínio (nulo para entidades sem condomínio único,
-- ex.: Fornecedor, RN04). Populado a partir de agora pelo
-- AuditoriaSaveChangesInterceptor; registros antigos ficam com o campo nulo.
-- Idempotente: seguro rodar mais de uma vez.
--
-- Uso: só é necessário se o banco já foi provisionado a partir de uma versão
-- anterior de schema.sql. Em uma base nova, schema.sql já inclui a coluna.

ALTER TABLE registro_auditoria
    ADD COLUMN IF NOT EXISTS condominio_id uuid REFERENCES condominio(id);

CREATE INDEX IF NOT EXISTS ix_auditoria_condominio ON registro_auditoria(condominio_id);
