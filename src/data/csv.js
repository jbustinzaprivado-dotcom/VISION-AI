// Exportación CSV. Separador ";" (Excel en español lo abre en columnas) y marca de
// orden de bytes para que las tildes se vean bien. Cada archivo empieza con una línea
// que identifica el reporte: PROTOTIPO, quién lo generó, cuándo y con qué filtros.

const SEPARADOR = ';';

function celda(valor) {
  if (valor == null) return '';
  const texto = String(valor);
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// columnas: [{ titulo, valor: (fila) => ... }]
export function aCSV(filas, columnas, meta) {
  const lineas = [];
  if (meta) {
    lineas.push(
      celda(
        `# VISION AI · PROTOTIPO · ${meta.reporte} · generado por ${meta.usuario} el ${meta.fecha} · filtros: ${meta.filtros}`,
      ),
    );
  }
  lineas.push(columnas.map((c) => celda(c.titulo)).join(SEPARADOR));
  for (const f of filas) lineas.push(columnas.map((c) => celda(c.valor(f))).join(SEPARADOR));
  return lineas.join('\r\n');
}

export function descargarCSV(nombre, contenido) {
  const blob = new Blob(['﻿', contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const n = (v) => (typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : v);

export const COLUMNAS_SESIONES = [
  { titulo: 'id', valor: (s) => s.id },
  { titulo: 'fecha', valor: (s) => s.creadaEn },
  { titulo: 'caso', valor: (s) => s.caso },
  { titulo: 'nombre_caso', valor: (s) => s.nombreCaso },
  { titulo: 'estado', valor: (s) => s.estado },
  { titulo: 'usuario', valor: (s) => s.usuario.nombre },
  { titulo: 'rol', valor: (s) => s.usuario.rol },
  { titulo: 'semilla', valor: (s) => s.semilla },
  { titulo: 'velocidad', valor: (s) => n(s.velocidad) },
  { titulo: 'version_guion', valor: (s) => s.versionGuion },
  { titulo: 'alertas', valor: (s) => s.resumen?.alertas ?? '' },
  { titulo: 'advertencias', valor: (s) => s.resumen?.advertencias ?? '' },
  { titulo: 'informativas', valor: (s) => s.resumen?.informativas ?? '' },
  { titulo: 'afluencia', valor: (s) => (s.caso === 'CU-04' ? s.resumen?.afluencia ?? '' : '') },
  { titulo: 'datos_de_ejemplo', valor: (s) => (s.ejemplo ? 'sí' : 'no') },
  { titulo: 'modo', valor: () => 'PROTOTIPO' },
];

export const COLUMNAS_ALERTAS = [
  { titulo: 'id', valor: (a) => a.id },
  { titulo: 'fecha', valor: (a) => a.creadaEn },
  { titulo: 'sesion', valor: (a) => a.sesion },
  { titulo: 'caso', valor: (a) => a.caso },
  { titulo: 'regla', valor: (a) => a.codigo },
  { titulo: 'version_regla', valor: (a) => a.versionRegla },
  { titulo: 'severidad', valor: (a) => a.severidad },
  { titulo: 'mensaje', valor: (a) => a.mensaje },
  { titulo: 'segundo', valor: (a) => n(a.t) },
  { titulo: 'cuadro', valor: (a) => a.cuadro },
  { titulo: 'evidencia', valor: (a) => a.objetivo },
  { titulo: 'estado', valor: (a) => a.estado },
  { titulo: 'revisada_por', valor: (a) => a.revisadaPor?.nombre ?? '' },
  { titulo: 'cerrada_por', valor: (a) => a.cerradaPor?.nombre ?? '' },
  { titulo: 'observacion', valor: (a) => a.observacion },
  { titulo: 'modo', valor: () => 'PROTOTIPO' },
];
