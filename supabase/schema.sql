-- ============================================================
-- ASISTENCIA QR — Esquema Supabase (Multi-tenant)
-- Cada colegio tiene su propio colegio_id.
-- RLS garantiza que cada usuario solo ve datos de su colegio.
-- ============================================================

-- ── Extensiones necesarias ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ============================================================
-- TABLA PRINCIPAL: colegios
-- Una fila por institución educativa cliente.
-- Contiene configuración, horarios y credenciales WhatsApp.
-- ============================================================
CREATE TABLE IF NOT EXISTS colegios (
  id                  TEXT        PRIMARY KEY,  -- 'marello', 'san_jose', etc.
  nombre              TEXT        NOT NULL,
  anio                TEXT        NOT NULL DEFAULT '2026',
  eslogan             TEXT        DEFAULT '',
  logo_url            TEXT        DEFAULT '',
  apo_domain          TEXT        NOT NULL DEFAULT '@apo.marello.pe',
  -- Configuración de horarios/grados/secciones (JSON igual que Firestore)
  niveles             JSONB       NOT NULL DEFAULT '[
    {"nombre":"Inicial",    "horaApertura":"07:00","horaLimite":"08:00","horaCorte":"10:30","horaSalida":"13:00"},
    {"nombre":"Primaria",   "horaApertura":"07:00","horaLimite":"08:00","horaCorte":"10:30","horaSalida":"13:00"},
    {"nombre":"Secundaria", "horaApertura":"06:30","horaLimite":"07:45","horaCorte":"10:00","horaSalida":"13:00"}
  ]',
  grados              JSONB       NOT NULL DEFAULT '{
    "Inicial":    ["3 años","4 años","5 años"],
    "Primaria":   ["1er","2do","3er","4to","5to","6to"],
    "Secundaria": ["7mo","8vo","9no","10mo","11mo"]
  }',
  secciones           JSONB       NOT NULL DEFAULT '["A","B","C","D"]',
  -- Credenciales Factiliza/WhatsApp (guardadas encriptadas en producción)
  factiliza_token     TEXT        DEFAULT '',
  factiliza_instancia TEXT        DEFAULT '',
  -- Imágenes del banner de login (array de URLs)
  banner_imagenes     JSONB       NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ALUMNOS
-- DNI es PK dentro del colegio (no puede haber dos alumnos con
-- el mismo DNI en el mismo colegio).
-- ============================================================
CREATE TABLE IF NOT EXISTS alumnos (
  colegio_id          TEXT        NOT NULL REFERENCES colegios(id) ON DELETE CASCADE,
  id                  TEXT        NOT NULL,   -- DNI, 8 dígitos
  nombres             TEXT        NOT NULL DEFAULT '',
  apellidos           TEXT        NOT NULL DEFAULT '',
  grado               TEXT        NOT NULL DEFAULT '',
  seccion             TEXT        NOT NULL DEFAULT 'A',
  turno               TEXT        NOT NULL DEFAULT 'Primaria',  -- nivel
  limite              TEXT        NOT NULL DEFAULT '08:00',     -- hora límite puntualidad (denorm de config)
  foto                TEXT        NOT NULL DEFAULT '',          -- base64 o URL
  apoderado_nombres   TEXT        NOT NULL DEFAULT '',
  apoderado_apellidos TEXT        NOT NULL DEFAULT '',
  telefono            TEXT        NOT NULL DEFAULT '',
  apoderado2_nombres  TEXT        NOT NULL DEFAULT '',
  apoderado2_apellidos TEXT       NOT NULL DEFAULT '',
  telefono2           TEXT        NOT NULL DEFAULT '',
  correo_apoderado    TEXT        NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (colegio_id, id)
);

-- ============================================================
-- USUARIOS (personal del colegio)
-- Vinculado a auth.users de Supabase por el UUID.
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  colegio_id          TEXT        NOT NULL REFERENCES colegios(id) ON DELETE CASCADE,
  nombre              TEXT        NOT NULL,
  email               TEXT        NOT NULL,
  rol                 TEXT        NOT NULL CHECK (rol IN ('admin','director','profesor','portero')),
  cargo               TEXT        NOT NULL DEFAULT '',
  telefono            TEXT        NOT NULL DEFAULT '',
  restringir          BOOLEAN     NOT NULL DEFAULT FALSE,
  asignaciones        JSONB       NOT NULL DEFAULT '{}',  -- { "1er": ["A","B"] }
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REGISTROS DE ASISTENCIA
-- Cada fila = un evento de ingreso o salida de un alumno.
-- ============================================================
CREATE TABLE IF NOT EXISTS registros (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  colegio_id          TEXT        NOT NULL REFERENCES colegios(id) ON DELETE CASCADE,
  alumno_id           TEXT        NOT NULL,   -- DNI
  tipo                TEXT        NOT NULL CHECK (tipo IN ('INGRESO','SALIDA')),
  fecha               DATE        NOT NULL,
  hora                TEXT        NOT NULL,   -- 'HH:MM' — texto para compat. con código actual
  estado              TEXT        NOT NULL DEFAULT 'Puntual' CHECK (estado IN ('Puntual','Tardanza')),
  -- Campos denormalizados para reportes sin JOIN
  nombre              TEXT        NOT NULL DEFAULT '',
  grado               TEXT        NOT NULL DEFAULT '',
  seccion             TEXT        NOT NULL DEFAULT '',
  turno               TEXT        NOT NULL DEFAULT '',
  registrado_por      TEXT        NOT NULL DEFAULT '',  -- email del staff
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (colegio_id, alumno_id) REFERENCES alumnos(colegio_id, id) ON DELETE CASCADE
);

-- ============================================================
-- RESUMEN MENSUAL (pre-agregado)
-- Una fila por alumno por mes — evita releer todos los registros.
-- Equivalente a la colección resumen_mensual de Firestore.
-- ============================================================
CREATE TABLE IF NOT EXISTS resumen_mensual (
  colegio_id          TEXT        NOT NULL REFERENCES colegios(id) ON DELETE CASCADE,
  mes                 TEXT        NOT NULL,   -- 'YYYY-MM'
  alumno_id           TEXT        NOT NULL,
  puntual             INTEGER     NOT NULL DEFAULT 0,
  tardanza            INTEGER     NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (colegio_id, mes, alumno_id),
  FOREIGN KEY (colegio_id, alumno_id) REFERENCES alumnos(colegio_id, id) ON DELETE CASCADE
);

-- ============================================================
-- INCIDENTES
-- Reportes de comportamiento/accidentes con PDF adjunto.
-- ============================================================
CREATE TABLE IF NOT EXISTS incidentes (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  colegio_id            TEXT        NOT NULL REFERENCES colegios(id) ON DELETE CASCADE,
  alumno_id             TEXT        NOT NULL,
  alumno_nombre         TEXT        NOT NULL DEFAULT '',
  grado                 TEXT        NOT NULL DEFAULT '',
  seccion               TEXT        NOT NULL DEFAULT '',
  turno                 TEXT        NOT NULL DEFAULT '',
  tipo                  TEXT        NOT NULL DEFAULT '',
  severidad             TEXT        NOT NULL DEFAULT 'Leve' CHECK (severidad IN ('Leve','Moderado','Grave')),
  fecha                 DATE        NOT NULL,
  hora                  TEXT        NOT NULL DEFAULT '',
  descripcion           TEXT        NOT NULL DEFAULT '',
  medidas               TEXT        NOT NULL DEFAULT '',
  tiene_imagenes        BOOLEAN     NOT NULL DEFAULT FALSE,
  cant_imagenes         INTEGER     NOT NULL DEFAULT 0,
  pdf_url               TEXT        NOT NULL DEFAULT '',
  pdf_ref               TEXT        NOT NULL DEFAULT '',
  pdf_expira_staff      DATE,
  pdf_expira_apoderado  DATE,
  pdf_activo            BOOLEAN     NOT NULL DEFAULT FALSE,
  responsable_id        UUID        REFERENCES auth.users(id),
  responsable_nombre    TEXT        NOT NULL DEFAULT '',
  responsable_cargo     TEXT        NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (colegio_id, alumno_id) REFERENCES alumnos(colegio_id, id) ON DELETE CASCADE
);

-- ============================================================
-- APODERADOS (datos del portal de padres)
-- auth.users ya maneja la autenticación.
-- Esta tabla guarda datos extra del portal (última visita, etc.).
-- ============================================================
CREATE TABLE IF NOT EXISTS apoderados (
  colegio_id          TEXT        NOT NULL REFERENCES colegios(id) ON DELETE CASCADE,
  alumno_id           TEXT        NOT NULL,   -- DNI = identificador de la cuenta
  primer_ingreso      BOOLEAN     NOT NULL DEFAULT TRUE,  -- fuerza cambio de contraseña al 1er login
  ultima_visita       TIMESTAMPTZ,
  notif_ingreso       BOOLEAN     NOT NULL DEFAULT TRUE,
  notif_salida        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (colegio_id, alumno_id),
  FOREIGN KEY (colegio_id, alumno_id) REFERENCES alumnos(colegio_id, id) ON DELETE CASCADE
);

-- ============================================================
-- ÍNDICES — optimizan las consultas más frecuentes
-- ============================================================

-- Registros: consulta por fecha (escáner + tab Registro)
CREATE INDEX IF NOT EXISTS idx_registros_fecha
  ON registros(colegio_id, fecha);

-- Registros: consulta por alumno (portal apoderado + historial)
CREATE INDEX IF NOT EXISTS idx_registros_alumno
  ON registros(colegio_id, alumno_id);

-- Registros: consulta por mes (tab Reportes — optimiza WHERE fecha BETWEEN)
-- Nota: DATE_TRUNC no es IMMUTABLE, usamos índice en año+mes extraídos como columnas
CREATE INDEX IF NOT EXISTS idx_registros_mes
  ON registros(colegio_id, fecha);

-- Alumnos: consulta por grado+sección (profesores con restricción)
CREATE INDEX IF NOT EXISTS idx_alumnos_grado_seccion
  ON alumnos(colegio_id, grado, seccion);

-- Resumen mensual: consulta por mes
CREATE INDEX IF NOT EXISTS idx_resumen_mes
  ON resumen_mensual(colegio_id, mes);

-- Incidentes: consulta por alumno
CREATE INDEX IF NOT EXISTS idx_incidentes_alumno
  ON incidentes(colegio_id, alumno_id);

-- Usuarios: búsqueda por colegio
CREATE INDEX IF NOT EXISTS idx_usuarios_colegio
  ON usuarios(colegio_id);

-- ============================================================
-- FUNCIONES AUXILIARES PARA RLS
-- Leen el JWT del usuario autenticado — equivalente a las
-- funciones isAdmin(), isStaff(), etc. de firestore.rules
-- ============================================================

-- Retorna el colegio_id del usuario autenticado
-- Primero lee app_metadata del JWT; si no tiene, consulta la tabla usuarios (SECURITY DEFINER omite RLS)
CREATE OR REPLACE FUNCTION auth_colegio_id()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'colegio_id', ''),
    (SELECT colegio_id FROM usuarios WHERE id = auth.uid() LIMIT 1),
    ''
  )
$$;

-- Retorna el rol del usuario ('admin','director','profesor','portero','apoderado')
-- Primero lee app_metadata del JWT; si no tiene, consulta la tabla usuarios (SECURITY DEFINER omite RLS)
CREATE OR REPLACE FUNCTION auth_rol()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'rol', ''),
    (SELECT rol FROM usuarios WHERE id = auth.uid() LIMIT 1),
    ''
  )
$$;

-- Retorna el alumno_id (DNI) para cuentas de apoderado
CREATE OR REPLACE FUNCTION auth_alumno_id()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'alumno_id',
    ''
  )
$$;

-- Verifica si es personal del colegio (cualquier rol excepto apoderado)
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth_rol() IN ('admin','director','profesor','portero')
$$;

-- Verifica si es administrador
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth_rol() = 'admin'
$$;

-- Verifica si es apoderado
CREATE OR REPLACE FUNCTION is_apoderado()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth_rol() = 'apoderado'
$$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Equivalente a firestore.rules — cada usuario solo ve su colegio.
-- ============================================================

ALTER TABLE colegios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE alumnos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros        ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumen_mensual  ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidentes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE apoderados       ENABLE ROW LEVEL SECURITY;

-- ── colegios ─────────────────────────────────────────────────
-- Staff puede leer su colegio. Solo admin puede modificarlo.
DROP POLICY IF EXISTS "colegios_read"  ON colegios;
DROP POLICY IF EXISTS "colegios_write" ON colegios;
CREATE POLICY "colegios_read"   ON colegios FOR SELECT
  USING (id = auth_colegio_id() AND (is_staff() OR is_apoderado()));

CREATE POLICY "colegios_write"  ON colegios FOR ALL
  USING (id = auth_colegio_id() AND is_admin());

-- ── alumnos ──────────────────────────────────────────────────
-- Staff: lectura total. Admin: escritura.
-- Apoderado: solo su propio alumno (por DNI).
DROP POLICY IF EXISTS "alumnos_staff_read"     ON alumnos;
DROP POLICY IF EXISTS "alumnos_apoderado_read" ON alumnos;
DROP POLICY IF EXISTS "alumnos_admin_write"    ON alumnos;
CREATE POLICY "alumnos_staff_read"     ON alumnos FOR SELECT
  USING (colegio_id = auth_colegio_id() AND is_staff());

CREATE POLICY "alumnos_apoderado_read" ON alumnos FOR SELECT
  USING (colegio_id = auth_colegio_id() AND is_apoderado() AND id = auth_alumno_id());

CREATE POLICY "alumnos_admin_write"    ON alumnos FOR ALL
  USING (colegio_id = auth_colegio_id() AND is_admin());

-- ── usuarios ─────────────────────────────────────────────────
-- Staff: lectura de su colegio. Admin: escritura.
-- Self: cualquier usuario puede leer su propio registro (necesario para login).
DROP POLICY IF EXISTS "usuarios_read"      ON usuarios;
DROP POLICY IF EXISTS "usuarios_self_read" ON usuarios;
DROP POLICY IF EXISTS "usuarios_write"     ON usuarios;
CREATE POLICY "usuarios_read"      ON usuarios FOR SELECT
  USING (colegio_id = auth_colegio_id() AND is_staff());

CREATE POLICY "usuarios_self_read" ON usuarios FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "usuarios_write"  ON usuarios FOR ALL
  USING (colegio_id = auth_colegio_id() AND is_admin());

-- ── registros ────────────────────────────────────────────────
-- Staff: lectura total y creación propia.
-- Apoderado: solo sus registros (con límite).
-- Solo admin puede modificar/borrar.
DROP POLICY IF EXISTS "registros_staff_read"     ON registros;
DROP POLICY IF EXISTS "registros_staff_insert"   ON registros;
DROP POLICY IF EXISTS "registros_apoderado_read" ON registros;
DROP POLICY IF EXISTS "registros_admin_write"    ON registros;
DROP POLICY IF EXISTS "registros_admin_delete"   ON registros;
CREATE POLICY "registros_staff_read"     ON registros FOR SELECT
  USING (colegio_id = auth_colegio_id() AND is_staff());

CREATE POLICY "registros_staff_insert"   ON registros FOR INSERT
  WITH CHECK (colegio_id = auth_colegio_id() AND is_staff());

CREATE POLICY "registros_apoderado_read" ON registros FOR SELECT
  USING (colegio_id = auth_colegio_id() AND is_apoderado() AND alumno_id = auth_alumno_id());

CREATE POLICY "registros_admin_write"    ON registros FOR UPDATE USING (colegio_id = auth_colegio_id() AND is_admin());
CREATE POLICY "registros_admin_delete"   ON registros FOR DELETE USING (colegio_id = auth_colegio_id() AND is_admin());

-- ── resumen_mensual ──────────────────────────────────────────
-- Staff: lectura y escritura (el escáner actualiza el resumen).
-- Apoderado: solo su alumno.
DROP POLICY IF EXISTS "resumen_staff"          ON resumen_mensual;
DROP POLICY IF EXISTS "resumen_apoderado_read" ON resumen_mensual;
CREATE POLICY "resumen_staff"          ON resumen_mensual FOR ALL
  USING (colegio_id = auth_colegio_id() AND is_staff());

CREATE POLICY "resumen_apoderado_read" ON resumen_mensual FOR SELECT
  USING (colegio_id = auth_colegio_id() AND is_apoderado() AND alumno_id = auth_alumno_id());

-- ── incidentes ───────────────────────────────────────────────
-- Staff: lectura total, creación propia, actualización si es responsable.
-- Apoderado: solo sus incidentes.
-- Solo admin puede borrar.
DROP POLICY IF EXISTS "incidentes_staff_read"      ON incidentes;
DROP POLICY IF EXISTS "incidentes_staff_insert"    ON incidentes;
DROP POLICY IF EXISTS "incidentes_responsable_upd" ON incidentes;
DROP POLICY IF EXISTS "incidentes_admin_delete"    ON incidentes;
DROP POLICY IF EXISTS "incidentes_apoderado_read"  ON incidentes;
CREATE POLICY "incidentes_staff_read"      ON incidentes FOR SELECT
  USING (colegio_id = auth_colegio_id() AND is_staff());

CREATE POLICY "incidentes_staff_insert"    ON incidentes FOR INSERT
  WITH CHECK (colegio_id = auth_colegio_id() AND is_staff());

CREATE POLICY "incidentes_responsable_upd" ON incidentes FOR UPDATE
  USING (colegio_id = auth_colegio_id() AND is_staff() AND
         (is_admin() OR responsable_id = auth.uid()));

CREATE POLICY "incidentes_admin_delete"    ON incidentes FOR DELETE
  USING (colegio_id = auth_colegio_id() AND is_admin());

CREATE POLICY "incidentes_apoderado_read"  ON incidentes FOR SELECT
  USING (colegio_id = auth_colegio_id() AND is_apoderado() AND alumno_id = auth_alumno_id());

-- ── apoderados ───────────────────────────────────────────────
-- Staff: lectura y escritura. Apoderado: solo su propio doc.
DROP POLICY IF EXISTS "apoderados_staff"       ON apoderados;
DROP POLICY IF EXISTS "apoderados_self_read"   ON apoderados;
DROP POLICY IF EXISTS "apoderados_self_update" ON apoderados;
CREATE POLICY "apoderados_staff"          ON apoderados FOR ALL
  USING (colegio_id = auth_colegio_id() AND is_staff());

CREATE POLICY "apoderados_self_read"      ON apoderados FOR SELECT
  USING (colegio_id = auth_colegio_id() AND is_apoderado() AND alumno_id = auth_alumno_id());

CREATE POLICY "apoderados_self_update"    ON apoderados FOR UPDATE
  USING (colegio_id = auth_colegio_id() AND is_apoderado() AND alumno_id = auth_alumno_id());

-- ============================================================
-- FUNCIÓN: upsert_resumen_mensual
-- Equivalente al FieldValue.increment() de Firestore.
-- Se llama cada vez que se registra un INGRESO.
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_resumen_mensual(
  p_colegio_id  TEXT,
  p_mes         TEXT,
  p_alumno_id   TEXT,
  p_es_tardanza BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO resumen_mensual(colegio_id, mes, alumno_id, puntual, tardanza)
  VALUES (
    p_colegio_id, p_mes, p_alumno_id,
    CASE WHEN p_es_tardanza THEN 0 ELSE 1 END,
    CASE WHEN p_es_tardanza THEN 1 ELSE 0 END
  )
  ON CONFLICT (colegio_id, mes, alumno_id) DO UPDATE SET
    puntual    = resumen_mensual.puntual  + CASE WHEN p_es_tardanza THEN 0 ELSE 1 END,
    tardanza   = resumen_mensual.tardanza + CASE WHEN p_es_tardanza THEN 1 ELSE 0 END,
    updated_at = NOW();
END;
$$;

-- ============================================================
-- FUNCIÓN: recalcular_resumen_mes
-- Recalcula desde cero el resumen de un alumno en un mes dado.
-- Equivalente a DB._recalcularResumenMes() de db.js
-- ============================================================
CREATE OR REPLACE FUNCTION recalcular_resumen_mes(
  p_colegio_id TEXT,
  p_mes        TEXT,
  p_alumno_id  TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_puntual  INTEGER;
  v_tardanza INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE estado = 'Puntual'),
    COUNT(*) FILTER (WHERE estado = 'Tardanza')
  INTO v_puntual, v_tardanza
  FROM registros
  WHERE colegio_id = p_colegio_id
    AND alumno_id  = p_alumno_id
    AND tipo       = 'INGRESO'
    AND TO_CHAR(fecha, 'YYYY-MM') = p_mes;

  INSERT INTO resumen_mensual(colegio_id, mes, alumno_id, puntual, tardanza)
  VALUES (p_colegio_id, p_mes, p_alumno_id, v_puntual, v_tardanza)
  ON CONFLICT (colegio_id, mes, alumno_id) DO UPDATE SET
    puntual    = EXCLUDED.puntual,
    tardanza   = EXCLUDED.tardanza,
    updated_at = NOW();
END;
$$;

-- ============================================================
-- TRIGGER: updated_at automático en tablas con esa columna
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_colegios_updated_at ON colegios;
CREATE TRIGGER trg_colegios_updated_at
  BEFORE UPDATE ON colegios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_alumnos_updated_at ON alumnos;
CREATE TRIGGER trg_alumnos_updated_at
  BEFORE UPDATE ON alumnos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- STORAGE: bucket incidentes — políticas RLS
-- Estructura del path: {colegio_id}/{incidente_id}/reporte.jpg
-- ============================================================
DROP POLICY IF EXISTS "inc_storage_staff_select" ON storage.objects;
DROP POLICY IF EXISTS "inc_storage_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "inc_storage_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "inc_storage_admin_delete" ON storage.objects;

CREATE POLICY "inc_storage_staff_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'incidentes' AND (storage.foldername(name))[1] = auth_colegio_id() AND is_staff());

CREATE POLICY "inc_storage_staff_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'incidentes' AND (storage.foldername(name))[1] = auth_colegio_id() AND is_staff());

CREATE POLICY "inc_storage_staff_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'incidentes' AND (storage.foldername(name))[1] = auth_colegio_id() AND is_staff());

CREATE POLICY "inc_storage_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'incidentes' AND (storage.foldername(name))[1] = auth_colegio_id() AND is_admin());
