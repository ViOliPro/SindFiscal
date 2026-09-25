-- RF01 — Autenticação
-- Adiciona a coluna senha_hash à tabela usuario. Essa coluna já era usada
-- pela entidade Usuario/AuthController (hash simples SHA256+salt, v1) mas
-- nunca tinha sido consolidada em schema.sql nem em uma migration — quem
-- provisionou o banco antes desta data está sem a coluna.
-- Idempotente: seguro rodar mais de uma vez.
--
-- Uso: só é necessário se o banco já foi provisionado a partir de uma versão
-- anterior de schema.sql. Em uma base nova, schema.sql já inclui a coluna.

ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS senha_hash varchar(255);
