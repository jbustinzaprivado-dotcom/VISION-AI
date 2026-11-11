import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Database,
  PlayCircle,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { db } from '../data/db.js';
import { calcularIndicadores } from '../data/indicadores.js';
import { cargarDatosEjemplo } from '../data/repositorio.js';
import { ETIQUETAS_SESION } from '../data/estadosSesion.js';
import { useSesion } from '../auth/SesionContext.jsx';
import { casoPorId } from '../simulation/casos.js';
import { ETIQUETA_SEVERIDAD } from '../components/PanelAlertas.jsx';
import { useAvisos } from '../components/ui/Avisos.jsx';

// Dashboard: todos los indicadores se calculan desde las sesiones y alertas guardadas.
const pct = (v) => `${Math.round(v * 100)} %`;
const fecha = (iso) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
const COLOR_SEVERIDAD = { alta: '#dc2626', media: '#ea580c', baja: '#ca8a04', informativa: '#0369a1' };
const EJES = { stroke: 'var(--texto-suave)', fontSize: 12 };
const TOOLTIP = {
  contentStyle: { background: 'var(--superficie)', border: '1px solid var(--borde)', borderRadius: 8, color: 'var(--texto)' },
  labelStyle: { color: 'var(--texto)' },
};

export default function Inicio() {
  const { usuario, puede } = useSesion();
  const avisar = useAvisos();
  const sesiones = useLiveQuery(() => db.sesiones.orderBy('creadaEn').reverse().toArray(), []);
  const alertas = useLiveQuery(() => db.alertas.orderBy('creadaEn').reverse().toArray(), []);
  const [cargando, setCargando] = useState(false);

  if (sesiones === undefined || alertas === undefined) {
    return (
      <div className="dashboard" aria-busy="true">
        <h1>Inicio</h1>
        <div className="kpis">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="esqueleto" />
          ))}
        </div>
      </div>
    );
  }
  const ind = calcularIndicadores(sesiones, alertas);

  async function cargarEjemplo() {
    setCargando(true);
    try {
      await cargarDatosEjemplo(usuario);
      avisar({ tipo: 'exito', titulo: 'Sesiones de ejemplo cargadas', texto: 'Una sesión completada de cada caso de uso.' });
    } catch (e) {
      avisar({ tipo: 'error', titulo: 'No se pudieron cargar', texto: e.message });
    } finally {
      setCargando(false);
    }
  }

  if (sesiones.length === 0) {
    return (
      <section className="panel">
        <h1 className="panel-titulo">
          <Database className="icono" aria-hidden="true" /> Inicio
        </h1>
        <p>Todavía no hay sesiones guardadas en este navegador (o el historial se borró).</p>
        <p className="nota">
          Ejecuta un caso en <Link to="/analisis">Análisis visual</Link>
          {puede('ejecutarCasos') && ' o carga una sesión de ejemplo de cada caso para ver el dashboard'}.
        </p>
        {puede('ejecutarCasos') && (
          <button type="button" onClick={cargarEjemplo} disabled={cargando}>
            <PlayCircle className="icono" aria-hidden="true" />
            {cargando ? 'Cargando…' : 'Cargar sesiones de ejemplo'}
          </button>
        )}
      </section>
    );
  }

  const datosCasos = ind.porCaso.map((c) => ({
    nombre: `${c.caso} ${casoPorId(c.caso).nombre.split(' ')[0]}`,
    Alertas: c.alertas,
    Pendientes: c.pendientes,
  }));
  const datosSeveridad = Object.entries(ind.alertas.porSeveridad).map(([sev, n]) => ({
    nombre: ETIQUETA_SEVERIDAD[sev],
    valor: n,
    color: COLOR_SEVERIDAD[sev],
  }));
  const pendientes = alertas.filter((a) => a.estado !== 'cerrada');

  return (
    <div className="dashboard">
      <h1>Inicio</h1>
      <p className="nota">
        Indicadores calculados desde {ind.sesiones.total} {ind.sesiones.total === 1 ? 'sesión guardada' : 'sesiones guardadas'} en
        este navegador. Para conservarlos al limpiar el navegador, expórtalos en CSV desde Historial.
      </p>

      <div className="kpis">
        <Kpi icono={ClipboardCheck} titulo="Sesiones completadas" valor={ind.sesiones.completadas}
          detalle={`${ind.sesiones.canceladas} canceladas · ${ind.sesiones.total} en total`} enlace="/historial" />
        <Kpi icono={BellRing} color="rojo" titulo="Alertas pendientes" valor={ind.alertas.pendientes}
          detalle={`${ind.alertas.nuevas} nuevas · ${ind.alertas.revisadas} revisadas`} enlace="/alertas" />
        <Kpi icono={CheckCircle2} color="verde" titulo="Alertas cerradas" valor={ind.alertas.cerradas}
          detalle={ind.alertas.total ? `${pct(ind.alertas.cerradas / ind.alertas.total)} de ${ind.alertas.total}` : 'sin alertas'} />
        <Kpi icono={Users} titulo="Afluencia en tienda" valor={ind.afluencia} detalle="personas que cruzaron la entrada (CU-04)" />
        <Kpi icono={ShieldAlert} color="ambar" titulo="Conformidad en calidad"
          valor={ind.conformidad ? pct(ind.conformidad.tasa) : '—'}
          detalle={ind.conformidad ? `${ind.conformidad.noConformes} no conformes de ${ind.conformidad.productos}` : 'sin sesiones de CU-03'} />
      </div>

      <div className="dashboard-graficos">
        <section className="panel">
          <h2>Alertas por caso de uso</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={datosCasos} margin={{ top: 8, right: 8, bottom: 4, left: -18 }} barGap={4}>
              <CartesianGrid stroke="var(--borde)" vertical={false} />
              <XAxis dataKey="nombre" tick={EJES} stroke="var(--borde-fuerte)" />
              <YAxis allowDecimals={false} tick={EJES} stroke="var(--borde-fuerte)" />
              <Tooltip {...TOOLTIP} cursor={{ fill: 'var(--superficie-hover)' }} />
              <Legend />
              <Bar dataKey="Alertas" fill="#0891b2" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Pendientes" fill="#ea580c" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="panel">
          <h2>Alertas por severidad</h2>
          {datosSeveridad.length === 0 ? (
            <p className="nota">Sin alertas.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={datosSeveridad} dataKey="valor" nameKey="nombre" innerRadius={58} outerRadius={88} paddingAngle={3} stroke="none">
                  {datosSeveridad.map((d) => (
                    <Cell key={d.nombre} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP} />
                <Legend formatter={(v, e) => `${v}: ${e.payload.valor}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      <div className="dashboard-cuerpo">
        <section className="panel">
          <h2>Alertas pendientes</h2>
          {pendientes.length === 0 ? (
            <p className="nota">No hay alertas pendientes.</p>
          ) : (
            <ul className="lista-limpia">
              {pendientes.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <span className={`insignia-sev sev-${a.severidad}`}>{ETIQUETA_SEVERIDAD[a.severidad]}</span>
                  <span>
                    <strong>{a.codigo}</strong> · {a.mensaje}
                  </span>
                  <span className="derecha">{a.caso} · {a.estado}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/alertas" className="enlace-boton">
            Ver todas las alertas <ArrowRight className="icono" aria-hidden="true" />
          </Link>
        </section>

        <section className="panel">
          <h2>Sesiones recientes</h2>
          <ul className="lista-limpia">
            {sesiones.slice(0, 6).map((s) => (
              <li key={s.id}>
                <strong>{s.caso}</strong>
                <span>{ETIQUETAS_SESION[s.estado]}{s.ejemplo ? ' · ejemplo' : ''}</span>
                <span className="derecha">{fecha(s.creadaEn)}</span>
              </li>
            ))}
          </ul>
          <Link to="/historial">Ver historial</Link>
        </section>
      </div>
    </div>
  );
}

function Kpi({ icono: Icono, color = '', titulo, valor, detalle, enlace }) {
  const contenido = (
    <>
      <span className={`kpi-icono ${color}`}>
        <Icono className="icono" aria-hidden="true" />
      </span>
      <span className="kpi-titulo">{titulo}</span>
      <span className="kpi-valor">{valor}</span>
      <span className="kpi-detalle">{detalle}</span>
    </>
  );
  return enlace ? (
    <Link to={enlace} className="kpi">
      {contenido}
    </Link>
  ) : (
    <div className="kpi">{contenido}</div>
  );
}
