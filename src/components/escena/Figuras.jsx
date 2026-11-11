import { Circle, Ellipse, Group, Line, Rect } from 'react-konva';
import clases from '../../simulation/clases.json';

// Figuras vectoriales detalladas. (x, y) del guion es el CENTRO; aquí se dibuja
// dentro de la caja w × h de cada figura. Los atributos se ven en el dibujo:
// casco (amarillo), chaleco (naranja con franjas reflectantes), defecto (rojo),
// etiqueta (blanca), pieza faltante (hueco) y "poco visible" (translúcida).

export function FiguraDibujo({ figura: f, px, py, t }) {
  const w = px(f.w);
  const h = py(f.h);
  const a = f.atributos ?? {};
  const props = { x: px(f.x) - w / 2, y: py(f.y) - h / 2, opacity: a.pocoVisible ? 0.35 : 1 };
  const Dibujo = DIBUJOS[f.clase] ?? Generica;
  return (
    <Group {...props}>
      {/* sombra en el suelo */}
      <Ellipse x={w / 2} y={h * 0.96} radiusX={w * 0.5} radiusY={Math.max(2, h * 0.05)} fill="#000" opacity={0.35} />
      <Dibujo w={w} h={h} a={a} t={t} enMovimiento={f.enMovimiento} color={clases.objetos[f.clase]?.color} />
    </Group>
  );
}

function Persona({ w, h, a }) {
  const cabeza = Math.min(w * 0.42, h * 0.16);
  const cx = w / 2;
  const torsoY = cabeza * 2.1;
  const torsoH = h * 0.42;
  const piernasY = torsoY + torsoH;
  return (
    <>
      {/* piernas */}
      <Rect x={cx - w * 0.3} y={piernasY} width={w * 0.24} height={h - piernasY - h * 0.04} fill="#1e3a8a" cornerRadius={2} />
      <Rect x={cx + w * 0.06} y={piernasY} width={w * 0.24} height={h - piernasY - h * 0.04} fill="#1e3a8a" cornerRadius={2} />
      {/* brazos */}
      <Rect x={0} y={torsoY + 2} width={w * 0.18} height={torsoH * 0.8} fill="#334155" cornerRadius={3} />
      <Rect x={w * 0.82} y={torsoY + 2} width={w * 0.18} height={torsoH * 0.8} fill="#334155" cornerRadius={3} />
      {/* torso: chaleco con franjas reflectantes o ropa normal */}
      <Rect x={w * 0.14} y={torsoY} width={w * 0.72} height={torsoH} fill={a.chaleco ? '#f97316' : '#2563eb'} cornerRadius={4} />
      {a.chaleco && (
        <>
          <Rect x={w * 0.14} y={torsoY + torsoH * 0.35} width={w * 0.72} height={2} fill="#f8fafc" opacity={0.9} />
          <Rect x={w * 0.14} y={torsoY + torsoH * 0.62} width={w * 0.72} height={2} fill="#f8fafc" opacity={0.9} />
        </>
      )}
      {/* cabeza y casco */}
      <Circle x={cx} y={cabeza * 1.05} radius={cabeza} fill="#e7c3a1" />
      {a.casco && (
        <>
          <Rect x={cx - cabeza * 1.05} y={cabeza * 0.05} width={cabeza * 2.1} height={cabeza * 0.95} fill="#facc15" cornerRadius={[cabeza, cabeza, 1, 1]} />
          <Rect x={cx - cabeza * 1.3} y={cabeza * 0.92} width={cabeza * 2.6} height={Math.max(1.5, cabeza * 0.18)} fill="#eab308" cornerRadius={1} />
        </>
      )}
    </>
  );
}

function Montacargas({ w, h, t, enMovimiento }) {
  const rueda = Math.max(2.5, Math.min(w, h) * 0.13);
  const encendida = enMovimiento && Math.floor(t * 4) % 2 === 0; // baliza intermitente al moverse
  return (
    <>
      {/* horquillas hacia adelante (derecha) */}
      <Rect x={w * 0.92} y={h * 0.22} width={w * 0.38} height={Math.max(2, h * 0.08)} fill="#374151" />
      <Rect x={w * 0.92} y={h * 0.7} width={w * 0.38} height={Math.max(2, h * 0.08)} fill="#374151" />
      {/* mástil */}
      <Rect x={w * 0.84} y={h * 0.08} width={w * 0.1} height={h * 0.84} fill="#1f2937" />
      {/* chasis */}
      <Rect x={0} y={h * 0.12} width={w * 0.86} height={h * 0.76} fill="#f59e0b" stroke="#92400e" strokeWidth={1} cornerRadius={4} />
      {/* cabina y techo de protección */}
      <Rect x={w * 0.2} y={h * 0.22} width={w * 0.44} height={h * 0.56} fill="#111827" opacity={0.85} cornerRadius={3} />
      <Line points={[w * 0.2, h * 0.22, w * 0.64, h * 0.78]} stroke="#4b5563" strokeWidth={1} />
      <Line points={[w * 0.64, h * 0.22, w * 0.2, h * 0.78]} stroke="#4b5563" strokeWidth={1} />
      {/* ruedas */}
      {[
        [w * 0.16, h * 0.1],
        [w * 0.7, h * 0.1],
        [w * 0.16, h * 0.9],
        [w * 0.7, h * 0.9],
      ].map(([rx, ry]) => (
        <Rect key={`${rx}-${ry}`} x={rx - rueda} y={ry - rueda / 2} width={rueda * 2} height={rueda} fill="#0f172a" cornerRadius={2} />
      ))}
      {/* baliza */}
      <Circle x={w * 0.42} y={h * 0.5} radius={Math.max(2, w * 0.07)} fill={encendida ? '#fb923c' : '#7c2d12'} shadowColor="#fb923c" shadowBlur={encendida ? 12 : 0} />
    </>
  );
}

function Pallet({ w, h }) {
  const tablas = 5;
  return (
    <>
      <Rect width={w} height={h} fill="#6b3f1d" cornerRadius={2} />
      {Array.from({ length: tablas }, (_, i) => (
        <Rect key={i} x={2} y={2 + ((h - 4) / tablas) * i} width={w - 4} height={(h - 4) / tablas - 2} fill="#a16207" cornerRadius={1} />
      ))}
      <Rect x={w * 0.1} y={h * 0.1} width={w * 0.8} height={h * 0.8} fill="#b45309" opacity={0.55} stroke="#78350f" strokeWidth={1} />
      <Line points={[w * 0.1, h / 2, w * 0.9, h / 2]} stroke="#fde68a" strokeWidth={1} opacity={0.6} />
      <Line points={[w / 2, h * 0.1, w / 2, h * 0.9]} stroke="#fde68a" strokeWidth={1} opacity={0.6} />
    </>
  );
}

function Caja({ w, h }) {
  return (
    <>
      <Rect width={w} height={h} fill="#c2843d" stroke="#7c4a14" strokeWidth={1} cornerRadius={2} />
      <Rect x={w * 0.42} width={w * 0.16} height={h} fill="#e8c38a" opacity={0.85} />
      <Rect width={w} height={h * 0.18} fill="#ffffff" opacity={0.12} />
    </>
  );
}

function Carro({ w, h }) {
  const rueda = Math.max(3, Math.min(w, h) * 0.14);
  return (
    <>
      <Rect x={w * 0.05} y={h * 0.1} width={w * 0.8} height={h * 0.72} fill="#475569" stroke="#cbd5e1" strokeWidth={1.5} cornerRadius={3} />
      {[0.25, 0.45, 0.65].map((f) => (
        <Line key={f} points={[w * 0.05, h * (0.1 + f * 0.72), w * 0.85, h * (0.1 + f * 0.72)]} stroke="#94a3b8" strokeWidth={1} />
      ))}
      <Line points={[w * 0.85, h * 0.2, w * 0.98, h * 0.05]} stroke="#cbd5e1" strokeWidth={3} lineCap="round" />
      <Circle x={w * 0.2} y={h * 0.9} radius={rueda} fill="#0f172a" />
      <Circle x={w * 0.7} y={h * 0.9} radius={rueda} fill="#0f172a" />
    </>
  );
}

function Estante({ w, h }) {
  const colores = ['#22c55e', '#3b82f6', '#ef4444', '#eab308', '#a855f7', '#14b8a6'];
  const n = Math.max(4, Math.round(w / 14));
  return (
    <>
      <Rect width={w} height={h} fill="#57534e" stroke="#a8a29e" strokeWidth={1} cornerRadius={2} />
      {Array.from({ length: n }, (_, i) => (
        <Rect key={i} x={3 + ((w - 6) / n) * i} y={2} width={(w - 6) / n - 2} height={h - 4} fill={colores[i % colores.length]} opacity={0.75} cornerRadius={1} />
      ))}
    </>
  );
}

function Producto({ w, h, a }) {
  const d = a.defecto;
  return (
    <>
      {/* cara superior aclarada: da sensación de volumen */}
      <Rect width={w} height={h} fill="#0d9488" stroke="#134e4a" strokeWidth={1} cornerRadius={3} />
      <Rect width={w} height={h * 0.2} fill="#5eead4" opacity={0.35} cornerRadius={[3, 3, 0, 0]} />
      {a.etiqueta && <Rect x={w * 0.15} y={h * 0.3} width={w * 0.7} height={h * 0.16} fill="#ffffff" cornerRadius={1} />}
      {a.etiqueta && <Rect x={w * 0.2} y={h * 0.35} width={w * 0.45} height={h * 0.03} fill="#94a3b8" />}
      {a.piezaFaltante && <Rect x={w * 0.68} y={h * 0.68} width={w * 0.32} height={h * 0.32} fill="#0b1220" />}
      {d && <Rect x={d.x * w} y={d.y * h} width={d.w * w} height={d.h * h} fill="#ef4444" shadowColor="#ef4444" shadowBlur={4} />}
    </>
  );
}

function Generica({ w, h, color }) {
  return <Rect width={w} height={h} fill={color ?? '#64748b'} stroke="#1e293b" strokeWidth={1} cornerRadius={2} />;
}

const DIBUJOS = {
  persona: Persona,
  montacargas: Montacargas,
  pallet: Pallet,
  caja: Caja,
  carro: Carro,
  estante: Estante,
  producto: Producto,
};
