-- Migración: agregar columna primer_ingreso a la tabla apoderados
-- Ejecutar en el SQL Editor de Supabase Dashboard

ALTER TABLE apoderados
  ADD COLUMN IF NOT EXISTS primer_ingreso BOOLEAN NOT NULL DEFAULT TRUE;
