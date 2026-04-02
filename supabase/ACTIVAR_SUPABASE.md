# Activar Supabase en index.html — 3 cambios

Una vez que el schema está desplegado y los datos migrados,
estos son los únicos cambios necesarios en index.html.

---

## CAMBIO 1 — Reemplazar Firebase SDK (líneas 13-17)

**Antes:**
```html
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js"></script>
```

**Después:**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="supabase/compat.js"></script>
```

---

## CAMBIO 2 — Reemplazar carga de db.js

Buscar la línea que carga `db.js` y cambiarla:

**Antes:**
```html
<script src="db.js"></script>
```

**Después:**
```html
<script src="supabase/db_supabase.js"></script>
```

---

## CAMBIO 3 — Eliminar el bloque de init de Firebase (líneas 3120-3134)

**Eliminar estas líneas:**
```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(...);
```

> compat.js ya inicializa `db`, `auth`, `storage` y `firebase` automáticamente.
> Solo editar SUPABASE_URL y SUPABASE_ANON_KEY en `supabase/compat.js`.

---

## Antes de activar — checklist

- [ ] Schema desplegado en Supabase (`supabase/schema.sql` ejecutado)
- [ ] Datos migrados (`node supabase/migrar_firebase.js`)
- [ ] Edge Function desplegada (`supabase functions deploy crear-usuario`)
- [ ] SUPABASE_URL y SUPABASE_ANON_KEY editados en `supabase/compat.js`
- [ ] COLEGIO_ID correcto en `supabase/compat.js`
- [ ] Usuarios de staff recreados en Supabase Auth con app_metadata correcto
- [ ] Probado en entorno de prueba antes de cortar Firebase

---

## Crear usuarios de staff en Supabase Auth

Cada usuario del personal necesita `app_metadata` con su rol y colegio.
Ejecutar desde Supabase Dashboard → SQL Editor:

```sql
-- Ejemplo para crear admin
SELECT supabase_admin.create_user(
  'admin@colegio.pe',
  'contraseña',
  '{"colegio_id": "marello", "rol": "admin"}'::jsonb
);
```

O via Node.js con service_role key:
```js
const { data } = await supabase.auth.admin.createUser({
  email: 'admin@colegio.pe',
  password: 'contraseña',
  email_confirm: true,
  app_metadata: { colegio_id: 'marello', rol: 'admin' }
});
// Luego insertar en tabla usuarios:
await supabase.from('usuarios').insert({
  id: data.user.id,
  colegio_id: 'marello',
  nombre: 'Nombre Admin',
  email: 'admin@colegio.pe',
  rol: 'admin',
});
```

---

## apoderado.html

El mismo proceso aplica para `apoderado.html`.
Los cambios de SDK (pasos 1-2) son idénticos.
`doLoginApoderado()` usa `auth.signInWithEmailAndPassword` que
ya está emulado en `compat.js` → sin cambios adicionales.
