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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json();
    const { email, password, colegioId, rolNuevo = 'apoderado', alumnoId = null, callerUid = null } = body;

    if (!email || !password || !colegioId) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (rolNuevo !== 'apoderado') {
      // Creación de staff: verificar que callerUid es admin/director
      if (!callerUid) {
        return new Response(JSON.stringify({ error: 'Se requiere autenticación de admin' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: callerProfile } = await supabaseAdmin
        .from('usuarios').select('rol, colegio_id').eq('id', callerUid).maybeSingle();

      if (!callerProfile || callerProfile.colegio_id !== colegioId) {
        return new Response(JSON.stringify({ error: 'Sin permisos para este colegio' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (!['admin', 'director'].includes(callerProfile.rol)) {
        return new Response(JSON.stringify({ error: 'Solo admin o director puede crear staff' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Apoderado self-registro: verificar que el DNI existe como alumno
      const dni = email.split('@')[0];
      const { data: alumno } = await supabaseAdmin
        .from('alumnos').select('id')
        .eq('colegio_id', colegioId).eq('id', dni).maybeSingle();
      if (!alumno) {
        return new Response(JSON.stringify({ error: 'DNI no encontrado' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const appMeta: Record<string, string> = { colegio_id: colegioId, rol: rolNuevo };
    if (rolNuevo === 'apoderado' && alumnoId) appMeta.alumno_id = alumnoId;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: appMeta,
    });

    if (createError) {
      const code = createError.message.includes('already') || createError.message.includes('registered')
        ? 'auth/email-already-in-use' : 'auth/unknown';
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
