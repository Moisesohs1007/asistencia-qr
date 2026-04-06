-- Migración: corregir RLS para usuarios sin app_metadata en el JWT
-- Ejecutar en el SQL Editor de Supabase Dashboard
--
-- PROBLEMA: auth_rol() y auth_colegio_id() solo leían app_metadata del JWT.
-- Si el usuario fue creado sin esos metadatos (ej: admin creado manualmente),
-- el RLS rechaza todas sus operaciones con "row-level security policy" error.
--
-- SOLUCIÓN: agregar fallback a la tabla `usuarios` cuando el JWT no tiene app_metadata.

CREATE OR REPLACE FUNCTION auth_colegio_id()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'colegio_id', ''),
    (SELECT colegio_id FROM usuarios WHERE id = auth.uid() LIMIT 1),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION auth_rol()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'rol', ''),
    (SELECT rol FROM usuarios WHERE id = auth.uid() LIMIT 1),
    ''
  )
$$;
