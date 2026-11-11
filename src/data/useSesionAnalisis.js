import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { procesarSesion } from '../rules/motorReglas.js';
import { cambiarEstadoSesion, crearSesion, registrarEventos, reglasVigentes } from './repositorio.js';
import { resumir } from './resumen.js';

// Une la escena con la sesión guardada:
//  - Iniciar crea la sesión una sola vez (pulsar dos veces no crea dos).
//  - A medida que avanza el reloj se guardan las alertas y eventos ya ocurridos.
//  - Al llegar al final la sesión queda "completada" con su resumen.
//  - Reiniciar, cambiar de caso o salir de la pantalla la deja "cancelada".
// Los eventos se calculan una vez para toda la sesión (la simulación es determinista)
// y se muestran los que tienen t ≤ instante actual.
export function useSesionAnalisis({ guion, semilla, reloj, controles, usuario }) {
  const reglasActuales = useLiveQuery(reglasVigentes, []);
  const [sesion, setSesion] = useState(null); // { id, reglas }
  const creando = useRef(false);
  const guardados = useRef(0);
  const cola = useRef(Promise.resolve());
  const [error, setError] = useState(null);

  // Encola operaciones de base de datos para que ocurran en orden.
  const encolar = (tarea) => {
    cola.current = cola.current.then(tarea).catch((e) => setError(e.message));
    return cola.current;
  };

  // Con sesión, se usan las reglas con las que empezó (RN-G4); sin sesión, las vigentes.
  const reglas = sesion?.reglas ?? reglasActuales;
  const eventos = useMemo(() => (reglas ? procesarSesion(guion, semilla, reglas) : []), [guion, semilla, reglas]);

  // Cancelar la sesión abierta al cambiar de caso o semilla, o al salir de la pantalla.
  const sesionRef = useRef(null);
  sesionRef.current = sesion;
  useEffect(() => {
    return () => {
      const abierta = sesionRef.current;
      if (abierta && !abierta.terminada) encolar(() => cambiarEstadoSesion(abierta.id, 'cancelada'));
      setSesion(null);
      guardados.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guion, semilla]);

  // Guardar los eventos que ya ocurrieron y cerrar la sesión al final del guion.
  useEffect(() => {
    if (!sesion || sesion.terminada) return;
    const nuevos = [];
    while (guardados.current < eventos.length && eventos[guardados.current].t <= reloj.t) {
      nuevos.push(eventos[guardados.current]);
      guardados.current += 1;
    }
    const id = sesion.id;
    if (nuevos.length) encolar(() => registrarEventos(id, nuevos));
    if (reloj.terminado) {
      setSesion((s) => ({ ...s, terminada: true }));
      encolar(() => cambiarEstadoSesion(id, 'completada', resumir(guion, eventos)));
    }
  }, [sesion, eventos, reloj.t, reloj.terminado, guion]);

  const acciones = {
    async iniciar() {
      if (!reglas) return;
      if (!sesion) {
        if (creando.current) return; // PF-02: doble clic, una sola sesión
        creando.current = true;
        try {
          const nueva = await crearSesion({ guion, semilla, velocidad: reloj.velocidad, usuario, reglas });
          guardados.current = 0;
          setSesion({ id: nueva.id, reglas, terminada: false });
        } catch (e) {
          setError(e.message);
          return;
        } finally {
          creando.current = false;
        }
      } else if (!sesion.terminada) {
        const id = sesion.id;
        encolar(() => cambiarEstadoSesion(id, 'en_ejecucion'));
      }
      controles.iniciar();
    },
    pausar() {
      controles.pausar();
      if (sesion && !sesion.terminada) {
        const id = sesion.id;
        encolar(() => cambiarEstadoSesion(id, 'pausada'));
      }
    },
    reiniciar() {
      if (sesion && !sesion.terminada) {
        const id = sesion.id;
        encolar(() => cambiarEstadoSesion(id, 'cancelada'));
      }
      setSesion(null);
      guardados.current = 0;
      controles.reiniciar();
    },
  };

  return { eventos, sesion, acciones, error, cargando: !reglas };
}
