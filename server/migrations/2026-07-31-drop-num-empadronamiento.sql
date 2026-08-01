-- Migration: remove deprecated afiliados column
-- Safe for MySQL 8.0+ (uses IF EXISTS)

ALTER TABLE afiliados
  DROP COLUMN IF EXISTS num_empadronamiento;
