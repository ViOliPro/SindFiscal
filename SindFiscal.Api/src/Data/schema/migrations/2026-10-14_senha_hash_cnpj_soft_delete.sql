-- =============================================================================
-- Migration: senha_hash sem UNIQUE + CNPJ + soft-delete em condominio
-- Idempotente. Rodar no Postgres do ambiente local/dev.
-- =============================================================================

-- 1) senha_hash: remover UNIQUE indevido (vários usuários podem ter o mesmo hash
--    provisório; com salt fixo o hash colide). Email permanece UNIQUE.
DO $$
DECLARE
    r record;
BEGIN
    -- Remove qualquer unique constraint/index que envolva apenas senha_hash
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'usuario'
          AND c.contype = 'u'
          AND pg_get_constraintdef(c.oid) ILIKE '%senha_hash%'
    LOOP
        EXECUTE format('ALTER TABLE usuario DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    FOR r IN
        SELECT i.indexname
        FROM pg_indexes i
        WHERE i.tablename = 'usuario'
          AND i.indexdef ILIKE '%UNIQUE%'
          AND i.indexdef ILIKE '%senha_hash%'
          AND i.indexdef NOT ILIKE '%email%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- Garante coluna no formato correto (nullable, sem unique)
ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS senha_hash varchar(255);

-- Se a coluna antiga veio como NOT NULL UNIQUE (schema quebrado), alinha:
ALTER TABLE usuario ALTER COLUMN senha_hash DROP NOT NULL;

-- 2) condominio: CNPJ opcional + UNIQUE parcial (só quando informado)
ALTER TABLE condominio
    ADD COLUMN IF NOT EXISTS cnpj varchar(18);

-- Índice único parcial: permite vários NULL; CNPJ informado deve ser único
CREATE UNIQUE INDEX IF NOT EXISTS uq_condominio_cnpj
    ON condominio (cnpj)
    WHERE cnpj IS NOT NULL AND btrim(cnpj) <> '';

-- 3) condominio: soft-delete (Ativo)
ALTER TABLE condominio
    ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN condominio.cnpj IS 'CNPJ opcional do condomínio; UNIQUE quando informado.';
COMMENT ON COLUMN condominio.ativo IS 'Soft-delete: false = inativo (não aparece em listagens padrão).';
COMMENT ON COLUMN usuario.senha_hash IS 'Hash SHA256+salt v1; NÃO é UNIQUE.';
