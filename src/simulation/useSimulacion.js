import { useEffect, useMemo, useState } from 'react';
import * as R from './reloj.js';
import { escenaConRuido } from './motor.js';

// Une el reloj con la pantalla: mientras no esté en pausa, avanza en cada
// fotograma del navegador (requestAnimationFrame) y entrega la escena del instante.
export function useSimulacion(guion, semilla) {
  const [reloj, setReloj] = useState(() => R.crearReloj(guion.duracion));

  // Al cambiar de caso o de semilla, la sesión vuelve a empezar.
  useEffect(() => {
    setReloj((r) => ({ ...R.crearReloj(guion.duracion), velocidad: r.velocidad }));
  }, [guion, semilla]);

  // Fotogramas dibujados por segundo, para comprobar que la escena va fluida (≥ 10).
  const [fps, setFps] = useState(null);

  useEffect(() => {
    if (reloj.pausado) return undefined;
    let anterior = performance.now();
    let inicioConteo = anterior;
    let dibujados = 0;
    let id;
    const paso = (ahora) => {
      const dt = Math.min(0.1, (ahora - anterior) / 1000); // si la pestaña se congela, no salta
      anterior = ahora;
      setReloj((r) => R.avanzar(r, dt));
      dibujados += 1;
      if (ahora - inicioConteo >= 1000) {
        setFps(Math.round((dibujados * 1000) / (ahora - inicioConteo)));
        dibujados = 0;
        inicioConteo = ahora;
      }
      id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [reloj.pausado]);

  const escena = useMemo(() => escenaConRuido(guion, reloj.t, semilla), [guion, reloj.t, semilla]);

  const controles = {
    iniciar: () => setReloj(R.iniciar),
    pausar: () => setReloj(R.pausar),
    reiniciar: () => setReloj(R.reiniciar),
    pasoAPaso: () => setReloj(R.pasoAPaso),
    saltarA: (t) => setReloj((r) => R.saltarA(r, t)),
    velocidad: (v) => setReloj((r) => R.cambiarVelocidad(r, v)),
  };

  return { reloj, escena, controles, fps };
}
