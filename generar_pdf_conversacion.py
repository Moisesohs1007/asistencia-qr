from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER
import datetime

output_path = "/home/user/asistencia-qr/conversacion_asistencia_qr.pdf"

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=18*mm,
    rightMargin=18*mm,
    topMargin=18*mm,
    bottomMargin=18*mm,
)

styles = getSampleStyleSheet()

titulo_style = ParagraphStyle(
    "titulo",
    parent=styles["Heading1"],
    fontSize=16,
    textColor=colors.HexColor("#1a3c6e"),
    alignment=TA_CENTER,
    spaceAfter=2*mm,
)

fecha_style = ParagraphStyle(
    "fecha",
    parent=styles["Normal"],
    fontSize=9,
    textColor=colors.HexColor("#888888"),
    alignment=TA_CENTER,
    spaceAfter=4*mm,
)

usuario_label = ParagraphStyle(
    "usuario_label",
    parent=styles["Normal"],
    fontSize=9,
    textColor=colors.HexColor("#1450A0"),
    fontName="Helvetica-Bold",
    spaceAfter=1*mm,
)

claude_label = ParagraphStyle(
    "claude_label",
    parent=styles["Normal"],
    fontSize=9,
    textColor=colors.HexColor("#145a32"),
    fontName="Helvetica-Bold",
    spaceAfter=1*mm,
)

msg_style = ParagraphStyle(
    "msg",
    parent=styles["Normal"],
    fontSize=10,
    leading=15,
    spaceAfter=0,
)

conversacion = [
    ("Usuario",
     "¿Esta app es robusta? ¿Puede manejar grandes cantidades de datos sin problemas?"),

    ("Claude",
     "Sí, la app es robusta para el uso que describes. Analicemos los números:<br/><br/>"
     "• Firestore escala automáticamente sin configuración adicional.<br/>"
     "• Con 1,300 alumnos, 2 registros diarios (asistencia + incidencia), y un ciclo "
     "escolar de ~190 días, el total máximo sería de ~494,000 documentos al año.<br/>"
     "• Firestore soporta millones de documentos sin degradación de rendimiento.<br/>"
     "• Las consultas por fecha, grupo y alumno se mantienen rápidas con los índices correctos.<br/><br/>"
     "<b>Recomendaciones para mantenerla ágil:</b><br/>"
     "1. Usa índices compuestos en Firestore para las consultas más frecuentes.<br/>"
     "2. Pagina los resultados al mostrar listas largas (por ejemplo, 50 registros a la vez).<br/>"
     "3. Limita las consultas por rango de fechas (semana o mes) en lugar de traer todo el historial.<br/><br/>"
     "En resumen: la arquitectura actual es perfectamente adecuada para el tamaño de tu institución."),

    ("Usuario",
     "¿Y qué pasa si tenemos picos de uso, por ejemplo al inicio del día cuando todos "
     "los maestros registran asistencia al mismo tiempo?"),

    ("Claude",
     "Firestore maneja muy bien los picos de escritura concurrente. Algunos puntos clave:<br/><br/>"
     "• Firestore distribuye automáticamente la carga entre sus servidores.<br/>"
     "• El límite de escrituras por segundo en un MISMO documento es 1/seg, pero como "
     "cada registro de asistencia es un documento diferente (uno por alumno/maestro), "
     "no hay conflictos.<br/>"
     "• Con 50 maestros escribiendo simultáneamente, cada uno genera ~30 escrituras "
     "(un grupo de 30 alumnos) = ~1,500 escrituras en ráfaga. Firestore gestiona eso sin problema.<br/><br/>"
     "El SDK de Flutter también tiene caché offline, por lo que si hay un instante de "
     "latencia de red, los datos se sincronizan automáticamente en cuanto vuelve la conexión.<br/><br/>"
     "No necesitas ningún cambio de arquitectura para los picos de uso."),

    ("Usuario",
     "Los registros de asistencias y incidencias solo servirán de marzo a diciembre, "
     "luego deberán ser eliminados para el nuevo año."),

    ("Claude",
     "Perfecto, eso resuelve completamente el problema de crecimiento.<br/><br/>"
     "Con ese ciclo anual (marzo–diciembre):<br/><br/>"
     "• Máximo de registros en cualquier momento: 1,300 alumnos × 2 registros/día × "
     "~190 días ≈ <b>~500,000 registros</b><br/>"
     "• Firestore maneja eso sin ningún problema.<br/>"
     "• Al eliminar en diciembre/enero, vuelve a cero.<br/><br/>"
     "<b>Conclusión: la app es robusta para tu caso de uso.</b> Sin ninguna preocupación técnica real.<br/><br/>"
     "Lo único que sugeriría es agregar una función de <b>exportar/archivar a Excel antes de "
     "eliminar</b>, para que el colegio conserve el historial. ¿Ya tienen eso o quieres que lo agregue?"),
]

COLOR_USUARIO = colors.HexColor("#e6f0ff")
COLOR_CLAUDE = colors.HexColor("#eafaf1")

story = []

story.append(Paragraph("Conversación – App Asistencia QR", titulo_style))
story.append(Paragraph(f"Exportado el {datetime.date.today().strftime('%d/%m/%Y')}", fecha_style))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#ccccdd")))
story.append(Spacer(1, 5*mm))

for rol, texto in conversacion:
    if rol == "Usuario":
        label_style = usuario_label
        bg_color = COLOR_USUARIO
        label_text = "👤 Usuario"
    else:
        label_style = claude_label
        bg_color = COLOR_CLAUDE
        label_text = "🤖 Claude"

    label_p = Paragraph(label_text, label_style)
    msg_p = Paragraph(texto, msg_style)

    # Wrap in table for background color
    inner = Table(
        [[label_p], [msg_p]],
        colWidths=[174*mm],
    )
    inner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg_color),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#bbbbcc")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROUNDEDCORNERS", [4]),
    ]))

    story.append(inner)
    story.append(Spacer(1, 4*mm))

doc.build(story)
print(f"PDF generado: {output_path}")
