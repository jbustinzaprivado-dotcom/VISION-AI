import { useEffect, useRef, useState } from 'react';
import { Circle, Group, Label, Layer, Line, Rect, Stage, Tag, Text } from 'react-konva';
import clases from '../simulation/clases.json';

// Dibuja la escena con Konva, en capas que el usuario activa o apaga:
//   regiones   → mapa de regiones por colores
//   ocupacion  → cada región coloreada según su ocupación
//   calor      → cada región coloreada según las personas que hay (mapa de calor)
//   cambios    → regiones que cambiaron respecto del inicio
//   figuras    → la escena animada
// Solo dibuja: los valores vienen del análisis (prop `resultado`).
// Las coordenadas 0..1 se convierten a píxeles según el ancho disponible.
const PROPORCION = 9 / 16;
export const CAPAS = [
  { id: 'regiones', etiqueta: 'Regiones' },
  { id: 'ocupacion', etiqueta: 'Ocupación' },
  { id: 'calor', etiqueta: 'Mapa de calor' },
  { id: 'cambios', etiqueta: 'Cambios' },
  { id: 'figuras', etiqueta: 'Figuras' },
];

// Verde (vacía) → amarillo → rojo (llena).
export function colorOcupacion(v) {
  const tono = Math.round(120 * (1 - Math.min(1, v)));
  return `hsl(${tono}, 75%, 50%)`;
}
const pct = (v) => `${Math.round(v * 100)} %`;

export default function VisorEscena({ escena, resultado, capas, alertas = [] }) {
  const contenedor = useRef(null);
  const [ancho, setAncho] = useState(800);

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
  const ver = (id) => capas.includes(id);
  const regiones = escena.regiones.filter((r) => r.clase !== 'suelo');
  const medicion = Object.fromEntries((resultado?.mediciones ?? []).map((m) => [m.region, m]));
  const cambio = Object.fromEntries((resultado?.cambios ?? []).map((c) => [c.region, c]));

  // Textos de las capas (ocupación, personas, cambios). Se dibujan en una capa encima
  // de las figuras y con fondo blanco, para que las figuras no los tapen.
  const etiquetas = [];
  for (const r of regiones) {
    const m = medicion[r.id];
    let fila = 0;
    const agregar = (texto, color) => {
      etiquetas.push({ clave: `${r.id}-${fila}`, x: px(r.x) + 4, y: py(r.y) + 16 + fila * 18, texto, color });
      fila += 1;
    };
    if (ver('ocupacion') && m) agregar(`Ocupación ${pct(m.ocupacion)}`, '#1e293b');
    if (ver('calor') && m && m.personas > 0) agregar(`${m.personas} ${m.personas === 1 ? 'persona' : 'personas'}`, '#991b1b');
    const c = cambio[r.id];
    if (ver('cambios') && c) agregar(`${c.diferencia > 0 ? '+' : ''}${pct(c.diferencia)} vs. inicio`, '#92400e');
  }

  return (
    <div className="visor" ref={contenedor}>
      <Stage width={ancho} height={alto}>
        <Layer listening={false}>
          <Rect width={ancho} height={alto} fill="#f8fafc" />
          {ver('regiones') && regiones.map((r) => <Region key={r.id} region={r} px={px} py={py} />)}
        </Layer>

        {ver('ocupacion') && (
          <Layer listening={false}>
            {regiones.map((r) => {
              const m = medicion[r.id];
              if (!m) return null;
              return (
                <Sombreado key={r.id} r={r} px={px} py={py} fill={colorOcupacion(m.ocupacion)}
                  opacity={0.15 + m.ocupacion * 0.5} />
              );
            })}
          </Layer>
        )}

        {ver('calor') && (
          <Layer listening={false}>
            {regiones.map((r) => {
              const m = medicion[r.id];
              if (!m || m.personas === 0) return null;
              return (
                <Sombreado key={r.id} r={r} px={px} py={py} fill="#dc2626"
                  opacity={Math.min(0.65, 0.1 + m.personas * 0.08)} />
              );
            })}
          </Layer>
        )}

        {ver('cambios') && (
          <Layer listening={false}>
            {regiones.map((r) => {
              const c = cambio[r.id];
              if (!c) return null;
              return (
                <Rect key={r.id} x={px(r.x)} y={py(r.y)} width={px(r.w)} height={py(r.h)} stroke="#b45309"
                  strokeWidth={c.diferencia >= 0.2 || c.diferencia <= -0.2 ? 4 : 2} dash={[8, 4]} />
              );
            })}
          </Layer>
        )}

        {ver('figuras') && (
          <Layer listening={false}>
            {escena.objetos.map((o) => (
              <Figura key={o.id} figura={o} px={px} py={py} />
            ))}
          </Layer>
        )}

        {etiquetas.length > 0 && (
          <Layer listening={false}>
            {etiquetas.map((e) => (
              <Label key={e.clave} x={e.x} y={e.y}>
                <Tag fill="#ffffff" opacity={0.85} cornerRadius={3} />
                <Text text={e.texto} padding={2} fontSize={12} fontStyle="bold" fill={e.color} />
              </Label>
            ))}
          </Layer>
        )}

        {/* Evidencia: marco rojo sobre la figura o región de cada alerta activa. */}
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
            const margen = 4;
            return (
              <Group key={`${a.regla}|${a.objetivo}`} x={px(zona.x) - margen} y={py(zona.y) - margen}>
                <Rect width={px(zona.w) + margen * 2} height={py(zona.h) + margen * 2} stroke="#dc2626" strokeWidth={3} cornerRadius={4} />
                <Rect y={-17} width={a.codigo.length * 7 + 12} height={16} fill="#dc2626" cornerRadius={3} />
                <Text text={a.codigo} x={6} y={-15} fontSize={11} fontStyle="bold" fill="#ffffff" />
              </Group>
            );
          })}
        </Layer>
      </Stage>
      <span className="rotulo visor-rotulo">PROTOTIPO</span>
    </div>
  );
}

function Sombreado({ r, px, py, fill, opacity }) {
  return <Rect x={px(r.x)} y={py(r.y)} width={px(r.w)} height={py(r.h)} fill={fill} opacity={opacity} />;
}

function Region({ region: r, px, py }) {
  const cerrada = r.atributos?.abierta === false;
  return (
    <Group x={px(r.x)} y={py(r.y)}>
      <Rect
        width={px(r.w)}
        height={py(r.h)}
        fill={clases.regiones[r.clase].color}
        opacity={cerrada ? 0.2 : 0.45}
        stroke="#475569"
        strokeWidth={1}
        dash={cerrada ? [6, 4] : undefined}
      />
      <Text text={cerrada ? `${r.nombre} (cerrada)` : r.nombre} x={4} y={3} fontSize={11} fill="#334155" />
    </Group>
  );
}

function Figura({ figura: f, px, py }) {
  const w = px(f.w);
  const h = py(f.h);
  const color = clases.objetos[f.clase].color;
  const a = f.atributos ?? {};
  // Se dibuja desde la esquina superior izquierda; (x, y) del guion es el centro.
  const props = { x: px(f.x) - w / 2, y: py(f.y) - h / 2, opacity: a.pocoVisible ? 0.35 : 1 };

  if (f.clase === 'persona') {
    const cabeza = Math.min(w, h) * 0.32;
    return (
      <Group {...props}>
        <Rect y={cabeza * 1.6} width={w} height={h - cabeza * 1.6} fill={color} cornerRadius={4} />
        {a.chaleco && <Rect y={h * 0.55} width={w} height={h * 0.12} fill="#f97316" />}
        <Circle x={w / 2} y={cabeza} radius={cabeza} fill="#cbd5e1" />
        {a.casco && <Rect x={w / 2 - cabeza} y={0} width={cabeza * 2} height={cabeza * 0.9} fill="#facc15" cornerRadius={[cabeza, cabeza, 0, 0]} />}
      </Group>
    );
  }

  if (f.clase === 'montacargas') {
    return (
      <Group {...props}>
        <Rect width={w} height={h} fill={color} stroke="#78350f" strokeWidth={1} cornerRadius={3} />
        <Line points={[w, h * 0.3, w * 1.3, h * 0.3]} stroke="#1f2937" strokeWidth={3} />
        <Line points={[w, h * 0.7, w * 1.3, h * 0.7]} stroke="#1f2937" strokeWidth={3} />
      </Group>
    );
  }

  if (f.clase === 'producto') {
    const d = a.defecto;
    return (
      <Group {...props}>
        <Rect width={w} height={h} fill={color} stroke="#134e4a" strokeWidth={1} cornerRadius={3} />
        {a.etiqueta && <Rect x={w * 0.15} y={h * 0.08} width={w * 0.7} height={h * 0.18} fill="#ffffff" />}
        {a.piezaFaltante && <Rect x={w * 0.7} y={h * 0.7} width={w * 0.3} height={h * 0.3} fill="#f8fafc" />}
        {d && <Rect x={d.x * w} y={d.y * h} width={d.w * w} height={d.h * h} fill="#dc2626" />}
      </Group>
    );
  }

  return (
    <Group {...props}>
      <Rect width={w} height={h} fill={color} stroke="#1e293b" strokeWidth={1} opacity={0.9} cornerRadius={2} />
    </Group>
  );
}
