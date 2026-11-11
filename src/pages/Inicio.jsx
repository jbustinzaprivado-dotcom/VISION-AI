import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../data/db.js';
import { calcularIndicadores } from '../data/indicadores.js';
import { cargarDatosEjemplo } from '../data/repositorio.js';
import { ETIQUETAS_SESION } from '../data/estadosSesion.js';
import { useSesion } from '../auth/SesionContext.jsx';
import { casoPorId } from '../simulation/casos.js';
import { ETIQUETA_SEVERIDAD } from '../components/PanelAlertas.jsx';

// Dashboard: indicadores calculados desde las sesiones y alertas guardadas.
const pct = (v) => `${Math.round(v * 100)} %`;
const fecha = (iso) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

export default function Inicio() {
  const { usuario, puede } = useSesion();
  const sesiones = useLiveQuery(() => db.sesiones.orderBy('creadaEn').reverse().toArray(), []);
  const alertas = useLiveQuery(() => db.alertas.orderBy('creadaEn').reverse().toArray(), []);
  const [cargando, setCargando] = useState(false);

  if (sesiones === undefined || alertas === undefined) return <p className="nota">Cargando…</p>;
  const ind = calcularIndicadores(sesiones, alertas);

  async function cargarEjemplo() {
    setCargando(true);
    try {
      await cargarDatosEjemplo(usuario);
    } finally {
      setCargando(false);
    }
  }

  if (sesiones.length === 0) {
    return (
      <section className="panel">
        <h1>Inicio</h1>
        <p>Todavía no hay sesiones guardadas en este navegador (o el historial se borró).</p>
        <p>
          Ejecuta un caso en <Link to="/analisis">Análisis visual</Link>
          {puede('ejecutarCasos') && ' o carga una sesión de ejemplo de cada caso para ver el dashboard'}.
        </p>
        {puede('ejecutarCasos') && (
          <button type="button" onClick={cargarEjemplo} disabled={cargando}>
            {cargando ? 'Cargando…' : 'Cargar sesiones de ejemplo'}
          </button>
        )}
      </section>
    );
  }

  const datosGrafico = ind.porCaso.map((c) => ({
    nombre: `${c.caso} ${casoPorId(c.caso).nombre.split(' ')[0]}`,
    Alertas: c.alertas,
    Pendientes: c.pendientes,
  }));

  return (
    <div className="dashboard">
      <h1>Inicio</h1>
      <p className="nota">
        Indicadores calculados desde {ind.sesiones.total} {ind.sesiones.total === 1 ? 'sesión guardada' : 'sesiones guardadas'} en
        este navegador. Para no perderlos al limpiar el navegador, expórtalos en CSV desde Historial.
      </p>

      <div className="kpis">
        <Kpi titulo="Sesiones completadas" valor={ind.sesiones.completadas} detalle={`${ind.sesiones.canceladas} canceladas`} />
        <Kpi titulo="Alertas pendientes" valor={ind.alertas.pendientes} detalle={`${ind.alertas.nuevas} nuevas · ${ind.alertas.revisadas} revisadas`} enlace="/alertas" />
        <Kpi titulo="Alertas cerradas" valor={ind.alertas.cerradas} detalle={`de ${ind.alertas.total} en total`} />
        <Kpi titulo="Afluencia en tienda" valor={ind.afluencia} detalle="personas que cruzaron la entrada (CU-04)" />
        <Kpi
          titulo="Conformidad en calidad"
          valor={ind.conformidad ? pct(ind.conformidad.tasa) : '—'}
          detalle={ind.conformidad ? `${ind.conformidad.noConformes} no conformes de ${ind.conformidad.productos}` : 'sin sesiones de CU-03'}
        />
      </div>

      <div className="dashboard-cuerpo">
        <section className="panel">
          <h2>Alertas por caso de uso</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={datosGrafico} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
              <CartesianGrid stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Alertas" fill="#0891b2" />
              <Bar dataKey="Pendientes" fill="#ea580c" />
            </BarChart>
          </ResponsiveContainer>
          <p className="nota">
            Por severidad:{' '}
            {Object.entries(ETIQUETA_SEVERIDAD)
              .filter(([s]) => ind.alertas.porSeveridad[s])
              .map(([s, t]) => `${t} ${ind.alertas.porSeveridad[s]}`)
              .join(' · ') || 'sin alertas'}
          </p>
        </section>

        <section className="panel">
          <h2>Alertas pendientes</h2>
          {alertas.filter((a) => a.estado !== 'cerrada').length === 0 ? (
            <p className="nota">No hay alertas pendientes.</p>
          ) : (
            <ul className="lista-simple">
              {alertas
                .filter((a) => a.estado !== 'cerrada')
                .slice(0, 5)
                .map((a) => (
                  <li key={a.id}>
                    <span className={`insignia-sev sev-${a.severidad}`}>{ETIQUETA_SEVERIDAD[a.severidad]}</span>
                    {a.codigo} · {a.caso} · {a.estado}
                  </li>
                ))}
            </ul>
          )}
          <Link to="/alertas">Ver todas las alertas</Link>

          <h2 className="separado">Sesiones recientes</h2>
          <ul className="lista-simple">
            {sesiones.slice(0, 5).map((s) => (
              <li key={s.id}>
                {s.caso} · {ETIQUETAS_SESION[s.estado]} · {fecha(s.creadaEn)}
                {s.ejemplo ? ' · ejemplo' : ''}
              </li>
            ))}
          </ul>
          <Link to="/historial">Ver historial</Link>
        </section>
      </div>
    </div>
  );
}

function Kpi({ titulo, valor, detalle, enlace }) {
  const contenido = (
    <>
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
