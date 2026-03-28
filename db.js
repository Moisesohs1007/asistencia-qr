// ============================================================
// DB — Firebase Firestore (reemplaza localStorage)
// Depende de: db (Firestore), LSC — definidos en index.html antes de este script
// ============================================================
const DB = {
  // ALUMNOS
  _alumnosCache: null,
  async getAlumnos() {
    if(this._alumnosCache) return this._alumnosCache;
    // Intentar desde localStorage
    const lsData = LSC.get('alumnos');
    if(lsData) { this._alumnosCache = lsData; return lsData; }
    // Consultar Firestore
    const snap = await db.collection('alumnos').get();
    this._alumnosCache = snap.docs.map(d => ({id: d.id, ...d.data()}));
    LSC.set('alumnos', this._alumnosCache, LSC.TTL_ALUMNOS);
    return this._alumnosCache;
  },
  invalidarAlumnos() {
    this._alumnosCache = null;
    LSC.del('alumnos');
  },
  async saveAlumno(alumno) {
    // Siempre guardar el ID limpio sin espacios
    const cleanId = (alumno.id||'').trim().replace(/\s+/g,'');
    const cleanAlumno = { ...alumno, id: cleanId };
    await db.collection('alumnos').doc(cleanId).set(cleanAlumno);
    this._alumnosCache = null; // Invalidar cache memoria
    LSC.del('alumnos');        // Invalidar cache localStorage
  },
  async deleteAlumno(id) {
    await db.collection('alumnos').doc(id).delete();
    this._alumnosCache = null; // Invalidar cache memoria y localStorage
    LSC.del('alumnos');
  },
  async updateAlumnoId(oldId, newData) {
    const batch = db.batch();
    batch.delete(db.collection('alumnos').doc(oldId));
    batch.set(db.collection('alumnos').doc(newData.id), newData);
    await batch.commit();
    this._alumnosCache = null;
    LSC.del('alumnos');
  },
  // REGISTROS
  // Cache por clave: 'todos' | 'fecha:YYYY-MM-DD' | 'alumno:ID'
  _registrosCache: {},
  _registrosCacheTime: {},
  _CACHE_TTL: 5 * 60 * 1000, // 5 minutos

  _cacheKey(filtros) {
    if(filtros.fecha && filtros.alumnoId) return 'fecha_alumno:' + filtros.fecha + '_' + filtros.alumnoId;
    if(filtros.fecha)    return 'fecha:' + filtros.fecha;
    if(filtros.alumnoId) return 'alumno:' + filtros.alumnoId;
    if(filtros.mes)      return 'mes:' + filtros.mes;
    if(filtros.anio)     return 'anio:' + filtros.anio;
    if(filtros.desde && filtros.hasta) return 'rango:' + filtros.desde + '_' + filtros.hasta;
    return 'todos';
  },

  _cacheValido(key) {
    const t = this._registrosCacheTime[key];
    if(!t) return false;
    // Meses y años ya cerrados no cambian → TTL extendido de 1 hora
    const mesActual = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const anioActual = new Date().getFullYear();
    const esMesPasado  = key.startsWith('mes:')  && key.slice(4) < mesActual;
    const esAnioPasado = key.startsWith('anio:') && parseInt(key.slice(5)) < anioActual;
    const ttl = (esMesPasado || esAnioPasado) ? LSC.TTL_REGISTROS_MES_PASADO : this._CACHE_TTL;
    return (Date.now() - t) < ttl;
  },

  async getRegistros(filtros={}) {
    const key = this._cacheKey(filtros);

    // Retornar cache en memoria si es válido
    if(this._registrosCache[key] && this._cacheValido(key)) {
      return this._registrosCache[key];
    }
    // Intentar desde localStorage (solo 'todos' y por fecha)
    if(key === 'todos' || key.startsWith('fecha:')) {
      const lsData = LSC.get('reg_' + key);
      if(lsData) {
        this._registrosCache[key] = lsData;
        this._registrosCacheTime[key] = Date.now();
        return lsData;
      }
    }

    try {
      let q = db.collection('registros');
      if(filtros.fecha)    q = q.where('fecha','==',filtros.fecha);
      if(filtros.alumnoId) q = q.where('alumnoId','==',filtros.alumnoId);
      // Filtro por mes: '2026-03' → entre '2026-03-01' y '2026-03-31'
      if(filtros.mes) {
        const [y,m] = filtros.mes.split('-').map(Number);
        const desde = filtros.mes + '-01';
        const ultimo = new Date(y, m, 0).getDate();
        const hasta  = filtros.mes + '-' + String(ultimo).padStart(2,'0');
        q = q.where('fecha','>=',desde).where('fecha','<=',hasta).orderBy('fecha');
      }
      // Filtro por año completo — solo admin/director
      if(filtros.anio) {
        q = q.where('fecha','>=',filtros.anio+'-01-01').where('fecha','<=',filtros.anio+'-12-31').orderBy('fecha');
      }
      // Filtro por rango de fechas arbitrario (desde/hasta)
      if(filtros.desde && filtros.hasta) {
        q = q.where('fecha','>=',filtros.desde).where('fecha','<=',filtros.hasta).orderBy('fecha');
      }
      // Paginación completa: evita perder registros con límites fijos
      // Para consultas diarias (fecha exacta) 5000 es suficiente (max ~2×alumnos)
      // Para mensuales/anuales se pagina hasta traer todos los registros
      let docs;
      if(filtros.fecha) {
        const snap = await q.limit(5000).get();
        docs = snap.docs.map(d => d.data());
      } else {
        docs = [];
        const PAGE = 1000;
        let lastDoc = null;
        while(true) {
          const paged = lastDoc ? q.startAfter(lastDoc).limit(PAGE) : q.limit(PAGE);
          const snap  = await paged.get();
          snap.docs.forEach(d => docs.push(d.data()));
          if(snap.docs.length < PAGE) break;
          lastDoc = snap.docs[snap.docs.length - 1];
        }
      }
      const resultado = docs.sort((a,b) => (b.hora||'').localeCompare(a.hora||''));

      // Guardar en cache memoria
      this._registrosCache[key] = resultado;
      this._registrosCacheTime[key] = Date.now();
      // Guardar en localStorage (no guardar año completo — muy pesado)
      if(key === 'todos' || key.startsWith('fecha:') || key.startsWith('mes:')) {
        const mesActual = new Date().toISOString().slice(0, 7);
        const esMesPasado = key.startsWith('mes:') && key.slice(4) < mesActual;
        const ttlLS = esMesPasado ? LSC.TTL_REGISTROS_MES_PASADO : LSC.TTL_REGISTROS;
        LSC.set('reg_' + key, resultado, ttlLS);
      }

      // Si cargamos 'todos', también llenar cache por fecha
      if(key === 'todos') {
        const porFecha = {};
        docs.forEach(r => {
          if(!r.fecha) return;
          if(!porFecha[r.fecha]) porFecha[r.fecha] = [];
          porFecha[r.fecha].push(r);
        });
        Object.entries(porFecha).forEach(([fecha, regs]) => {
          const k = 'fecha:' + fecha;
          this._registrosCache[k] = regs.sort((a,b) => (b.hora||'').localeCompare(a.hora||''));
          this._registrosCacheTime[k] = Date.now();
          LSC.set('reg_' + k, this._registrosCache[k], LSC.TTL_REGISTROS);
        });
      }

      return resultado;
    } catch(e) {
      console.error('getRegistros error:', e);
      return [];
    }
  },

  invalidarRegistros(fecha=null) {
    if(fecha) {
      delete this._registrosCache['fecha:' + fecha];
      delete this._registrosCacheTime['fecha:' + fecha];
      delete this._registrosCache['todos'];
      delete this._registrosCacheTime['todos'];
      LSC.del('reg_fecha:' + fecha);
      LSC.del('reg_todos');
    } else {
      this._registrosCache = {};
      this._registrosCacheTime = {};
      // Limpiar todos los registros de localStorage
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('asmqr_reg_'))
          .forEach(k => localStorage.removeItem(k));
      } catch(e) {}
    }
  },

  async saveRegistro(reg) {
    // Auditoría: registrar quién escaneó (usuario del staff autenticado)
    if(!reg.registradoPor) {
      const cu = firebase.auth().currentUser;
      if(cu) reg.registradoPor = cu.email || cu.uid;
    }
    reg.timestamp = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('registros').add(reg);
    // Invalidar cache del día correspondiente
    this.invalidarRegistros(reg.fecha);
    // Actualizar resumen_mensual solo en INGRESO — falla silenciosa (registro ya guardado)
    if(reg.tipo === 'INGRESO') {
      try {
        const mes      = reg.fecha.substring(0, 7); // 'YYYY-MM'
        const docId    = mes + '_' + reg.alumnoId;
        const esTardanza = (reg.estado||'').trim() === 'Tardanza';
        await db.collection('resumen_mensual').doc(docId).set({
          mes,
          alumnoId:  reg.alumnoId,
          puntual:   firebase.firestore.FieldValue.increment(esTardanza ? 0 : 1),
          tardanza:  firebase.firestore.FieldValue.increment(esTardanza ? 1 : 0),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch(e) {
        console.warn('[DB] resumen_mensual update failed (non-critical):', e.message);
      }
    }
  },

  // RESUMEN MENSUAL
  _resumenMesCache: {},
  _resumenMesCacheTime: {},

  async getResumenMes(mes) {
    const mesActual = new Date().toISOString().slice(0, 7);
    const esPasado  = mes < mesActual;
    const ttl = esPasado ? (30 * 24 * 60 * 60 * 1000) : (5 * 60 * 1000);
    const cached = this._resumenMesCache[mes];
    const t      = this._resumenMesCacheTime[mes];
    if(cached && t && (Date.now() - t) < ttl) return cached;
    try {
      const snap = await db.collection('resumen_mensual').where('mes','==',mes).get();
      const result = snap.docs.map(d => ({
        alumnoId: d.data().alumnoId,
        puntual:  d.data().puntual  || 0,
        tardanza: d.data().tardanza || 0,
      }));
      this._resumenMesCache[mes] = result;
      this._resumenMesCacheTime[mes] = Date.now();
      return result;
    } catch(e) {
      console.warn('[DB] getResumenMes error:', e.message);
      return [];
    }
  },

  async deleteRegistrosByFecha(fecha) {
    const snap = await db.collection('registros').where('fecha','==',fecha).get();
    // Guardar alumnoIds afectados antes de borrar (para recalcular resumen)
    const alumnoIds = [...new Set(
      snap.docs.filter(d => d.data().tipo === 'INGRESO').map(d => d.data().alumnoId)
    )];
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    this.invalidarRegistros(fecha);
    // Recalcular resumen_mensual para los alumnos afectados
    if(alumnoIds.length) {
      const mes = fecha.substring(0, 7);
      this._recalcularResumenMes(mes, alumnoIds).catch(e =>
        console.warn('[DB] recalcular resumen tras borrado:', e.message)
      );
    }
  },

  // Recalcula resumen_mensual desde registros reales para alumnoIds específicos
  // Usado tras borrado de registros o para corregir desincronización
  async _recalcularResumenMes(mes, alumnoIds) {
    const [y, m]  = mes.split('-').map(Number);
    const desde   = mes + '-01';
    const hasta   = mes + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');
    for(const alumnoId of alumnoIds) {
      try {
        const snap = await db.collection('registros')
          .where('alumnoId', '==', alumnoId)
          .where('fecha',    '>=', desde)
          .where('fecha',    '<=', hasta)
          .get();
        let puntual = 0, tardanza = 0;
        snap.docs.forEach(d => {
          const r = d.data();
          if(r.tipo !== 'INGRESO') return;
          if((r.estado||'').trim() === 'Tardanza') tardanza++;
          else puntual++;
        });
        await db.collection('resumen_mensual').doc(mes + '_' + alumnoId).set({
          mes, alumnoId, puntual, tardanza,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch(e) {
        console.warn('[DB] _recalcularResumenMes error:', alumnoId, e.message);
      }
    }
  },
};
