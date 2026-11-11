import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Label, Layer, Line, Rect, Shape, Stage, Tag, Text } from 'react-konva';
import clases from '../simulation/clases.json';
import { posicionEn } from '../simulation/trayectoria.js';
import { RegionDibujo } from './escena/Regiones.jsx';
import { FiguraDibujo } from './escena/Figuras.jsx';

// Visor de la cámara simulada (DT-7), dibujado con Konva en capas que el usuario
// activa o apaga:
//   regiones      → mapa de regiones con el aspecto de cada zona
//   ocupacion     → cada región coloreada según su ocupación
//   calor         → intensidad según las personas que hay (mapa de calor)
//   cambios       → regiones que cambiaron respecto del inicio
//   detecciones   → caja y clase de cada figura, como lo marcaría un detector
//   trayectorias  → recorrido de los últimos segundos de lo que se mueve
//   figuras       → la escena animada
// Encima va la interfaz de cámara (nombre, REC, hora) y el marco de las alertas activas.
// Solo dibuja: los valores vienen del análisis (prop `resultado`).
const PROPORCION = 9 / 16;
export const CAPAS = [
  { id: 'regiones', etiqueta: 'Regiones' },
  { id: 'ocupacion', etiqueta: 'Ocupación' },
  { id: 'calor', etiqueta: 'Mapa de calor' },
  { id: 'cambios', etiqueta: 'Cambios' },
  { id: 'detecciones', etiqueta: 'Detecciones' },
  { id: 'trayectorias', etiqueta: 'Trayectorias' },
  { id: 'figuras', etiqueta: 'Figuras' },
];
const TRAZO_SEGUNDOS = 4;
const TRAZO_PASO = 0.25;

// Verde (vacía) → amarillo → rojo (llena).
export function colorOcupacion(v) {
  const tono = Math.round(120 * (1 - Math.min(1, v)));
  return `hsl(${tono}, 75%, 50%)`;
}
const pct = (v) => `${Math.round(v * 100)} %`;
const reloj = (t) => {
  const s = Math.floor(t);
  return `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
};
function prefiereMenosMovimiento() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function VisorEscena({ escena, resultado, capas, alertas = [], guion = null }) {
  const contenedor = useRef(null);
  const [ancho, setAncho] = useState(800);
  const quieto = useMemo(prefiereMenosMovimiento, []);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return undefined;
    const medir = () => setAncho(el.clientWidth);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const alto = ancho * PROPORCION;
  const px = (v) => v * ancho;
  const py = (v) => v * alto;
  const t = escena.t ?? 0;
  const ver = (id) => capas.includes(id);
  const regiones = escena.regiones.filter((r) => r.clase !== 'suelo');
  const medicion = Object.fromEntries((resultado?.mediciones ?? []).map((m) => [m.region, m]));
  const cambio = Object.fromEntries((resultado?.cambios ?? []).map((c) => [c.region, c]));

  // Textos de las capas (ocupación, personas, cambios), encima de las figuras y con fondo.
  const etiquetas = [];
  for (const r of regiones) {
    const m = medicion[r.id];
    let fila = 0;
    const agregar = (texto, color) => {
      etiquetas.push({ clave: `${r.id}-${fila}`, x: px(r.x) + 4, y: py(r.y) + 4 + fila * 18, texto, color });
      fila += 1;
    };
    if (ver('ocupacion') && m) agregar(`Ocupación ${pct(m.ocupacion)}`, '#1e293b');
    if (ver('calor') && m && m.personas > 0) agregar(`${m.personas} ${m.personas === 1 ? 'persona' : 'personas'}`, '#991b1b');
    const c = cambio[r.id];
    if (ver('cambios') && c) agregar(`${c.diferencia > 0 ? '+' : ''}${pct(c.diferencia)} vs. inicio`, '#92400e');
  }

  // Trayectorias: posiciones de los últimos segundos de cada figura que se mueve.
  const trazos = [];
  if (ver('trayectorias') && guion) {
    for (const o of guion.objetos) {
      const puntos = [];
      for (let k = TRAZO_SEGUNDOS; k >= 0; k -= TRAZO_PASO) {
        const p = posicionEn(o, t - k);
        if (p) puntos.push(px(p.x), py(p.y));
      }
      const movido = puntos.length >= 4 && (puntos[0] !== puntos.at(-2) || puntos[1] !== puntos.at(-1));
      if (movido) trazos.push({ id: o.id, puntos, color: clases.objetos[o.clase]?.color ?? '#94a3b8' });
    }
  }

  const compacto = ancho < 520; // en pantallas angostas la interfaz de la cámara se achica
  const pulso = quieto ? 1 : (Math.sin(t * 6) + 1) / 2; // 0..1, ligado al tiempo de simulación
  const grabando = quieto || Math.floor(t * 2) % 2 === 0;

  return (
    <div className="visor" ref={contenedor}>
      <Stage width={ancho} height={alto}>
        {/* Suelo de hormigón con baldosas */}
        <Layer listening={false}>
          <Rect width={ancho} height={alto} fill="#1b2332" />
          <Shape
            sceneFunc={(ctx, forma) => {
              ctx.beginPath();
              const paso = ancho / 20;
              for (let x = paso; x < ancho; x += paso) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, alto);
              }
              for (let y = paso; y < alto; y += paso) {
                ctx.moveTo(0, y);
                ctx.lineTo(ancho, y);
              }
              ctx.fillStrokeShape(forma);
            }}
            stroke="#273246"
            strokeWidth={1}
          />
          {ver('regiones') && regiones.map((r) => <RegionDibujo key={r.id} region={r} px={px} py={py} t={t} />)}
        </Layer>

        {(ver('ocupacion') || ver('calor') || ver('cambios')) && (
          <Layer listening={false}>
            {ver('ocupacion') &&
              regiones.map((r) =>
                medicion[r.id] ? (
                  <Rect key={`o-${r.id}`} x={px(r.x)} y={py(r.y)} width={px(r.w)} height={py(r.h)}
                    fill={colorOcupacion(medicion[r.id].ocupacion)} opacity={0.15 + medicion[r.id].ocupacion * 0.5} />
                ) : null,
              )}
            {ver('calor') &&
              regiones.map((r) => {
                const m = medicion[r.id];
                if (!m || m.personas === 0) return null;
                return (
                  <Rect key={`c-${r.id}`} x={px(r.x)} y={py(r.y)} width={px(r.w)} height={py(r.h)}
                    fill="#dc2626" opacity={Math.min(0.6, 0.1 + m.personas * 0.08)} />
                );
              })}
            {ver('cambios') &&
              regiones.map((r) => {
                const c = cambio[r.id];
                if (!c) return null;
                return (
                  <Rect key={`d-${r.id}`} x={px(r.x)} y={py(r.y)} width={px(r.w)} height={py(r.h)} stroke="#f59e0b"
                    strokeWidth={Math.abs(c.diferencia) >= 0.2 ? 4 : 2} dash={[8, 4]} />
                );
              })}
          </Layer>
        )}

        {trazos.length > 0 && (
          <Layer listening={false}>
            {trazos.map((tr) => (
              <Group key={tr.id}>
                <Line points={tr.puntos} stroke={tr.color} strokeWidth={3} opacity={0.55} lineCap="round" lineJoin="round" dash={[2, 6]} />
                <Circle x={tr.puntos[0]} y={tr.puntos[1]} radius={3} fill={tr.color} opacity={0.6} />
              </Group>
            ))}
          </Layer>
        )}

        {ver('figuras') && (
          <Layer listening={false}>
            {escena.objetos.map((o) => (
              <FiguraDibujo key={o.id} figura={o} px={px} py={py} t={t} />
            ))}
          </Layer>
        )}

        {ver('detecciones') && (
          <Layer listening={false}>
            {escena.objetos.map((o) => {
              const x = px(o.x - o.w / 2) - 3;
              const y = py(o.y - o.h / 2) - 3;
              const nombre = clases.objetos[o.clase]?.nombre.toLowerCase() ?? o.clase;
              return (
                <Group key={o.id} x={x} y={y}>
                  <Rect width={px(o.w) + 6} height={py(o.h) + 6} stroke="#22d3ee" strokeWidth={1.2} opacity={0.9} />
                  <Esquinas w={px(o.w) + 6} h={py(o.h) + 6} />
                  <Label y={-14}>
                    <Tag fill="#0e7490" opacity={0.9} cornerRadius={2} />
                    <Text text={nombre} padding={2} fontSize={9} fill="#ecfeff" />
                  </Label>
                </Group>
              );
            })}
          </Layer>
        )}

        {etiquetas.length > 0 && (
          <Layer listening={false}>
            {etiquetas.map((e) => (
              <Label key={e.clave} x={e.x} y={e.y}>
                <Tag fill="#ffffff" opacity={0.88} cornerRadius={3} />
                <Text text={e.texto} padding={2} fontSize={12} fontStyle="bold" fill={e.color} />
              </Label>
            ))}
          </Layer>
        )}

        {/* Evidencia: marco rojo con pulso sobre la figura o región de cada alerta activa. */}
        <Layer listening={false}>
          {alertas.map((a) => {
            const zona =
              a.tipoObjetivo === 'region'
                ? regiones.find((r) => r.id === a.objetivo)
                : (() => {
                    const o = escena.objetos.find((x) => x.id === a.objetivo);
                    return o && { x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h };
                  })();
            if (!zona) return null;
            const margen = 5;
            return (
              <Group key={`${a.regla}|${a.objetivo}`} x={px(zona.x) - margen} y={py(zona.y) - margen}>
                <Rect width={px(zona.w) + margen * 2} height={py(zona.h) + margen * 2} stroke="#ef4444"
                  strokeWidth={2.5 + pulso * 2} opacity={0.65 + pulso * 0.35} cornerRadius={4}
                  shadowColor="#ef4444" shadowBlur={6 + pulso * 10} />
                <Rect y={-18} width={a.codigo.length * 7 + 14} height={16} fill="#dc2626" cornerRadius={3} />
                <Text text={a.codigo} x={7} y={-16} fontSize={11} fontStyle="bold" fill="#ffffff" />
              </Group>
            );
          })}
        </Layer>

        {/* Interfaz de la cámara de seguridad simulada */}
        <Layer listening={false}>
          <Shape
            sceneFunc={(ctx, forma) => {
              ctx.beginPath();
              for (let y = 0; y < alto; y += 3) {
                ctx.moveTo(0, y);
                ctx.lineTo(ancho, y);
              }
              ctx.fillStrokeShape(forma);
            }}
            stroke="#000"
            strokeWidth={1}
            opacity={0.06}
          />
          <Esquinas w={ancho} h={alto} margen={10} largo={22} color="rgba(226,232,240,0.7)" grosor={2} />
          {/* Rótulo de la cámara y grabación, abajo a la izquierda para no tapar la escena */}
          <Group x={compacto ? 8 : 14} y={alto - (compacto ? 34 : 48)}>
            <Rect width={compacto ? 150 : Math.max(200, (guion ? guion.nombre.length + 12 : 16) * 7.2)} height={compacto ? 26 : 36}
              fill="rgba(2,6,23,0.62)" cornerRadius={4} />
            <Text text={guion ? (compacto ? `CAM-${guion.caso.slice(3)}` : `CAM-${guion.caso.slice(3)} · ${guion.nombre.toUpperCase()}`) : 'CÁMARA SIMULADA'}
              x={6} y={compacto ? 3 : 5} fontSize={compacto ? 8 : 10} fontStyle="bold" fill="#e2e8f0" letterSpacing={0.6} />
            <Circle x={compacto ? 10 : 13} y={compacto ? 18 : 26} radius={compacto ? 3 : 4} fill={grabando ? '#ef4444' : '#7f1d1d'} />
            <Text text={`REC ${reloj(t)}`} x={compacto ? 17 : 22} y={compacto ? 14 : 20} fontSize={compacto ? 8 : 11} fontStyle="bold" fill="#e2e8f0" fontFamily="monospace" />
            <Text text="PROTOTIPO" x={compacto ? 98 : 138} y={compacto ? 15 : 21} fontSize={compacto ? 7 : 9} fontStyle="bold" fill="#fbbf24" letterSpacing={1} />
          </Group>
        </Layer>
      </Stage>
      {/* El rótulo PROTOTIPO se dibuja dentro del recuadro de la cámara; este texto es para lectores de pantalla. */}
      <span className="oculto">PROTOTIPO: escena simulada, no es una cámara real.</span>
    </div>
  );
}

// Esquinas tipo visor: marcan una caja de detección o el encuadre de la cámara.
function Esquinas({ w, h, margen = 0, largo = 7, color = '#67e8f9', grosor = 2 }) {
  const a = margen;
  const b = w - margen;
  const c = h - margen;
  const lineas = [
    [a, a + largo, a, a, a + largo, a],
    [b - largo, a, b, a, b, a + largo],
    [a, c - largo, a, c, a + largo, c],
    [b - largo, c, b, c, b, c - largo],
  ];
  return lineas.map((p) => <Line key={p.join(',')} points={p} stroke={color} strokeWidth={grosor} />);
}
