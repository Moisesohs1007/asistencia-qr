// ============================================================
// SCRIPT DE MIGRACIÓN: Firebase Firestore → Supabase
//
// Uso (Node.js):
//   node migrar_firebase.js
//
// Requiere:
//   npm install firebase-admin @supabase/supabase-js
//
// Variables de entorno (.env):
//   FIREBASE_SERVICE_ACCOUNT  = path al JSON de credenciales de Firebase Admin
//   SUPABASE_URL              = https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY      = service_role key (bypasea RLS para migración)
//   COLEGIO_ID                = 'marello'  (slug del colegio a migrar)
// ============================================================

require('dotenv').config();
const admin     = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// ── Inicializar Firebase Admin ────────────────────────────────
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const firestore = admin.firestore();

// ── Inicializar Supabase con service_role (sin RLS) ───────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

const COLEGIO_ID = process.env.COLEGIO_ID || 'marello';
const BATCH_SIZE = 200; // Supabase acepta hasta 500, usamos 200 por seguridad

// ── Utilidades ────────────────────────────────────────────────
function log(msg)  { console.log(`[${new Date().toISOString()}] ${msg}`); }
function warn(msg) { console.warn(`[WARN] ${msg}`); }

async function insertarEnLotes(tabla, filas, etiqueta) {
  if (!filas.length) { log(`${etiqueta}: sin datos, omitido`); return; }
  let insertados = 0;
  for (let i = 0; i < filas.length; i += BATCH_SIZE) {
    const lote = filas.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(tabla).upsert(lote, { ignoreDuplicates: false });
    if (error) {
      warn(`${etiqueta} lote ${i}-${i + lote.length}: ${error.message}`);
    } else {
      insertados += lote.length;
      process.stdout.write(`\r  ${etiqueta}: ${insertados}/${filas.length}`);
    }
  }
  console.log(); // nueva línea tras progress
  log(`${etiqueta}: ${insertados} registros migrados`);
}

// ============================================================
// PASO 1 — Crear/actualizar el colegio en Supabase
// ============================================================
async function migrarConfig() {
  log('=== PASO 1: Configuración del colegio ===');
  const snap = await firestore.collection('config').get();
  const docs = {};
  snap.docs.forEach(d => { docs[d.id] = d.data(); });

  const general   = docs['general']   || {};
  const factiliza = docs['factiliza'] || {};

  const fila = {
    id:                  COLEGIO_ID,
    nombre:              general.nombreColegio || 'Colegio',
    anio:                general.anio          || '2026',
    eslogan:             general.eslogan       || '',
    logo_url:            general.logoUrl       || '',
    apo_domain:          '@apo.marello.pe',
    niveles:             JSON.stringify(general.niveles   || []),
    grados:              JSON.stringify(general.grados    || {}),
    secciones:           JSON.stringify(general.secciones || []),
    factiliza_token:     factiliza.token     || '',
    factiliza_instancia: factiliza.instancia || '',
    banner_imagenes:     JSON.stringify(general.bannerImagenes || []),
  };

  const { error } = await supabase.from('colegios').upsert(fila, { onConflict: 'id' });
  if (error) throw new Error('Error creando colegio: ' + error.message);
  log(`Colegio "${fila.nombre}" creado/actualizado con ID: ${COLEGIO_ID}`);
}

// ============================================================
// PASO 2 — Migrar alumnos
// ============================================================
async function migrarAlumnos() {
  log('=== PASO 2: Alumnos ===');
  const snap = await firestore.collection('alumnos').get();
  log(`  Leídos ${snap.docs.length} alumnos de Firebase`);

  const filas = snap.docs.map(d => {
    const a = d.data();
    return {
      colegio_id:           COLEGIO_ID,
      id:                   d.id,
      nombres:              a.nombres             || '',
      apellidos:            a.apellidos           || '',
      grado:                a.grado               || '',
      seccion:              a.seccion             || 'A',
      turno:                a.turno               || 'Primaria',
      limite:               a.limite              || '08:00',
      foto:                 a.foto                || '',
      apoderado_nombres:    a.apoderadoNombres    || '',
      apoderado_apellidos:  a.apoderadoApellidos  || '',
      telefono:             a.telefono            || '',
      apoderado2_nombres:   a.apoderado2Nombres   || '',
      apoderado2_apellidos: a.apoderado2Apellidos || '',
      telefono2:            a.telefono2           || '',
      correo_apoderado:     a.correoApoderado     || '',
    };
  });

  await insertarEnLotes('alumnos', filas, 'Alumnos');
}

// ============================================================
// PASO 3 — Migrar registros de asistencia
// ============================================================
async function migrarRegistros() {
  log('=== PASO 3: Registros de asistencia ===');

  // Paginar de a 1000 para no cargar todo en memoria
  let total = 0;
  let lastDoc = null;

  while (true) {
    let query = firestore.collection('registros').orderBy('fecha').limit(1000);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    const filas = snap.docs.map(d => {
      const r = d.data();
      // Firestore guarda fecha como string 'YYYY-MM-DD' — compatible con DATE de SQL
      return {
        colegio_id:     COLEGIO_ID,
        alumno_id:      r.alumnoId     || '',
        tipo:           r.tipo         || 'INGRESO',
        fecha:          r.fecha        || '2026-01-01',
        hora:           r.hora         || '00:00',
        estado:         r.estado       || 'Puntual',
        nombre:         r.nombre       || '',
        grado:          r.grado        || '',
        seccion:        r.seccion      || '',
        turno:          r.turno        || '',
        registrado_por: r.registradoPor || '',
      };
    }).filter(r => r.alumno_id); // descartar registros sin alumnoId

    await insertarEnLotes('registros', filas, `Registros (lote desde ${filas[0]?.fecha})`);
    total += filas.length;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 1000) break;
  }

  log(`Registros totales migrados: ${total}`);
}

// ============================================================
// PASO 4 — Migrar resumen_mensual
// ============================================================
async function migrarResumenMensual() {
  log('=== PASO 4: Resumen mensual ===');
  const snap = await firestore.collection('resumen_mensual').get();
  log(`  Leídos ${snap.docs.length} documentos de resumen`);

  const filas = snap.docs.map(d => {
    const r = d.data();
    return {
      colegio_id: COLEGIO_ID,
      mes:        r.mes       || d.id.substring(0, 7),
      alumno_id:  r.alumnoId  || d.id.substring(8),
      puntual:    r.puntual   || 0,
      tardanza:   r.tardanza  || 0,
    };
  }).filter(r => r.alumno_id && r.mes);

  await insertarEnLotes('resumen_mensual', filas, 'Resumen mensual');
}

// ============================================================
// PASO 5 — Migrar incidentes
// ============================================================
async function migrarIncidentes() {
  log('=== PASO 5: Incidentes ===');
  const snap = await firestore.collection('incidentes').get();
  log(`  Leídos ${snap.docs.length} incidentes`);

  const filas = snap.docs.map(d => {
    const inc = d.data();
    return {
      colegio_id:           COLEGIO_ID,
      alumno_id:            inc.alumnoId            || '',
      alumno_nombre:        inc.alumnoNombre         || '',
      grado:                inc.grado               || '',
      seccion:              inc.seccion             || '',
      turno:                inc.turno               || '',
      tipo:                 inc.tipo                || '',
      severidad:            inc.severidad           || 'Leve',
      fecha:                inc.fecha               || '2026-01-01',
      hora:                 inc.hora                || '00:00',
      descripcion:          inc.descripcion         || '',
      medidas:              inc.medidas             || '',
      tiene_imagenes:       inc.tieneImagenes       || false,
      cant_imagenes:        inc.cantImagenes        || 0,
      pdf_url:              inc.pdfUrl              || '',
      pdf_ref:              inc.pdfRef              || '',
      pdf_expira_staff:     inc.pdfExpiraStaff      || null,
      pdf_expira_apoderado: inc.pdfExpiraApoderado  || null,
      pdf_activo:           inc.pdfActivo           || false,
      responsable_nombre:   inc.responsableNombre   || '',
      responsable_cargo:    inc.responsableCargo    || '',
    };
  }).filter(r => r.alumno_id);

  await insertarEnLotes('incidentes', filas, 'Incidentes');
}

// ============================================================
// PASO 6 — Migrar usuarios (personal del colegio)
// Nota: las cuentas de Firebase Auth deben recrearse en
// Supabase Auth manualmente o via Admin API.
// Este paso solo migra los datos de la colección 'usuarios'.
// ============================================================
async function migrarUsuarios() {
  log('=== PASO 6: Usuarios (metadatos) ===');
  log('  NOTA: Las contraseñas NO se migran — Firebase Auth no las expone.');
  log('  Los usuarios deberán hacer "Olvidé mi contraseña" en Supabase.');

  const snap = await firestore.collection('usuarios').get();
  log(`  Leídos ${snap.docs.length} usuarios`);

  // Solo loguear — la inserción real requiere que el usuario ya exista en auth.users
  // Ver instrucciones al final del script
  snap.docs.forEach(d => {
    const u = d.data();
    log(`  → ${u.nombre} (${u.email}) — rol: ${u.rol}`);
  });

  log('');
  log('  Para crear estos usuarios en Supabase:');
  log('  1. Ve a Supabase Dashboard → Authentication → Users → Invite user');
  log('  2. O usa el Admin API: supabase.auth.admin.createUser({ email, password })');
  log('  3. Luego inserta en la tabla "usuarios" con el UUID de Supabase Auth');
}

// ============================================================
// MAIN — ejecutar todos los pasos en orden
// ============================================================
async function main() {
  log('');
  log('======================================================');
  log(` MIGRACIÓN FIREBASE → SUPABASE`);
  log(` Colegio ID: ${COLEGIO_ID}`);
  log('======================================================');
  log('');

  try {
    await migrarConfig();
    await migrarAlumnos();
    await migrarRegistros();
    await migrarResumenMensual();
    await migrarIncidentes();
    await migrarUsuarios();

    log('');
    log('======================================================');
    log(' ✅ MIGRACIÓN COMPLETADA');
    log('');
    log(' Próximos pasos:');
    log(' 1. Crear usuarios en Supabase Auth (ver instrucciones arriba)');
    log(' 2. Actualizar index.html para cargar db_supabase.js en vez de db.js');
    log(' 3. Inicializar el cliente Supabase con SUPABASE_URL y ANON_KEY');
    log(' 4. Actualizar la autenticación (login/logout) a Supabase Auth');
    log(' 5. Probar con datos reales antes de cortar Firebase');
    log('======================================================');
  } catch (e) {
    console.error('\n[ERROR FATAL]', e.message);
    process.exit(1);
  }
}

main();
