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
    return t && (Date.now() - t) < this._CACHE_TTL;
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
        LSC.set('reg_' + key, resultado, LSC.TTL_REGISTROS);
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
    reg.timestamp = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('registros').add(reg);
    // Invalidar cache del día correspondiente
    this.invalidarRegistros(reg.fecha);
  },
  async deleteRegistrosByFecha(fecha) {
    const snap = await db.collection('registros').where('fecha','==',fecha).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    this.invalidarRegistros(fecha); // Invalidar cache
  },
};
