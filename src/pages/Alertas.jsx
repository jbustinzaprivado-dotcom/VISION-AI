import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db.js';
import { cambiarEstadoAlerta } from '../data/repositorio.js';
import { useSesion } from '../auth/SesionContext.jsx';
import { esSoloLectura } from '../auth/roles.js';
import { siguienteEstado } from '../rules/alertas.js';
import { casoPorId } from '../simulation/casos.js';
import { guionDeSesion } from '../simulation/generadores.js';
import { generarCuadro } from '../simulation/motor.js';
import MiniEscena from '../components/MiniEscena.jsx';
import { ETIQUETA_SEVERIDAD } from '../components/PanelAlertas.jsx';
import Dialogo from '../components/ui/Dialogo.jsx';
import { useAvisos } from '../components/ui/Avisos.jsx';
import { CheckCheck, Eye, EyeOff, Lock } from 'lucide-react';

// Alertas: filtrar → ver evidencia → revisar (operador) → cerrar con observación (supervisor).
const ESTADOS = { nueva: 'Nueva', revisada: 'Revisada', cerrada: 'Cerrada' };
const fecha = (iso) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

export default function Alertas() {
  const { usuario, puede } = useSesion();
  const alertas = useLiveQuery(() => db.alertas.orderBy('creadaEn').reverse().toArray(), []);
  const sesiones = useLiveQuery(() => db.sesiones.toArray(), []);
  const [filtros, setFiltros] = useState({ estado: 'pendientes', caso: 'todos', severidad: 'todas' });

  const sesionDe = useMemo(() => Object.fromEntries((sesiones ?? []).map((s) => [s.id, s])), [sesiones]);
  const visibles = (alertas ?? []).filter(
    (a) =>
      (filtros.estado === 'todas' ||
        (filtros.estado === 'pendientes' ? a.estado !== 'cerrada' : a.estado === filtros.estado)) &&
      (filtros.caso === 'todos' || a.caso === filtros.caso) &&
      (filtros.severidad === 'todas' || a.severidad === filtros.severidad),
  );
  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <div className="alertas-pagina">
      <h1>Alertas</h1>
      {esSoloLectura(usuario.rol) && <p className="nota">Modo solo lectura: el auditor consulta, pero no cambia alertas.</p>}

      <div className="filtros">
        <label>
          Estado{' '}
          <select value={filtros.estado} onChange={cambiar('estado')}>
            <option value="pendientes">Pendientes (nuevas y revisadas)</option>
            <option value="nueva">Nuevas</option>
            <option value="revisada">Revisadas</option>
            <option value="cerrada">Cerradas</option>
            <option value="todas">Todas</option>
          </select>
        </label>
        <label>
          Caso{' '}
          <select value={filtros.caso} onChange={cambiar('caso')}>
            <option value="todos">Todos</option>
            {['CU-02', 'CU-04', 'CU-01', 'CU-03'].map((c) => (
              <option key={c} value={c}>{c} · {casoPorId(c).nombre}</option>
            ))}
          </select>
        </label>
        <label>
          Severidad{' '}
          <select value={filtros.severidad} onChange={cambiar('severidad')}>
            <option value="todas">Todas</option>
            {Object.entries(ETIQUETA_SEVERIDAD).map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </select>
        </label>
        <span className="nota">{visibles.length} de {(alertas ?? []).length}</span>
      </div>

      {alertas === undefined ? (
        <p className="nota">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="panel nota">
          No hay alertas con estos filtros. Las alertas se crean al ejecutar un caso en Análisis visual.
        </p>
      ) : (
        <ul className="tarjetas-alertas">
          {visibles.map((a) => (
            <TarjetaAlerta key={a.id} alerta={a} sesion={sesionDe[a.sesion]} usuario={usuario} puede={puede} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaAlerta({ alerta: a, sesion, usuario, puede }) {
  const [verEvidencia, setVerEvidencia] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const siguiente = siguienteEstado(a.estado);
  const permitido =
    (siguiente === 'revisada' && puede('revisarAlertas')) || (siguiente === 'cerrada' && puede('cerrarAlertas'));

  const avisar = useAvisos();
  const [confirmando, setConfirmando] = useState(false);

  // Cerrar pide confirmación con un diálogo propio; revisar se aplica directo.
  function avanzar() {
    setError(null);
    if (siguiente === 'cerrada') {
      if (!observacion.trim()) {
        setError('Para cerrar la alerta hay que escribir una observación.');
        return;
      }
      setConfirmando(true);
      return;
    }
    guardar();
  }

  async function guardar() {
    setConfirmando(false);
    setGuardando(true);
    try {
      await cambiarEstadoAlerta(a.id, siguiente, observacion, usuario);
      setObservacion('');
      avisar({
        tipo: 'exito',
        titulo: siguiente === 'revisada' ? `Alerta ${a.codigo} revisada` : `Alerta ${a.codigo} cerrada`,
        texto: siguiente === 'revisada' ? 'Queda pendiente de cierre por un supervisor.' : 'Se registró la observación.',
      });
    } catch (e) {
      setError(e.message);
      avisar({ tipo: 'error', titulo: 'No se pudo cambiar la alerta', texto: e.message });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <li className={`tarjeta-alerta sev-${a.severidad}`}>
      <div className="tarjeta-cabecera">
        <span className={`insignia-sev sev-${a.severidad}`}>{ETIQUETA_SEVERIDAD[a.severidad]}</span>
        <strong>{a.codigo}</strong>
        <span className={`estado estado-${a.estado}`}>{ESTADOS[a.estado]}</span>
      </div>
      <p className="mensaje">{a.mensaje}</p>
      <p className="detalle">
        {a.caso} · {sesion?.nombreCaso ?? casoPorId(a.caso)?.nombre} · segundo {a.t.toFixed(1).replace('.', ',')} · cuadro {a.cuadro} · {a.objetivo} ·
        situación {a.situacion === 'activa' ? 'activa' : 'terminada'} · regla v{a.versionRegla} · sesión {a.sesion.slice(0, 8)}
      </p>
      {a.revisadaPor && <p className="detalle">Revisada por {a.revisadaPor.nombre} ({fecha(a.revisadaPor.en)})</p>}
      {a.cerradaPor && (
        <p className="detalle">
          Cerrada por {a.cerradaPor.nombre} ({fecha(a.cerradaPor.en)}): «{a.observacion}»
        </p>
      )}

      <button type="button" className="secundario" onClick={() => setVerEvidencia((v) => !v)} aria-expanded={verEvidencia}>
        {verEvidencia ? <EyeOff className="icono" aria-hidden="true" /> : <Eye className="icono" aria-hidden="true" />}
        {verEvidencia ? 'Ocultar evidencia' : 'Ver evidencia'}
      </button>
      {verEvidencia && sesion && <Evidencia alerta={a} sesion={sesion} />}

      {siguiente && permitido && (
        <div className="accion-alerta">
          {siguiente === 'cerrada' && (
            <label>
              Observación (obligatoria)
              <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} />
            </label>
          )}
          <button type="button" onClick={avanzar} disabled={guardando}>
            {siguiente === 'revisada' ? <CheckCheck className="icono" aria-hidden="true" /> : <Lock className="icono" aria-hidden="true" />}
            {siguiente === 'revisada' ? 'Marcar como revisada' : 'Cerrar alerta'}
          </button>
        </div>
      )}
      {siguiente === 'cerrada' && !permitido && puede('revisarAlertas') && (
        <p className="nota">Revisada. Solo el supervisor o el administrador pueden cerrarla.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <Dialogo
        abierto={confirmando}
        peligro
        titulo={`¿Cerrar la alerta ${a.codigo}?`}
        texto="Una alerta cerrada no se puede reabrir. Se guardará tu observación y quién la cerró."
        confirmar="Cerrar alerta"
        onConfirmar={guardar}
        onCancelar={() => setConfirmando(false)}
      />
    </li>
  );
}

// Reconstruye el cuadro exacto de la alerta (misma semilla, mismo cuadro) y resalta el objetivo.
// En una escena generada, el guion se vuelve a generar con la semilla y las opciones de la sesión.
function Evidencia({ alerta, sesion }) {
  const semilla = sesion.semilla;
  const guion = guionDeSesion(sesion, casoPorId);
  const cuadro = generarCuadro(guion, alerta.cuadro, semilla);
  let zona = null;
  if (alerta.tipoObjetivo === 'region') zona = cuadro.regiones.find((r) => r.id === alerta.objetivo) ?? null;
  else {
    const o = cuadro.objetos.find((x) => x.id === alerta.objetivo);
    if (o) zona = { x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h };
  }
  return (
    <figure className="evidencia">
      <MiniEscena escena={cuadro} resaltado={zona} titulo={`Cuadro ${alerta.cuadro} con la evidencia resaltada`} />
      <figcaption>
        Cuadro {alerta.cuadro} reconstruido con la semilla {semilla}. Marco rojo: {alerta.objetivo}.
      </figcaption>
    </figure>
  );
}
