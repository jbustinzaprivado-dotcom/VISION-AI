import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db.js';
import { ETIQUETAS_SESION } from '../data/estadosSesion.js';
import { COLUMNAS_ALERTAS, COLUMNAS_SESIONES, aCSV, descargarCSV, fechaLocal } from '../data/csv.js';
import { useSesion } from '../auth/SesionContext.jsx';
import { alcanceExportacion } from '../auth/roles.js';
import { ORDEN_CASOS } from '../data/indicadores.js';
import { casoPorId } from '../simulation/casos.js';
import { useAvisos } from '../components/ui/Avisos.jsx';
import { ChevronDown, ChevronUp, Download, FileSpreadsheet } from 'lucide-react';

// Historial de sesiones con filtros, detalle y los tres reportes CSV:
// resumen de una sesión, historial filtrado y reporte de alertas.
const fecha = (iso) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
const hoy = () => fechaLocal();

export default function Historial() {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const sesiones = useLiveQuery(() => db.sesiones.orderBy('creadaEn').reverse().toArray(), []);
  const alertas = useLiveQuery(() => db.alertas.toArray(), []);
  const [filtros, setFiltros] = useState({ caso: 'todos', estado: 'todos', propias: false });
  const [abierta, setAbierta] = useState(null);
  const alcance = alcanceExportacion(usuario.rol); // 'todos' | 'propios' | 'ninguno'

  if (sesiones === undefined || alertas === undefined) return <p className="nota">Cargando…</p>;

  const visibles = sesiones.filter(
    (s) =>
      (filtros.caso === 'todos' || s.caso === filtros.caso) &&
      (filtros.estado === 'todos' || s.estado === filtros.estado) &&
      (!filtros.propias || s.usuario.id === usuario.id),
  );
  // El operador solo exporta sus propias sesiones (Proyecto, sección 9).
  const exportables = alcance === 'propios' ? visibles.filter((s) => s.usuario.id === usuario.id) : visibles;
  const idsExportables = new Set(exportables.map((s) => s.id));
  const cambiar = (campo) => (e) =>
    setFiltros((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const textoFiltros =
    `caso=${filtros.caso}, estado=${filtros.estado}${filtros.propias ? ', solo propias' : ''}` +
    (alcance === 'propios' ? ', alcance=propias' : '');
  const meta = (reporte) => ({ reporte, usuario: `${usuario.nombre} (${usuario.rol})`, fecha: new Date().toISOString(), filtros: textoFiltros });

  // Descarga el CSV y confirma con un aviso cuántas filas se exportaron.
  const exportar = (nombre, filas, columnas, reporte) => {
    descargarCSV(nombre, aCSV(filas, columnas, meta(reporte)));
    avisar({ tipo: 'exito', titulo: `${reporte} exportado`, texto: `${filas.length} ${filas.length === 1 ? 'fila' : 'filas'} en ${nombre}` });
  };
  const exportarHistorial = () =>
    exportar(`vision-ai-historial-${hoy()}.csv`, exportables, COLUMNAS_SESIONES, 'Historial de sesiones');
  const exportarAlertas = () =>
    exportar(`vision-ai-alertas-${hoy()}.csv`, alertas.filter((a) => idsExportables.has(a.sesion)), COLUMNAS_ALERTAS, 'Reporte de alertas');

  return (
    <div className="historial-pagina">
      <h1>Historial</h1>
      <p className="nota">Los datos se guardan solo en este navegador. Exporta en CSV para conservarlos.</p>

      <div className="filtros">
        <label>
          Caso{' '}
          <select value={filtros.caso} onChange={cambiar('caso')}>
            <option value="todos">Todos</option>
            {ORDEN_CASOS.map((c) => (
              <option key={c} value={c}>{c} · {casoPorId(c).nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Estado{' '}
          <select value={filtros.estado} onChange={cambiar('estado')}>
            <option value="todos">Todos</option>
            {Object.entries(ETIQUETAS_SESION).map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={filtros.propias} onChange={cambiar('propias')} /> Solo mis sesiones
        </label>
        <span className="nota">{visibles.length} de {sesiones.length}</span>
      </div>

      {alcance !== 'ninguno' && (
        <div className="botones">
          <button type="button" onClick={exportarHistorial} disabled={exportables.length === 0}>
            <Download className="icono" aria-hidden="true" />
            Exportar historial (CSV)
          </button>
          <button type="button" className="secundario" onClick={exportarAlertas} disabled={exportables.length === 0}>
            <FileSpreadsheet className="icono" aria-hidden="true" />
            Exportar reporte de alertas (CSV)
          </button>
          {alcance === 'propios' && <span className="nota">Como operador exportas solo tus sesiones ({exportables.length}).</span>}
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="panel nota">No hay sesiones con estos filtros.</p>
      ) : (
        <table className="tabla-historial">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Caso</th>
              <th scope="col">Estado</th>
              <th scope="col">Usuario</th>
              <th scope="col">Semilla</th>
              <th scope="col">Alertas</th>
              <th scope="col"><span className="oculto">Detalle</span></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((s) => (
              <FilaSesion
                key={s.id}
                sesion={s}
                alertas={alertas.filter((a) => a.sesion === s.id)}
                abierta={abierta === s.id}
                alternar={() => setAbierta((id) => (id === s.id ? null : s.id))}
                puedeExportar={idsExportables.has(s.id)}
                exportar={exportar}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FilaSesion({ sesion: s, alertas, abierta, alternar, puedeExportar, exportar }) {
  const r = s.resumen;
  const exportarResumen = () =>
    exportar(
      `vision-ai-sesion-${s.caso}-${s.id.slice(0, 8)}.csv`,
      alertas,
      COLUMNAS_ALERTAS,
      `Resumen de sesión ${s.id} (${s.caso}, ${ETIQUETAS_SESION[s.estado]})`,
    );
  return (
    <>
      <tr>
        <td>{fecha(s.creadaEn)}</td>
        <td>
          {s.caso} · {s.nombreCaso}
          {s.ejemplo && <span className="nota"> (ejemplo)</span>}
        </td>
        <td>{ETIQUETAS_SESION[s.estado]}</td>
        <td>{s.usuario.nombre}</td>
        <td>{s.semilla}</td>
        <td>{alertas.length}</td>
        <td>
          <button type="button" className="secundario" onClick={alternar} aria-expanded={abierta}>
            {abierta ? <ChevronUp className="icono" aria-hidden="true" /> : <ChevronDown className="icono" aria-hidden="true" />}
            {abierta ? 'Ocultar' : 'Detalle'}
          </button>
        </td>
      </tr>
      {abierta && (
        <tr className="detalle-sesion">
          <td colSpan={7}>
            <p>
              <strong>Sesión</strong> {s.id} ·{' '}
              {s.generado
                ? `escena generada (generador v${s.generado.version}: ${Object.entries(s.generado.opciones).map(([k, v]) => `${k} ${v}`).join(', ')})`
                : `guion v${s.versionGuion}`}{' '}
              · velocidad {String(s.velocidad).replace('.', ',')}× ·
              reglas: {s.reglas.map((x) => `${x.id} v${x.version}`).join(', ')}
            </p>
            <p>
              <strong>Estados:</strong> {s.historialEstados.map((h) => ETIQUETAS_SESION[h.estado]).join(' → ')}
            </p>
            {r ? (
              <p>
                <strong>Resumen:</strong> {r.alertas} alertas · {r.advertencias} advertencias · {r.informativas} informativas
                {s.caso === 'CU-04' && ` · afluencia ${r.afluencia}`}
                {Object.keys(r.clasificaciones ?? {}).length > 0 &&
                  ` · ${Object.entries(r.clasificaciones).map(([k, v]) => `${k}: ${v}`).join(', ')}`}
                {r.descripcion && <span className="nota"> (esperado: {r.descripcion})</span>}
              </p>
            ) : (
              <p className="nota">Sin resumen: la sesión no llegó al final.</p>
            )}
            {alertas.length > 0 && (
              <ul className="lista-simple">
                {alertas.map((a) => (
                  <li key={a.id}>
                    {a.codigo} · {a.severidad} · segundo {a.t.toFixed(1).replace('.', ',')} · {a.objetivo} · {a.estado}
                  </li>
                ))}
              </ul>
            )}
            {puedeExportar && (
              <button type="button" className="secundario" onClick={exportarResumen}>
                <Download className="icono" aria-hidden="true" />
                Exportar resumen de esta sesión (CSV)
              </button>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
