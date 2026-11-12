// Modelos 3D de baja poligonización, uno por clase de figura y de región (DT-10).
// Mismos colores que el dibujo 2D. Cada figura es un grupo apoyado en y = 0 y
// centrado en su posición; la escena solo la mueve, la rota y la marca si tiene alerta.
import * as THREE from 'three';
import clases from '../simulation/clases.json';
import { ALTO_CINTA, ALTO_ESTANTERIA, ALTURAS, ubicarRegion } from './mapeo.js';

const materiales = new Map();
export const PASO_RODILLOS = 0.6;
// Un material por color (y transparencia): se reutiliza entre figuras.
export function material(color, { opacidad = 1, emisivo = null, rugosidad = 0.75 } = {}) {
  const clave = `${color}|${opacidad}|${emisivo}|${rugosidad}`;
  if (!materiales.has(clave)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rugosidad, metalness: 0.05 });
    if (opacidad < 1) Object.assign(m, { transparent: true, opacity: opacidad, depthWrite: false });
    if (emisivo) Object.assign(m, { emissive: new THREE.Color(emisivo), emissiveIntensity: 0.9 });
    materiales.set(clave, m);
  }
  return materiales.get(clave);
}

function caja(ancho, alto, fondo, color, opciones) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), material(color, opciones));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function en(objeto, x, y, z) {
  objeto.position.set(x, y, z);
  return objeto;
}

// --- Figuras -----------------------------------------------------------------

function persona(_, a) {
  const g = new THREE.Group();
  const alto = ALTURAS.persona;
  const piernas = alto * 0.47;
  const torso = alto * 0.32;
  g.add(en(caja(0.12, piernas, 0.14, '#1e3a8a'), 0, piernas / 2, -0.08));
  g.add(en(caja(0.12, piernas, 0.14, '#1e3a8a'), 0, piernas / 2, 0.08));
  g.add(en(caja(0.26, torso, 0.42, a.chaleco ? '#f97316' : '#2563eb'), 0, piernas + torso / 2, 0));
  if (a.chaleco) {
    // franjas reflectantes
    for (const f of [0.35, 0.65]) g.add(en(caja(0.27, 0.035, 0.43, '#f8fafc', { emisivo: '#f8fafc' }), 0, piernas + torso * f, 0));
  }
  g.add(en(caja(0.1, torso * 0.9, 0.1, '#334155'), 0, piernas + torso * 0.5, -0.26));
  g.add(en(caja(0.1, torso * 0.9, 0.1, '#334155'), 0, piernas + torso * 0.5, 0.26));
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), material('#e7c3a1'));
  cabeza.castShadow = true;
  g.add(en(cabeza, 0, piernas + torso + 0.14, 0));
  if (a.casco) {
    const casco = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), material('#facc15'));
    casco.castShadow = true;
    g.add(en(casco, 0, piernas + torso + 0.16, 0));
    g.add(en(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 20), material('#eab308')), 0, piernas + torso + 0.16, 0));
  }
  return g;
}

function montacargas(t) {
  const g = new THREE.Group();
  const { ancho: L, fondo: W } = t;
  const cuerpo = L * 0.78;
  g.add(en(caja(cuerpo, 0.9, W * 0.9, '#f59e0b'), -L * 0.11, 0.6, 0));
  g.add(en(caja(cuerpo * 0.45, 0.25, W * 0.8, '#111827'), -L * 0.2, 1.2, 0)); // asiento y contrapeso
  // techo de protección con sus columnas
  for (const [dx, dz] of [[-0.35, -0.38], [-0.35, 0.38], [0.15, -0.38], [0.15, 0.38]]) g.add(en(caja(0.06, 1.2, 0.06, '#1f2937'), L * dx, 1.65, W * dz));
  g.add(en(caja(L * 0.6, 0.06, W * 0.85, '#1f2937'), -L * 0.1, 2.08, 0));
  // mástil y horquillas hacia adelante (+x)
  g.add(en(caja(0.1, 2.0, W * 0.7, '#374151'), L * 0.3, 1.0, 0));
  for (const dz of [-0.22, 0.22]) g.add(en(caja(L * 0.45, 0.06, 0.12, '#374151'), L * 0.52, 0.1, W * dz));
  for (const [dx, dz] of [[-0.35, -0.47], [-0.35, 0.47], [0.2, -0.47], [0.2, 0.47]]) {
    const rueda = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 16), material('#0f172a'));
    rueda.rotation.x = Math.PI / 2;
    g.add(en(rueda, L * dx, 0.22, W * dz));
  }
  // baliza: se enciende al moverse (la escena cambia su material)
  const baliza = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), material('#7c2d12'));
  baliza.name = 'baliza';
  g.add(en(baliza, -L * 0.1, 2.18, 0));
  return g;
}

function pallet(t) {
  const g = new THREE.Group();
  g.add(en(caja(t.ancho, 0.14, t.fondo, '#a16207'), 0, 0.07, 0));
  // carga apilada, un poco más chica que la tarima
  g.add(en(caja(t.ancho * 0.88, ALTURAS.pallet - 0.16, t.fondo * 0.88, '#b45309'), 0, 0.14 + (ALTURAS.pallet - 0.16) / 2, 0));
  g.add(en(caja(t.ancho * 0.89, 0.04, t.fondo * 0.2, '#fde68a', { opacidad: 0.8 }), 0, ALTURAS.pallet - 0.02, 0));
  return g;
}

function cajaCarton(t) {
  const g = new THREE.Group();
  const alto = ALTURAS.caja;
  g.add(en(caja(t.ancho, alto, t.fondo, '#c2843d'), 0, alto / 2, 0));
  g.add(en(caja(t.ancho * 0.18, alto + 0.005, t.fondo + 0.005, '#e8c38a'), 0, alto / 2, 0)); // cinta de embalar
  return g;
}

function carro(t) {
  const g = new THREE.Group();
  g.add(en(caja(t.ancho, 0.55, t.fondo * 0.8, '#475569', { opacidad: 0.85 }), 0, 0.6, 0));
  g.add(en(caja(0.04, 0.5, t.fondo * 0.8, '#cbd5e1'), t.ancho / 2, 1.0, 0)); // manija
  for (const [dx, dz] of [[-0.4, -0.35], [-0.4, 0.35], [0.4, -0.35], [0.4, 0.35]]) {
    const rueda = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), material('#0f172a'));
    rueda.rotation.x = Math.PI / 2;
    g.add(en(rueda, t.ancho * dx, 0.1, t.fondo * dz));
  }
  return g;
}

function estante(t) {
  const g = new THREE.Group();
  const alto = ALTURAS.estante;
  const colores = ['#22c55e', '#3b82f6', '#ef4444', '#eab308', '#a855f7', '#14b8a6'];
  g.add(en(caja(t.ancho, alto, t.fondo * 0.35, '#57534e'), 0, alto / 2, 0)); // fondo del mueble
  const n = Math.max(4, Math.round(t.ancho / 0.6));
  for (let nivel = 0; nivel < 3; nivel++) {
    const y = 0.15 + nivel * 0.5;
    g.add(en(caja(t.ancho, 0.04, t.fondo, '#a8a29e'), 0, y, 0));
    for (let i = 0; i < n; i++) {
      const x = -t.ancho / 2 + (t.ancho / n) * (i + 0.5);
      g.add(en(caja((t.ancho / n) * 0.8, 0.3, t.fondo * 0.8, colores[(i + nivel) % colores.length]), x, y + 0.17, 0));
    }
  }
  return g;
}

function producto(t, a) {
  const g = new THREE.Group();
  const alto = ALTURAS.producto;
  g.add(en(caja(t.ancho, alto, t.fondo, '#0d9488'), 0, alto / 2, 0));
  if (a.etiqueta) g.add(en(caja(t.ancho * 0.6, 0.01, t.fondo * 0.25, '#ffffff'), 0, alto + 0.005, -t.fondo * 0.1));
  if (a.piezaFaltante) g.add(en(caja(t.ancho * 0.32, 0.02, t.fondo * 0.32, '#0b1220'), t.ancho * 0.34, alto + 0.01, t.fondo * 0.34));
  const d = a.defecto;
  if (d) {
    g.add(
      en(caja(Math.max(0.04, d.w * t.ancho), 0.02, Math.max(0.04, d.h * t.fondo), '#ef4444', { emisivo: '#ef4444' }),
        (d.x + d.w / 2 - 0.5) * t.ancho, alto + 0.012, (d.y + d.h / 2 - 0.5) * t.fondo),
    );
  }
  return g;
}

function generica(t, _, color) {
  const g = new THREE.Group();
  g.add(en(caja(t.ancho, ALTURAS[t.clase] ?? 1, t.fondo, color ?? '#64748b'), 0, (ALTURAS[t.clase] ?? 1) / 2, 0));
  return g;
}

const FIGURAS = { persona, montacargas, pallet, caja: cajaCarton, carro, estante, producto };

// Firma de lo que cambia el aspecto: si cambia (se puso el casco, apareció un
// defecto...), la escena reconstruye el modelo de esa figura.
export function firma(f, t) {
  const a = f.atributos ?? {};
  return [f.clase, t.ancho.toFixed(2), t.fondo.toFixed(2), a.casco, a.chaleco, a.pocoVisible, a.etiqueta, a.piezaFaltante, JSON.stringify(a.defecto ?? null)].join('|');
}

export function crearFigura(f, t) {
  const a = f.atributos ?? {};
  const crear = FIGURAS[f.clase] ?? generica;
  const g = crear({ ...t, clase: f.clase }, a, clases.objetos[f.clase]?.color);
  if (a.pocoVisible) {
    // Poco visible (RN-01.3): translúcida, como en 2D.
    g.traverse((m) => {
      if (m.isMesh) {
        m.material = m.material.clone();
        Object.assign(m.material, { transparent: true, opacity: 0.3, depthWrite: false });
        m.castShadow = false;
      }
    });
  }
  g.userData = { id: f.id, clase: f.clase, firma: firma(f, t) };
  return g;
}

// --- Regiones ----------------------------------------------------------------

// Rótulo flotante con el nombre (textura dibujada en un lienzo 2D).
export function rotulo(texto, color = '#e2e8f0', fondo = 'rgba(2,6,23,0.7)') {
  if (typeof document === 'undefined') return new THREE.Group(); // en las pruebas (Node) no hay lienzo
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d');
  const fuente = 'bold 28px Inter, system-ui, sans-serif';
  ctx.font = fuente;
  lienzo.width = Math.ceil(ctx.measureText(texto).width) + 24;
  lienzo.height = 44;
  ctx.font = fuente;
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, 12, lienzo.height / 2);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, depthTest: false, transparent: true }));
  sprite.scale.set((lienzo.width / lienzo.height) * 0.32, 0.32, 1);
  sprite.renderOrder = 10;
  return sprite;
}

// Cada región: piso coloreado con su borde, y volumen si lo tiene (estanterías,
// cinta, mostrador de caja, puerta de salida). `cerrada` atenúa una caja cerrada.
export function crearRegion(r) {
  const u = ubicarRegion(r);
  const color = clases.regiones[r.clase]?.color ?? '#94a3b8';
  const g = new THREE.Group();
  g.position.set(u.x, 0, u.z);

  const piso = new THREE.Mesh(new THREE.PlaneGeometry(u.ancho, u.fondo), material(color, { opacidad: 0.22 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = 0.01;
  piso.receiveShadow = true;
  piso.name = 'piso';
  g.add(piso);
  const borde = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(u.ancho, 0.001, u.fondo)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
  );
  borde.position.y = 0.02;
  borde.name = 'borde';
  g.add(borde);

  switch (r.clase) {
    case 'estanteria': {
      // Racks con postes, tres niveles y cajas almacenadas.
      const modulos = Math.max(2, Math.round(u.ancho / 2.2));
      for (let i = 0; i <= modulos; i++) {
        const x = -u.ancho / 2 + (u.ancho / modulos) * i;
        for (const dz of [-0.45, 0.45]) g.add(en(caja(0.08, ALTO_ESTANTERIA, 0.08, '#1e40af'), x, ALTO_ESTANTERIA / 2, u.fondo * dz));
      }
      for (let nivel = 0; nivel < 3; nivel++) {
        const y = 0.15 + nivel * 0.72;
        g.add(en(caja(u.ancho, 0.06, u.fondo * 0.95, '#f97316'), 0, y, 0));
        for (let i = 0; i < modulos; i++) {
          if ((i + nivel) % 3 === 2) continue; // huecos: no todo está lleno
          const x = -u.ancho / 2 + (u.ancho / modulos) * (i + 0.5);
          g.add(en(caja((u.ancho / modulos) * 0.7, 0.45, u.fondo * 0.7, '#c2843d'), x, y + 0.26, 0));
        }
      }
      break;
    }
    case 'cinta': {
      g.add(en(caja(u.ancho, 0.12, u.fondo, '#64748b'), 0, ALTO_CINTA - 0.06, 0));
      g.add(en(caja(u.ancho, 0.02, u.fondo * 0.85, '#334155'), 0, ALTO_CINTA + 0.005, 0)); // banda
      // Rodillos: la escena los desplaza según la velocidad de la cinta (como en 2D).
      const rodillos = new THREE.Group();
      rodillos.name = 'rodillos';
      rodillos.userData.paso = PASO_RODILLOS;
      for (let x = -u.ancho / 2 + PASO_RODILLOS / 2; x < u.ancho / 2; x += PASO_RODILLOS) {
        rodillos.add(en(caja(0.06, 0.012, u.fondo * 0.85, '#94a3b8'), x, ALTO_CINTA + 0.022, 0));
      }
      g.add(rodillos);
      const patas = Math.max(2, Math.round(u.ancho / 2));
      for (let i = 0; i <= patas; i++) {
        const x = -u.ancho / 2 + (u.ancho / patas) * i;
        for (const dz of [-0.4, 0.4]) g.add(en(caja(0.06, ALTO_CINTA - 0.12, 0.06, '#64748b'), x, (ALTO_CINTA - 0.12) / 2, u.fondo * dz));
      }
      break;
    }
    case 'inspeccion': {
      // Arco de inspección con su cámara sobre la cinta.
      for (const dz of [-0.5, 0.5]) g.add(en(caja(0.08, 1.8, 0.08, '#fb923c'), 0, 0.9, u.fondo * dz));
      g.add(en(caja(0.12, 0.1, u.fondo + 0.08, '#fb923c'), 0, 1.8, 0));
      g.add(en(caja(0.2, 0.14, 0.2, '#0f172a'), 0, 1.68, 0));
      break;
    }
    case 'caja': {
      // Mostrador en el borde derecho de la zona, como en 2D (la fila queda a su izquierda).
      const mostrador = caja(u.ancho * 0.14, 0.95, u.fondo * 0.76, '#7c3aed');
      mostrador.name = 'mostrador';
      g.add(en(mostrador, u.ancho * 0.39, 0.475, 0));
      g.add(en(caja(0.3, 0.22, 0.35, '#1f2937'), u.ancho * 0.39, 1.06, 0)); // registradora
      break;
    }
    case 'salida-emergencia': {
      // Puerta verde iluminada en el borde de la planta.
      const ancho = Math.min(1, u.fondo * 0.6);
      g.add(en(caja(0.1, 2.05, ancho + 0.16, '#334155'), u.ancho / 2 - 0.05, 1.025, 0)); // marco
      g.add(en(caja(0.12, 1.95, ancho, '#16a34a', { emisivo: '#14532d' }), u.ancho / 2 - 0.06, 0.975, 0));
      g.add(en(caja(0.13, 0.08, ancho * 0.7, '#f8fafc', { emisivo: '#f8fafc' }), u.ancho / 2 - 0.07, 1.1, 0)); // barra antipánico
      break;
    }
    default:
      break;
  }

  if (r.clase !== 'suelo') {
    const nombre = rotulo(r.nombre.toUpperCase());
    const alto = { estanteria: ALTO_ESTANTERIA + 0.3, cinta: 2.1, inspeccion: 2.1, 'salida-emergencia': 2.35 }[r.clase] ?? 0.35;
    // La cinta cruza toda la escena: su nombre va a la izquierda, lejos del punto de inspección.
    nombre.position.set(r.clase === 'cinta' ? -u.ancho / 2 + 2 : 0, alto, r.clase === 'salida-emergencia' ? 0 : u.fondo / 2 - 0.25);
    nombre.name = 'rotulo';
    g.add(nombre);
  }
  g.userData = { id: r.id, clase: r.clase, color };
  return g;
}
