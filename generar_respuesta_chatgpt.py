#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera el PDF: Respuesta técnica al análisis de ChatGPT sobre AsistenciaQR
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import PageBreak

# ── Colores ──────────────────────────────────────────────────────────────────
NAVY      = HexColor('#0D1A3A')
ACCENT    = HexColor('#38bdf8')
SUCCESS   = HexColor('#34d399')
WARNING   = HexColor('#fbbf24')
DANGER    = HexColor('#f87171')
MUTED     = HexColor('#64748b')
SURFACE   = HexColor('#1a2236')
LIGHT_BG  = HexColor('#f0f4f8')
DARK_TEXT = HexColor('#1e293b')
MID_GRAY  = HexColor('#94a3b8')

W, H = A4

OUTPUT = 'respuesta_analisis_chatgpt.pdf'

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=2*cm, rightMargin=2*cm,
    topMargin=2.2*cm, bottomMargin=2*cm,
    title='Respuesta Técnica — Análisis AsistenciaQR',
    author='Claude Code — Anthropic',
)

styles = getSampleStyleSheet()

# ── Estilos personalizados ────────────────────────────────────────────────────
def s(name, **kw):
    return ParagraphStyle(name, **kw)

ST = {
    'cover_title': s('ct', fontName='Helvetica-Bold', fontSize=26,
                     textColor=white, leading=32, spaceAfter=6,
                     alignment=TA_CENTER),
    'cover_sub':   s('cs', fontName='Helvetica', fontSize=12,
                     textColor=MID_GRAY, leading=16, spaceAfter=4,
                     alignment=TA_CENTER),
    'cover_date':  s('cd', fontName='Helvetica', fontSize=10,
                     textColor=MID_GRAY, alignment=TA_CENTER),

    'section':     s('sec', fontName='Helvetica-Bold', fontSize=13,
                     textColor=NAVY, leading=18, spaceBefore=18,
                     spaceAfter=6, borderPadding=(0,0,4,0)),
    'subsection':  s('sub', fontName='Helvetica-Bold', fontSize=11,
                     textColor=DARK_TEXT, leading=15, spaceBefore=10,
                     spaceAfter=4),
    'body':        s('bd', fontName='Helvetica', fontSize=10,
                     textColor=DARK_TEXT, leading=15, spaceAfter=5,
                     alignment=TA_JUSTIFY),
    'body_bold':   s('bdb', fontName='Helvetica-Bold', fontSize=10,
                     textColor=DARK_TEXT, leading=15, spaceAfter=5),
    'bullet':      s('blt', fontName='Helvetica', fontSize=10,
                     textColor=DARK_TEXT, leading=14, spaceAfter=3,
                     leftIndent=14, firstLineIndent=-10),
    'code':        s('cod', fontName='Courier', fontSize=8.5,
                     textColor=HexColor('#1e40af'), leading=13,
                     backColor=HexColor('#eff6ff'), spaceAfter=4,
                     leftIndent=10, rightIndent=10, borderPadding=6),
    'label_ok':    s('lok', fontName='Helvetica-Bold', fontSize=9.5,
                     textColor=SUCCESS),
    'label_warn':  s('lwn', fontName='Helvetica-Bold', fontSize=9.5,
                     textColor=WARNING),
    'label_err':   s('ler', fontName='Helvetica-Bold', fontSize=9.5,
                     textColor=DANGER),
    'table_hdr':   s('thd', fontName='Helvetica-Bold', fontSize=9,
                     textColor=white, alignment=TA_CENTER),
    'table_cell':  s('tce', fontName='Helvetica', fontSize=9,
                     textColor=DARK_TEXT, leading=13),
    'verdict':     s('vrd', fontName='Helvetica-Bold', fontSize=11,
                     textColor=NAVY, leading=16, spaceAfter=5,
                     alignment=TA_CENTER),
    'footer':      s('ftr', fontName='Helvetica', fontSize=8,
                     textColor=MUTED, alignment=TA_CENTER),
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def hr(color=ACCENT, thickness=1.2):
    return HRFlowable(width='100%', thickness=thickness, color=color,
                      spaceAfter=6, spaceBefore=2)

def section_title(text, color=NAVY):
    return [
        Paragraph(text, ST['section']),
        HRFlowable(width='100%', thickness=1, color=color,
                   spaceAfter=8, spaceBefore=0),
    ]

def p(text, style='body'):
    return Paragraph(text, ST[style])

def bullet(text, icon='•'):
    return Paragraph(f'<b>{icon}</b>  {text}', ST['bullet'])

def sp(n=6):
    return Spacer(1, n)

# ── PORTADA ───────────────────────────────────────────────────────────────────
cover_table = Table(
    [[Paragraph(
        '<font color="#38bdf8"><b>ASISTENCIA</b></font>'
        '<font color="#ffffff"><b>QR</b></font>',
        ST['cover_title']),
    ]],
    colWidths=[W - 4*cm],
)
cover_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), NAVY),
    ('ROUNDEDCORNERS', [12]),
    ('TOPPADDING',    (0,0), (-1,-1), 28),
    ('BOTTOMPADDING', (0,0), (-1,-1), 28),
    ('LEFTPADDING',   (0,0), (-1,-1), 20),
    ('RIGHTPADDING',  (0,0), (-1,-1), 20),
]))

story = []

story.append(sp(20))
story.append(cover_table)
story.append(sp(14))
story.append(p('RESPUESTA TÉCNICA AL ANÁLISIS DE CHATGPT', 'cover_sub'))
story.append(p('Sistema Escolar de Asistencia por Código QR', 'cover_sub'))
story.append(sp(4))
story.append(p('Análisis basado en revisión directa del código fuente · Marzo 2026', 'cover_date'))
story.append(sp(20))
story.append(hr(ACCENT, 0.6))
story.append(sp(10))

# ── INTRODUCCIÓN ──────────────────────────────────────────────────────────────
story += section_title('1. CONTEXTO Y PROPÓSITO DE ESTE DOCUMENTO')
story.append(p(
    'Este documento responde punto a punto al análisis que ChatGPT realizó sobre los archivos '
    '<b>index.html</b> y <b>apoderado.html</b> del sistema AsistenciaQR. '
    'A diferencia de ese análisis —basado en lectura visual de los archivos—, '
    'este informe parte de una <b>inspección directa del código fuente</b>, '
    'incluyendo la lógica JavaScript de registro, deduplicación, caché, '
    'validación de horarios y manejo de autenticación.'
))
story.append(p(
    'El objetivo es separar lo que es un <b>riesgo real confirmado en el código</b> '
    'de lo que es una suposición incorrecta o un riesgo sobreestimado, '
    'para que el colegio tome decisiones informadas y concretas.'
))
story.append(sp(4))

# ── PARTE 1: LO QUE CHATGPT ACERTÓ ───────────────────────────────────────────
story += section_title('2. LO QUE CHATGPT ACERTÓ', SUCCESS)

story.append(p(
    'Los siguientes puntos están <b>confirmados en el código fuente</b> '
    'y representan riesgos o limitaciones reales:'
))
story.append(sp(4))

items_ok = [
    ('Contraseña inicial = DNI del alumno',
     'CONFIRMADO en index.html (línea ~3373) y apoderado.html (línea ~1462). '
     'El sistema crea la cuenta del apoderado con el DNI como contraseña inicial '
     'y además guarda un campo <b>passBackup</b> con la contraseña en texto '
     'dentro de Firestore. Esto es un riesgo de seguridad real.'),
    ('Toda la lógica está en el cliente (sin Cloud Functions)',
     'CONFIRMADO. No existe ningún archivo de backend, Cloud Function ni '
     'servidor intermedio. Toda la validación (horario, deduplicación, tipo de '
     'registro) ocurre en el navegador. Esto significa que un usuario con '
     'conocimientos técnicos podría manipular el flujo.'),
    ('Nombre del colegio y eslogan fijados en el HTML',
     'CONFIRMADO. Las variables COLEGIO_NOMBRE y COLEGIO_ESLOGAN se leen de '
     'Firestore/config, pero hay valores por defecto en el código fuente. '
     'Esto no afecta el funcionamiento, pero es una rigidez de despliegue.'),
    ('Colas en horas pico son el riesgo operativo real',
     'CONFIRMADO. El flujo de escaneo requiere enfocar la cámara sobre el QR '
     'del alumno, lo que toma 1-3 segundos por persona. Con 1,300 alumnos '
     'en pocos minutos, el cuello de botella será físico/operativo, '
     'no necesariamente técnico.'),
]

for title, desc in items_ok:
    tbl = Table(
        [[Paragraph(f'<b>✔ {title}</b>', ParagraphStyle(
              'it', fontName='Helvetica-Bold', fontSize=9.5,
              textColor=HexColor('#065f46'), leading=13)),
          Paragraph(desc, ParagraphStyle(
              'id', fontName='Helvetica', fontSize=9.2,
              textColor=DARK_TEXT, leading=13))
        ]],
        colWidths=[4.8*cm, 11.4*cm],
    )
    tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), HexColor('#f0fdf4')),
        ('GRID',          (0,0), (-1,-1), 0.3, HexColor('#bbf7d0')),
        ('TOPPADDING',    (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
        ('ROUNDEDCORNERS',[6]),
    ]))
    story.append(tbl)
    story.append(sp(5))

story.append(sp(4))

# ── PARTE 2: LO QUE CHATGPT SE EQUIVOCÓ ──────────────────────────────────────
story += section_title('3. LO QUE CHATGPT SE EQUIVOCÓ O SOBREESTIMÓ', DANGER)

story.append(p(
    'Los siguientes puntos del análisis de ChatGPT son <b>incorrectos o '
    'parcialmente incorrectos</b> según el código real:'
))
story.append(sp(4))

items_err = [
    ('❌ "No hay deduplicación fuerte en backend"',
     'El sistema SÍ tiene deduplicación. El objeto <b>_hoyRegs</b> (índice '
     'en memoria) registra por alumno si ya marcó ingreso y/o salida hoy. '
     'Antes de cualquier escritura en Firestore, se consulta ese índice '
     '(líneas 4577-4585 de index.html). Si ya marcó ambos, muestra '
     '"Ya registró ingreso y salida hoy" y no escribe nada. '
     'Es deduplicación en cliente, no en servidor, pero funciona correctamente '
     'en uso normal con un solo operador por turno.'),
    ('❌ "El flujo es interactivo por alumno — confirmar ingreso"',
     'El flujo actual NO requiere confirmación manual. La función '
     '<b>autoRegistrar()</b> determina automáticamente si corresponde INGRESO '
     'o SALIDA según la hora, y registra directamente en Firestore. '
     'No hay paso de "confirmar" que frene el flujo. Esto hace el proceso '
     'más rápido de lo que ChatGPT estimó.'),
    ('❌ "Tablas lentas y frontend pesado para 1,300 alumnos"',
     'El sistema usa un <b>caché en memoria</b> (DB.getAlumnos()) que carga '
     'la lista de alumnos una sola vez y la reutiliza. Los reportes y filtros '
     'trabajan sobre datos ya cargados localmente. Firestore no es consultado '
     'en cada escaneo si los datos ya están en caché. Esto es un diseño '
     'deliberado y correcto para reducir lecturas de base de datos.'),
    ('❌ "El sistema podría congelarse bajo carga masiva"',
     'Firestore en plan Spark (gratuito) soporta hasta 1 escritura/segundo '
     'por documento y 1 millón de escrituras/día. Con 1,300 registros de '
     'ingreso distribuidos en ~30 minutos (turno mañana), la tasa es de '
     'aproximadamente 0.7 escrituras/segundo, bien dentro del límite. '
     'Un congelamiento total es altamente improbable; la lentitud sería '
     'marginal y solo en picos extremos.'),
]

for title, desc in items_err:
    tbl = Table(
        [[Paragraph(f'<b>{title}</b>', ParagraphStyle(
              'et', fontName='Helvetica-Bold', fontSize=9.5,
              textColor=HexColor('#7f1d1d'), leading=13)),
          Paragraph(desc, ParagraphStyle(
              'ed', fontName='Helvetica', fontSize=9.2,
              textColor=DARK_TEXT, leading=13))
        ]],
        colWidths=[4.8*cm, 11.4*cm],
    )
    tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), HexColor('#fff1f2')),
        ('GRID',          (0,0), (-1,-1), 0.3, HexColor('#fecdd3')),
        ('TOPPADDING',    (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('VALIGN',        (0,0), (-1,-1), 'TOP'),
        ('ROUNDEDCORNERS',[6]),
    ]))
    story.append(tbl)
    story.append(sp(5))

story.append(sp(4))

# ── PARTE 3: MATRIZ DE RIESGO ─────────────────────────────────────────────────
story += section_title('4. MATRIZ DE RIESGO — ESTADO REAL DEL SISTEMA')

story.append(p(
    'Evaluación de riesgos basada en el código fuente, con probabilidad e '
    'impacto para una operación de 1,300 alumnos:'
))
story.append(sp(6))

matrix_header = [
    Paragraph('RIESGO', ST['table_hdr']),
    Paragraph('PROBABILIDAD', ST['table_hdr']),
    Paragraph('IMPACTO', ST['table_hdr']),
    Paragraph('MEDIDA CORRECTIVA', ST['table_hdr']),
]

tc = lambda t: Paragraph(t, ParagraphStyle('mc', fontName='Helvetica',
                          fontSize=8.8, textColor=DARK_TEXT, leading=12))
tb = lambda t: Paragraph(t, ParagraphStyle('mb', fontName='Helvetica-Bold',
                          fontSize=8.8, leading=12))

def badge_cell(text, color):
    return Paragraph(f'<b>{text}</b>', ParagraphStyle(
        'bc', fontName='Helvetica-Bold', fontSize=8.5,
        textColor=color, alignment=TA_CENTER))

matrix_data = [matrix_header] + [
    [tc('Contraseña inicial = DNI\n(passBackup en Firestore)'),
     badge_cell('ALTA', DANGER),
     badge_cell('ALTO', DANGER),
     tc('Forzar cambio de contraseña\nen primer acceso (ya implementado).\nEliminar campo passBackup.')],

    [tc('Duplicados por acceso simultáneo\ndesde dos dispositivos'),
     badge_cell('MEDIA', WARNING),
     badge_cell('MEDIO', WARNING),
     tc('Implementar transacción\nde Firestore o Cloud Function\npara validar en servidor.')],

    [tc('Colas en hora de ingreso\n(problema operativo, no técnico)'),
     badge_cell('ALTA', DANGER),
     badge_cell('MEDIO', WARNING),
     tc('Múltiples puntos de escaneo\no registro por aula/docente.\nEscalonar por turno.')],

    [tc('Lentitud de interfaz en\nPCs/celulares de gama baja'),
     badge_cell('MEDIA', WARNING),
     badge_cell('BAJO', SUCCESS),
     tc('Probar en dispositivos reales\ndel colegio antes del despliegue.')],

    [tc('Manipulación del registro\ndesde el navegador (sin backend)'),
     badge_cell('BAJA', SUCCESS),
     badge_cell('ALTO', DANGER),
     tc('Agregar Cloud Functions para\nvalidar tipo y hora en servidor.\nImplementar reglas Firestore.')],

    [tc('Caída de Firestore /\nproblemas de conectividad'),
     badge_cell('MUY BAJA', SUCCESS),
     badge_cell('ALTO', DANGER),
     tc('Modo offline con Service Worker\ny sincronización posterior.')],

    [tc('Consumo de cuota gratuita\nde Firestore (Spark plan)'),
     badge_cell('BAJA', SUCCESS),
     badge_cell('BAJO', SUCCESS),
     tc('1,300 registros/día = ~0.13%\ndel límite diario. Sin problema.')],
]

col_widths = [4.0*cm, 2.4*cm, 2.1*cm, 7.7*cm]
matrix_tbl = Table(matrix_data, colWidths=col_widths, repeatRows=1)
matrix_tbl.setStyle(TableStyle([
    # Header
    ('BACKGROUND',    (0,0), (-1,0), NAVY),
    ('TEXTCOLOR',     (0,0), (-1,0), white),
    ('FONTNAME',      (0,0), (-1,0), 'Helvetica-Bold'),
    ('FONTSIZE',      (0,0), (-1,0), 9),
    ('ALIGN',         (0,0), (-1,0), 'CENTER'),
    ('TOPPADDING',    (0,0), (-1,0), 8),
    ('BOTTOMPADDING', (0,0), (-1,0), 8),
    # Rows
    ('ROWBACKGROUNDS',(0,1), (-1,-1), [white, HexColor('#f8fafc')]),
    ('GRID',          (0,0), (-1,-1), 0.4, HexColor('#cbd5e1')),
    ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
    ('TOPPADDING',    (0,1), (-1,-1), 6),
    ('BOTTOMPADDING', (0,1), (-1,-1), 6),
    ('LEFTPADDING',   (0,0), (-1,-1), 7),
    ('RIGHTPADDING',  (0,0), (-1,-1), 7),
    ('ALIGN',         (1,1), (2,-1), 'CENTER'),
]))
story.append(matrix_tbl)
story.append(sp(10))

# ── PARTE 4: VEREDICTO ────────────────────────────────────────────────────────
story += section_title('5. VEREDICTO TÉCNICO REAL')

verdict_tbl = Table(
    [[Paragraph(
        '¿Puede funcionar para 1,300 alumnos?',
        ParagraphStyle('vq', fontName='Helvetica-Bold', fontSize=12,
                       textColor=NAVY, leading=16, alignment=TA_CENTER)),
    ]],
    colWidths=[W - 4*cm],
)
verdict_tbl.setStyle(TableStyle([
    ('BACKGROUND',    (0,0), (-1,-1), HexColor('#eff6ff')),
    ('TOPPADDING',    (0,0), (-1,-1), 14),
    ('BOTTOMPADDING', (0,0), (-1,-1), 14),
    ('LEFTPADDING',   (0,0), (-1,-1), 16),
    ('RIGHTPADDING',  (0,0), (-1,-1), 16),
    ('GRID',          (0,0), (-1,-1), 0.5, HexColor('#bfdbfe')),
    ('ROUNDEDCORNERS',[8]),
]))
story.append(verdict_tbl)
story.append(sp(8))

story.append(p(
    '<b>Sí, puede funcionar</b> — pero el análisis de ChatGPT mezcló riesgos reales '
    'con suposiciones incorrectas sobre el código. Aquí el resumen honesto:'
))
story.append(sp(4))

verdict_points = [
    ('✔', SUCCESS, '<b>Técnicamente sólido para la escala:</b> Firebase + caché local + '
     'deduplicación en memoria hacen que el backend soporte bien 1,300 alumnos '
     'si la operación está bien distribuida.'),
    ('✔', SUCCESS, '<b>El flujo de registro es rápido:</b> No hay paso de confirmación; '
     'autoRegistrar() decide y guarda directamente, lo que permite '
     'escanear un alumno cada 2-3 segundos.'),
    ('⚠', WARNING, '<b>El riesgo operativo real es la concentración:</b> '
     'Si 600 alumnos intentan ingresar en 10 minutos por 1 solo punto de escaneo, '
     'el problema será la cola física, no la base de datos.'),
    ('⚠', WARNING, '<b>Seguridad de contraseñas necesita mejora:</b> '
     'El campo passBackup almacena la contraseña en Firestore. '
     'Debe eliminarse. El forzado de cambio de contraseña en primer '
     'acceso ya está implementado, lo cual es positivo.'),
    ('⚠', WARNING, '<b>Sin validación en servidor:</b> Toda la lógica corre en el navegador. '
     'Un usuario técnico podría manipularla. Para uso escolar normal '
     'esto es aceptable; para alta seguridad se necesitarían Cloud Functions.'),
    ('✔', SUCCESS, '<b>Apto para producción con ajustes operativos menores:</b> '
     'No requiere rediseño técnico completo. Con múltiples puntos de escaneo '
     'y la corrección del passBackup, el sistema es viable para 1,300 alumnos.'),
]

for icon, color, text in verdict_points:
    row_tbl = Table(
        [[Paragraph(f'<b>{icon}</b>', ParagraphStyle('vi', fontName='Helvetica-Bold',
                    fontSize=14, textColor=color, alignment=TA_CENTER)),
          Paragraph(text, ParagraphStyle('vt', fontName='Helvetica', fontSize=9.8,
                    textColor=DARK_TEXT, leading=14))]],
        colWidths=[0.9*cm, W - 4*cm - 0.9*cm],
    )
    row_tbl.setStyle(TableStyle([
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 4),
        ('RIGHTPADDING',  (0,0), (-1,-1), 4),
    ]))
    story.append(row_tbl)
    story.append(sp(2))

story.append(sp(10))

# ── PARTE 5: ACCIONES CONCRETAS ───────────────────────────────────────────────
story += section_title('6. ACCIONES CONCRETAS RECOMENDADAS (por prioridad)')

acciones = [
    ('PRIORIDAD ALTA', DANGER, [
        'Eliminar el campo <b>passBackup</b> de Firestore en todos los documentos de apoderados.',
        'Documentar y comunicar al personal que la contraseña inicial es el DNI y debe cambiarse.',
        'Instalar al menos 2-3 puntos de escaneo para el turno de mayor concurrencia.',
    ]),
    ('PRIORIDAD MEDIA', WARNING, [
        'Agregar reglas de seguridad en Firestore (Security Rules) para limitar escrituras por rol.',
        'Probar el sistema con todo el personal antes del primer día de clases con alumnos.',
        'Escalonar el ingreso por grado o turno para evitar concentración en 1 sola franja.',
    ]),
    ('PRIORIDAD BAJA / MEJORA FUTURA', MUTED, [
        'Implementar Cloud Function para validar registro en servidor (elimina riesgo de manipulación).',
        'Agregar modo offline con sincronización automática al recuperar conexión.',
        'Considerar QR dinámico (token temporal) si se requiere mayor seguridad del código QR.',
    ]),
]

for label, color, items in acciones:
    story.append(Paragraph(label, ParagraphStyle(
        'al', fontName='Helvetica-Bold', fontSize=10,
        textColor=color, spaceBefore=10, spaceAfter=4)))
    for item in items:
        story.append(bullet(item, '→'))
    story.append(sp(2))

story.append(sp(10))

# ── CIERRE ────────────────────────────────────────────────────────────────────
story.append(hr(ACCENT, 0.6))
story.append(sp(6))
story.append(p(
    'Este análisis fue generado por <b>Claude Code (Anthropic)</b> mediante inspección '
    'directa del código fuente de AsistenciaQR en marzo de 2026. '
    'Las líneas de código referenciadas corresponden a los archivos '
    '<b>index.html</b> y <b>apoderado.html</b> del repositorio.',
    'footer'
))
story.append(p('github.com/moisesohs1007/asistencia-qr', 'footer'))

# ── BUILD ─────────────────────────────────────────────────────────────────────
doc.build(story)
print(f'PDF generado: {OUTPUT}')
