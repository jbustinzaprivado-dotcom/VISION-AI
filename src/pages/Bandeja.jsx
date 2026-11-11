import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db.js';

// Bandeja de salida SIMULADA: muestra el correo que recibiría el administrador
// por cada alerta alta y al completar cada sesión. Nada se envía.
const fecha = (iso) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

export default function Bandeja() {
  const correos = useLiveQuery(() => db.correos.orderBy('creadoEn').reverse().toArray(), []);
  const [abierto, setAbierto] = useState(null);

  return (
    <div className="bandeja-pagina">
      <h1>Bandeja simulada</h1>
      <p className="aviso-ilustrativo">
        <span className="rotulo">PROTOTIPO</span> Ningún correo se envía: esta bandeja muestra lo que recibiría el
        administrador por cada alerta alta y al completar cada sesión.
      </p>
      {correos === undefined ? (
        <p className="nota">Cargando…</p>
      ) : correos.length === 0 ? (
        <p className="panel nota">La bandeja está vacía. Los avisos aparecen al ejecutar casos con alertas altas.</p>
      ) : (
        <ul className="bandeja">
          {correos.map((c) => (
            <li key={c.id}>
              <button type="button" className="correo" onClick={() => setAbierto((id) => (id === c.id ? null : c.id))}
                aria-expanded={abierto === c.id}>
                <span className="correo-tipo">{c.tipo === 'alerta' ? 'Alerta alta' : 'Resumen'}</span>
                <span className="correo-asunto">{c.asunto}</span>
                <span className="correo-fecha">{fecha(c.creadoEn)}</span>
              </button>
              {abierto === c.id && (
                <div className="correo-cuerpo">
                  <p className="nota">Para: {c.para} · Estado: {c.estado}</p>
                  {c.cuerpo.split('\n').filter(Boolean).map((linea) => (
                    <p key={linea}>{linea}</p>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
