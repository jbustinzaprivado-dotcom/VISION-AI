// Escena 3D (DT-10): mantiene en Three.js el mismo cuadro que dibuja la vista 2D.
// - Las regiones se construyen una vez por guion.
// - Las figuras se crean, mueven y rotan según el cuadro; si cambia su aspecto
//   (se puso el casco, aparece un defecto...) se reconstruye su modelo.
// - Las alertas activas se marcan con una caja roja y su código.
// Solo dibuja cuando algo cambia (no hay bucle continuo): ahorra batería y CPU.
// Sin contenedor funciona "sin pantalla" (lo usan las pruebas en Node).
import * as THREE from 'three';
import { MUNDO, marcados, rumbo, ubicar } from './mapeo.js';
import { crearFigura, crearRegion, firma, material, rotulo } from './modelos.js';

export const VISTAS = {
  camara: { posicion: [0, 10.5, 7.6], objetivo: [0, 0, 0.5] },
  cenital: { posicion: [0, 15, 0.01], objetivo: [0, 0, 0] },
  lateral: { posicion: [-12, 5, 6], objetivo: [0, 0.5, 0] },
};

export class Escena3D {
  constructor(contenedor = null, { Controles = null } = {}) {
    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color('#0b1220');
    this.escena.fog = new THREE.Fog('#0b1220', 22, 40);
    this.camara = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
    this.figuras = new Map(); // id → { grupo, anterior, angulo }
    this.marcas = new Map(); // id → marca de alerta
    this.regiones = new THREE.Group();
    this.guion = null;
    this.escena.add(this.regiones, this.#piso(), ...this.#luces());

    if (contenedor) {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      contenedor.appendChild(this.renderer.domElement);
      if (Controles) {
        this.controles = new Controles(this.camara, this.renderer.domElement);
        Object.assign(this.controles, { enableDamping: false, maxPolarAngle: Math.PI / 2.05, minDistance: 3, maxDistance: 30 });
        this.controles.addEventListener('change', () => this.dibujar());
      }
    }
    this.vista('camara');
  }

  #piso() {
    const g = new THREE.Group();
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(MUNDO.ancho + 2, MUNDO.fondo + 2), material('#1b2332', { rugosidad: 0.95 }));
    piso.rotation.x = -Math.PI / 2;
    piso.receiveShadow = true;
    g.add(piso);
    const grilla = new THREE.GridHelper(MUNDO.ancho + 2, 18, '#334155', '#243044');
    grilla.scale.z = (MUNDO.fondo + 2) / (MUNDO.ancho + 2);
    grilla.position.y = 0.002;
    g.add(grilla);
    // Paredes del fondo y del lado izquierdo: dan profundidad sin tapar la vista.
    const pared = material('#1e293b', { rugosidad: 1 });
    const fondo = new THREE.Mesh(new THREE.BoxGeometry(MUNDO.ancho + 2, 3, 0.2), pared);
    fondo.position.set(0, 1.5, -MUNDO.fondo / 2 - 1.1);
    fondo.receiveShadow = true;
    const lado = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, MUNDO.fondo + 2.2), pared);
    lado.position.set(-MUNDO.ancho / 2 - 1.1, 1.5, 0);
    lado.receiveShadow = true;
    g.add(fondo, lado);
    return g;
  }

  #luces() {
    const cielo = new THREE.HemisphereLight('#dbeafe', '#1e293b', 1.1);
    const sol = new THREE.DirectionalLight('#ffffff', 1.6);
    sol.position.set(6, 14, 8);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -11, right: 11, top: 8, bottom: -8, near: 1, far: 40 });
    sol.shadow.bias = -0.0005;
    return [cielo, sol, new THREE.AmbientLight('#ffffff', 0.25)];
  }

  vista(nombre) {
    const v = VISTAS[nombre] ?? VISTAS.camara;
    this.camara.position.set(...v.posicion);
    this.camara.lookAt(...v.objetivo);
    if (this.controles) {
      this.controles.target.set(...v.objetivo);
      this.controles.update();
    }
    this.dibujar();
  }

  // Sincroniza la escena con un cuadro: { guion, escena (regiones y objetos en t), alertas }.
  sincronizar({ guion, escena, alertas = [] }) {
    if (guion !== this.guion) this.#construirRegiones(guion);
    this.#actualizarRegiones(escena.regiones, escena.t);
    this.#actualizarFiguras(escena);
    this.#actualizarAlertas(alertas, escena);
    this.dibujar();
  }

  #construirRegiones(guion) {
    this.guion = guion;
    for (const hijo of [...this.regiones.children]) this.regiones.remove(hijo);
    for (const r of guion.regiones) if (r.clase !== 'suelo') this.regiones.add(crearRegion(r));
    // Cambió la escena: las figuras de la anterior se descartan.
    for (const { grupo } of this.figuras.values()) this.escena.remove(grupo);
    this.figuras.clear();
  }

  // Lo que cambia en el tiempo: una caja que abre o cierra, los rodillos de la cinta.
  #actualizarRegiones(regiones, t) {
    for (const g of this.regiones.children) {
      const r = regiones.find((x) => x.id === g.userData.id);
      if (!r) continue;
      const cerrada = r.atributos?.abierta === false;
      const mostrador = g.getObjectByName('mostrador');
      if (mostrador) mostrador.material = material(cerrada ? '#3f3f46' : '#7c3aed');
      const rodillos = g.getObjectByName('rodillos');
      if (rodillos) rodillos.position.x = (t * (r.atributos?.velocidad ?? 0.1) * MUNDO.ancho) % rodillos.userData.paso;
      g.getObjectByName('piso').material = material(g.userData.color, { opacidad: cerrada ? 0.08 : 0.22 });
    }
  }

  #actualizarFiguras(escena) {
    const vistos = new Set();
    for (const f of escena.objetos) {
      vistos.add(f.id);
      const u = ubicar(f, escena.regiones);
      let e = this.figuras.get(f.id);
      if (!e || e.grupo.userData.firma !== firma(f, u)) {
        if (e) this.escena.remove(e.grupo);
        e = { grupo: crearFigura(f, u), anterior: e?.anterior ?? null, angulo: e?.angulo ?? 0 };
        this.escena.add(e.grupo);
        this.figuras.set(f.id, e);
      }
      // Las figuras que se desplazan miran hacia donde van; las fijas no giran.
      if (f.clase === 'persona' || f.clase === 'montacargas' || f.clase === 'carro') {
        e.angulo = rumbo(e.anterior, f, e.angulo);
      }
      e.anterior = { x: f.x, y: f.y };
      e.grupo.position.set(u.x, u.base, u.z);
      e.grupo.rotation.y = e.angulo;
      const baliza = e.grupo.getObjectByName('baliza');
      if (baliza) {
        const encendida = f.enMovimiento && Math.floor(escena.t * 4) % 2 === 0;
        baliza.material = encendida ? material('#fb923c', { emisivo: '#fb923c' }) : material('#7c2d12');
      }
    }
    for (const [id, e] of this.figuras) {
      if (!vistos.has(id)) {
        this.escena.remove(e.grupo);
        this.figuras.delete(id);
      }
    }
  }

  // Caja roja alrededor de cada figura o región con alerta activa, con su código.
  #actualizarAlertas(alertas, escena) {
    const { figuras, regiones } = marcados(alertas);
    const vigentes = new Set();
    const pulso = (Math.sin(escena.t * Math.PI * 2) + 1) / 2;
    for (const a of alertas) {
      const clave = `${a.regla}|${a.objetivo}`;
      const caja = this.#cajaObjetivo(a, escena);
      if (!caja) continue;
      vigentes.add(clave);
      let m = this.marcas.get(clave);
      if (!m) {
        m = new THREE.Group();
        const linea = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#ef4444' }));
        linea.name = 'linea';
        const codigo = rotulo(a.codigo, '#ffffff', '#dc2626');
        codigo.name = 'codigo';
        m.add(linea, codigo);
        m.userData = { regla: a.regla, objetivo: a.objetivo };
        this.escena.add(m);
        this.marcas.set(clave, m);
      }
      const linea = m.getObjectByName('linea');
      linea.scale.set(caja.ancho, caja.alto, caja.fondo);
      linea.position.set(0, caja.alto / 2, 0);
      linea.material.opacity = 0.6 + pulso * 0.4;
      linea.material.transparent = true;
      m.getObjectByName('codigo').position.set(0, caja.alto + 0.3, 0);
      m.position.set(caja.x, caja.base, caja.z);
    }
    for (const [clave, m] of this.marcas) {
      if (!vigentes.has(clave)) {
        this.escena.remove(m);
        this.marcas.delete(clave);
      }
    }
    // El borde de las regiones en alerta también se pone rojo.
    for (const g of this.regiones.children) {
      g.getObjectByName('borde').material.color.set(regiones.has(g.userData.id) ? '#ef4444' : g.userData.color);
    }
    this.figurasEnAlerta = figuras;
  }

  #cajaObjetivo(a, escena) {
    if (a.tipoObjetivo === 'region') {
      const g = this.regiones.children.find((x) => x.userData.id === a.objetivo);
      const r = escena.regiones.find((x) => x.id === a.objetivo);
      if (!g || !r) return null;
      const piso = g.getObjectByName('piso').geometry.parameters;
      return { x: g.position.x, z: g.position.z, base: 0, ancho: piso.width + 0.1, fondo: piso.height + 0.1, alto: 0.6 };
    }
    const f = escena.objetos.find((x) => x.id === a.objetivo);
    if (!f) return null;
    const u = ubicar(f, escena.regiones);
    // La persona en 3D es más angosta que su caja 2D (dibujada de frente): marco propio.
    const [ancho, fondo] = f.clase === 'persona' ? [0.8, 0.8] : [u.ancho + 0.25, u.fondo + 0.25];
    return { x: u.x, z: u.z, base: u.base, ancho, fondo, alto: u.alto + 0.2 };
  }

  redimensionar(ancho, alto) {
    if (!this.renderer || ancho <= 0 || alto <= 0) return;
    this.renderer.setSize(ancho, alto, false);
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
    this.dibujar();
  }

  dibujar() {
    this.renderer?.render(this.escena, this.camara);
  }

  liberar() {
    this.controles?.dispose();
    this.escena.traverse((o) => {
      o.geometry?.dispose();
      if (o.material?.map) o.material.map.dispose();
    });
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
