// ============================================================
// EDGE FUNCTION: crear-usuario
// Crea cuentas en Supabase Auth usando service_role (server-side).
// Reemplaza el patrón firebase.initializeApp(config, name) usado
// en index.html para crear cuentas de apoderados y staff sin
// cerrar la sesión del usuario actual.
//
// Deploy:
//   supabase functions deploy crear-usuario
//
// Llamada desde compat.js (clase _SecondaryAuth)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar que el llamador está autenticado (token del staff)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Cliente con service_role para operaciones de admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verificar identidad del llamador (debe ser staff activo del colegio)
    const userToken = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(userToken);
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verificar que el caller es staff del colegio indicado
    const body = await req.json();
    const { email, password, colegioId, rolNuevo = 'apoderado', alumnoId = null } = body;

    if (!email || !password || !colegioId) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros: email, password, colegioId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('usuarios')
      .select('rol, colegio_id')
      .eq('id', caller.id)
      .single();

    if (!callerProfile || callerProfile.colegio_id !== colegioId) {
      return new Response(JSON.stringify({ error: 'Sin permisos para este colegio' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Solo admin puede crear cuentas de staff. Staff puede crear apoderados.
    if (rolNuevo !== 'apoderado' && callerProfile.rol !== 'admin') {
      return new Response(JSON.stringify({ error: 'Solo admin puede crear cuentas de staff' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Crear usuario en Supabase Auth con metadata
    const appMeta: Record<string, string> = { colegio_id: colegioId, rol: rolNuevo };
    if (rolNuevo === 'apoderado' && alumnoId) appMeta.alumno_id = alumnoId;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,   // confirmar email automáticamente (no require link)
      app_metadata: appMeta,
    });

    if (createError) {
      // Traducir error "already exists" al código de Firebase para compatibilidad
      const code = createError.message.includes('already') || createError.message.includes('registered')
        ? 'auth/email-already-in-use'
        : 'auth/unknown';
      return new Response(JSON.stringify({ error: createError.message, code }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ user: { uid: newUser.user.id, email } }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
