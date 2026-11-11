# VISION AI · Prototipo

Aplicación web que **simula** cómo un sistema de visión artificial entiende un entorno: dibuja escenas con figuras a partir de un guion, las divide en regiones, calcula ocupación, obstrucciones y cambios, y genera alertas con reglas configurables.

Es un **prototipo académico**. Funciona solo en el navegador. No usa imágenes ni videos, no tiene servidor y no tiene inteligencia artificial real. El rótulo **PROTOTIPO** siempre está visible.

**Aplicación publicada:** https://vision-ai-bice-delta.vercel.app

**Documentos de entrega:**

- [Guion de presentación](docs/GUION_PRESENTACION.md)
- [Resultado de las pruebas PF-01 a PF-10](docs/PRUEBAS.md)

## Decisiones del proyecto

Las decisiones DT-1 a DT-6 están en el documento del proyecto (sección 14):

- **DT-1:** prototipo académico.
- **DT-2:** sin imágenes ni videos.
- **DT-3:** todo en el navegador.
- **DT-4:** el almacén es el caso principal.
- **DT-5:** Konva y seedrandom.
- **DT-6:** análisis con la geometría de las figuras, sin OpenCV ni YOLO.

Se agrega:

| # | Decisión | Motivo |
| --- | --- | --- |
| DT-7 | **Cámara simulada en lugar de cámara real.** El docente dio dos opciones: simular una cámara dentro del sistema, que analice los casos propuestos como animación, o usar una cámara real que analice lo que ocurre en la vida real en casos específicos. Se eligió la **cámara simulada** | Permite proponer libremente los casos de uso. Con una cámara real, salvo en un escenario ideal, los casos serían mayormente cotidianos: situaciones como un montacargas cerca de una persona en zona restringida, una salida de emergencia bloqueada o una fila de siete personas en caja ocurren pocas veces y no se pueden provocar a voluntad. La simulación además repite cada caso exactamente igual en las pruebas y en la presentación |

En el sistema, la "cámara simulada" es el motor de escenas. Genera 12 cuadros por segundo de cada caso a partir de su guion, y cada cuadro pasa por el análisis y el motor de reglas, como lo haría la imagen de una cámara.

## Cómo funciona, en una línea por paso

Cada cuadro de la escena (12 por segundo) recorre el mismo camino:

```text
guion (JSON) → motor de escenas → análisis → motor de reglas → alertas guardadas → dashboard, historial, CSV
 qué pasa y     dónde está cada    ocupación,   ¿la situación     IndexedDB           indicadores
 cuándo         figura (semilla)   cambios      duró lo bastante?
```

| Paso | Archivo principal | Fase |
| --- | --- | --- |
| Guion | `src/simulation/guiones/cu-0X.json` | 2 |
| Motor de escenas | `src/simulation/motor.js` y `reloj.js` | 3 |
| Dibujo | `src/components/VisorEscena.jsx` (Konva) | 3 y 5 |
| Análisis | `src/analysis/analizar.js` | 4 |
| Reglas | `src/rules/motorReglas.js` y `reglas.json` | 6 |
| Datos | `src/data/repositorio.js` (Dexie) | 6 y 7 |
| Indicadores y CSV | `src/data/indicadores.js` y `csv.js` | 7 |

## Cómo ejecutarlo

Requisitos: Node.js 20 o superior y Git.

```bash
npm install      # instala las dependencias
npm run dev      # abre la aplicación en http://localhost:5173
npm run test     # ejecuta las pruebas automáticas
npm run build    # genera la versión para publicar (carpeta dist/)
```

## Cómo se usa

1. Al abrir la aplicación se elige un **rol de ejemplo**. No hay contraseñas, porque el inicio de sesión es simulado.
2. El menú lateral muestra solo las pantallas que ese rol puede abrir.
3. Con **Cambiar rol** se vuelve a la pantalla de ingreso.

| Función | Administrador | Supervisor | Operador | Auditor |
| --- | --- | --- | --- | --- |
| Ejecutar casos de uso | Sí | Sí | Sí | No |
| Ver dashboard e historial | Sí | Sí | Sí | Solo lectura |
| Revisar alertas | Sí | Sí | Sí | No |
| Cerrar alertas | Sí | Sí | No | No |
| Exportar CSV | Sí | Sí | Solo los propios | Sí |
| Configurar reglas | Sí | No | No | No |
| Ver la bandeja simulada | Sí | No | No | No |

## Cómo está organizado el código

```text
src/
  app/          marco de la aplicación: menú, cabecera y rutas protegidas
  auth/         roles, permisos e inicio de sesión simulado
  pages/        pantallas (ingreso, análisis, alertas, historial...)
  components/   piezas reutilizables
  simulation/   motor de escenas y guiones (fase 3)
  analysis/     regiones, ocupación, obstrucciones y cambios (fase 4)
  rules/        reglas de negocio y alertas (fase 6)
  training/     datos del entrenamiento ilustrativo (fase 5)
  data/         guardar y leer en el navegador (Dexie): sesiones, alertas, reglas
  tests/        pruebas automáticas
```

Regla de capas: las **pantallas** no calculan, la **lógica** no dibuja y los **datos** solo guardan y leen.

### Cómo funcionan los permisos

- `src/auth/roles.js` define la matriz de permisos y la función `puede(rol, permiso)`.
- `src/app/menu.js` asigna a cada pantalla el permiso que exige. El menú oculta lo que el rol no puede abrir.
- `src/app/RutaProtegida.jsx` vuelve a comprobar el permiso. Si alguien escribe la dirección a mano, ve **Acceso denegado** (prueba PF-01).

## Guiones de escena (`src/simulation/guiones/`)

Cada caso de uso tiene un archivo JSON que describe toda la escena. Para cambiar una escena se edita el archivo; no hace falta tocar el código.

- **Coordenadas:** todas van entre 0 y 1. Por ejemplo, `x: 0.5` es la mitad del ancho de la escena.
- **Regiones:** son rectángulos fijos, cuyo `x, y` es la esquina superior izquierda. La clase define su significado y su color, según [`clases.json`](src/simulation/clases.json).
- **Figuras (`objetos`):** cada una tiene una clase, un tamaño (`w`, `h`) y una **ruta**, que es la lista de puntos `{ t, x, y }` por donde pasa su **centro**.
  - Entre dos puntos, la figura se mueve en línea recta.
  - Aparece en el primer punto y se queda en el último, salvo que tenga `sale`, el segundo en que desaparece.
- **Atributos y cambios:** por ejemplo `casco: false`, o el defecto de un producto. Con `cambios` se modifican en un segundo dado, por ejemplo cuando el trabajador se pone el casco a los 14 s.
- **`eventos`:** son los subtítulos del modo presentación y las marcas de la línea de tiempo.
- **`esperado`:** son las alertas que el guion debe producir. La fase 6 las usará para probar el motor de reglas.

```json
{ "id": "persona-1", "clase": "persona", "w": 0.04, "h": 0.06,
  "ruta": [{ "t": 19, "x": 0.55, "y": 0.87 }, { "t": 20, "x": 0.8, "y": 0.81 }],
  "sale": 26 }
```

Funciones que leen el guion ([`trayectoria.js`](src/simulation/trayectoria.js)):

- `posicionEn(objeto, t)` da dónde está la figura en el segundo `t`.
- `atributosEn(elemento, t)` da sus atributos en ese momento.
- `escenaEn(guion, t)` da la escena completa en ese instante.

## Motor de escenas (fase 3)

Para ver una escena: **Análisis visual** → elegir un caso → **Iniciar**.

- **Reloj** ([`reloj.js`](src/simulation/reloj.js)): lleva su propio tiempo, independiente de la hora real.
  - Se puede pausar, reiniciar, avanzar paso a paso (un cuadro) y cambiar la velocidad entre 0,5×, 1×, 2× y 4×.
  - Analiza 12 cuadros por segundo.
  - Una sesión completada no se reanuda.
- **Motor** ([`motor.js`](src/simulation/motor.js)):
  - `generarCuadro(guion, indice, semilla)` entrega el cuadro número `indice`. Es lo que recibirá el análisis de la fase 4.
  - La **semilla**, con seedrandom, agrega un pequeño temblor de hasta 0,002 a las personas y a las figuras en movimiento.
  - La misma semilla produce siempre la misma escena, y saltar a un cuadro da lo mismo que reproducir hasta él.
- **Visor** ([`VisorEscena.jsx`](src/components/VisorEscena.jsx)): dibuja con Konva en dos capas, una de regiones y otra de figuras.
  - Convierte las coordenadas 0..1 en píxeles según el ancho disponible, así se adapta al tamaño de la ventana.
  - En las personas se ve si llevan casco (amarillo) y chaleco (naranja). Una figura "poco visible" se dibuja translúcida.
  - En los productos se ven la etiqueta y el defecto (rojo).
- **Línea de tiempo**: los puntos marcan los eventos del guion, y al pulsarlos se salta a ese segundo.
- **Modo presentación**: muestra el subtítulo del último evento.

## Análisis simulado (fase 4)

[`analizar.js`](src/analysis/analizar.js) recibe un cuadro del motor y calcula qué pasa en la escena. No mira píxeles: usa la posición y el tamaño de las figuras.

| Resultado | Cómo se calcula |
| --- | --- |
| `mediciones[].ocupacion` | Parte de la región cubierta por cualquier figura: área superpuesta ÷ área de la región, máximo 1 |
| `mediciones[].obstruccion` | Lo mismo, pero solo con objetos. Las personas ocupan una región, pero no la obstruyen |
| `mediciones[].personas` | Personas cuyo centro está dentro de la región |
| `mediciones[].libre` | Ocupación menor al 1 % |
| `cambios[]` | Diferencia de ocupación de cada región respecto del cuadro 0. Las diferencias menores a 0,5 puntos se ignoran como ruido |
| `objetos[]` | Para cada figura: en qué regiones está, si se mueve y sus atributos. En los productos se agrega `proporcionDefecto`, el área defectuosa ÷ el área del producto |

- `crearAnalizador(guion, semilla)` toma el cuadro 0 como referencia y devuelve la función que analiza los demás cuadros.
- El análisis corre a frecuencia fija, una vez por cuadro (12 por segundo), aunque el dibujo sea más fluido.
- El análisis **no decide alertas**. Entrega los datos y el motor de reglas (fase 6) decide. Por eso `alertas` llega vacío.

En la pantalla **Análisis visual**, el panel lateral muestra para cada región:

- la ocupación,
- la parte cubierta por objetos y las personas que hay,
- el cambio respecto del inicio.

En el caso de calidad, también muestra el producto que está en inspección con su porcentaje de defecto.

## Visor con capas y entrenamiento (fase 5)

### Capas del visor

En **Análisis visual** se activan o apagan capas sobre la escena. La leyenda bajo el visor explica las que están activas.

| Capa | Qué muestra |
| --- | --- |
| Regiones | Mapa de regiones por colores. El color de cada clase está en `clases.json` |
| Ocupación | Cada región de verde (vacía) a rojo (llena), con el porcentaje escrito |
| Mapa de calor | Intensidad según las personas que hay en cada región, con el número escrito |
| Cambios | Borde punteado en las regiones cuya ocupación cambió respecto del inicio (comparación entre dos momentos) |
| Figuras | La escena animada |

Bajo la escena se muestran los **cuadros por segundo** dibujados, para comprobar la fluidez. El mínimo pedido es 10, y en un equipo normal se dibujan unos 60.

### Entrenamiento (ilustrativo)

La pantalla **Entrenamiento** muestra en seis etapas cómo se prepararía un modelo para el caso elegido. Siempre lleva el rótulo "no es un entrenamiento real".

1. **Ejemplos etiquetados:** cuatro momentos del guion, con la caja y la clase de cada figura.
2. **Preparación de datos:** la misma muestra original, redimensionada, normalizada y aumentada (volteada).
3. **Entrenamiento:** curvas de error y precisión que avanzan época a época, con barra de progreso.
4. **Validación:** cajas reales (verde) frente a predichas (rojo), con el **IoU** de cada figura. El IoU se calcula de verdad con geometría.
5. **Ajuste del umbral:** un deslizador cambia el umbral y la **matriz de confusión**, la precisión y el recall se recalculan.
6. **Modelo de prototipo listo:** insignia final.

Los datos salen de [`entrenamiento.js`](src/training/entrenamiento.js), con fórmulas fijas y semilla, así que son siempre iguales. Con "Reproducir todo" las etapas avanzan solas. Si el sistema pide menos movimiento, las curvas aparecen completas sin animación.

## Reglas, alertas y sesiones (fase 6)

### Motor de reglas ([`motorReglas.js`](src/rules/motorReglas.js))

En cada cuadro recibe el resultado del análisis y decide qué ocurre:

- **Alerta:** la condición se mantuvo la duración mínima de la regla (RN-G1).
- **Una sola alerta por situación (RN-G2):** si la situación termina, se registra un **cierre**. Si vuelve a ocurrir, se crea otra alerta.
- **Reemplazo:** si se cumple RN-02.2 (persona con montacargas cerca), no se crea también RN-02.1.
- **Advertencias e informativas:** por ejemplo "poco visible", la afluencia o la clasificación de un producto. Se registran, pero no son alertas.

Como la simulación es determinista, `procesarSesion` calcula una vez todos los eventos de los 60 s, y la pantalla muestra los que ya ocurrieron. Por eso saltar en la línea de tiempo da siempre lo mismo.

Momentos obtenidos con la semilla 2026, que coinciden con el guion:

| Caso | Alerta | Segundo |
| --- | --- | --- |
| CU-02 | RN-02.2 persona en zona restringida con montacargas | 23,0 |
| CU-02 | RN-02.3 tránsito obstruido | 35,0 |
| CU-04 | RN-04.1 congestión en caja 1 | 34,3 |
| CU-01 | RN-01.1 sin casco | 9,9 |
| CU-01 | RN-01.2 salida bloqueada | 44,7 |
| CU-03 | RN-03.1 defecto del 3 % | 8,7 |
| CU-03 | RN-03.3 sin etiqueta | 32,7 |

### Sesiones

En **Análisis visual**, pulsar **Iniciar** crea la sesión y la guarda en el navegador (IndexedDB, con Dexie).

- **Una sola sesión:** pulsar dos veces no crea dos.
- **Qué guarda (RI-05):** caso, semilla, velocidad, versión del guion y versión de cada regla usada.
- **Mientras avanza:** las alertas y los eventos se guardan al ocurrir. En el visor, cada alerta activa aparece con un marco rojo y su código.
- **Al llegar a 60 s:** la sesión queda **completada**, con un resumen.
- **Reiniciar, cambiar de caso o de semilla, o salir de la pantalla:** la sesión queda **cancelada**.
- **Sesión terminada:** no se reabre ni recibe resultados (RI-03).
- **Sin pulsar Iniciar:** la escena funciona como vista previa y no guarda nada.

### Pantalla Alertas

- **Filtros:** por estado, caso y severidad.
- **Ver evidencia:** reconstruye el cuadro exacto de la alerta (misma semilla y mismo cuadro) y marca en rojo la figura o región implicada.
- **Ciclo (RN-G3 y RI-04):** nueva → **revisada** (operador, supervisor o administrador) → **cerrada** (solo supervisor o administrador, con observación obligatoria). No se puede saltar ni retroceder.
- **Auditor:** ve todo en modo solo lectura.

### Pantalla Reglas (solo administrador)

- **Qué se edita:** umbral (en %, si es una proporción), radio, duración, severidad y si la regla está activa.
- **Guardar** crea una **versión nueva**. La anterior se conserva, las sesiones nuevas usan la vigente y las ya hechas mantienen la suya (RN-G4 y PF-08).
- **Valores imposibles**, por ejemplo un umbral de 150 %, se rechazan con un mensaje.

### Archivos de datos

| Archivo | Qué hace |
| --- | --- |
| [`db.js`](src/data/db.js) | Tablas `sesiones`, `alertas`, `eventos` y `reglas` |
| [`repositorio.js`](src/data/repositorio.js) | Guardar y leer, aplicando las reglas de integridad RI-01, RI-03, RI-04 y RI-05 |
| [`estadosSesion.js`](src/data/estadosSesion.js) | Los 7 estados de una sesión y qué cambios se permiten |
| [`alertas.js`](src/rules/alertas.js) | Qué cambio de estado de alerta se permite y a quién |

## Dashboard, historial, reportes y bandeja (fase 7)

### Inicio (dashboard)

Todos los indicadores se calculan desde las sesiones y alertas guardadas, en [`indicadores.js`](src/data/indicadores.js). No hay números fijos.

| Indicador | Cómo se calcula |
| --- | --- |
| Sesiones completadas | Sesiones en estado "completada" (y cuántas se cancelaron) |
| Alertas pendientes | Alertas nuevas + revisadas |
| Alertas cerradas | Alertas en estado "cerrada", sobre el total |
| Afluencia en tienda | Personas que cruzaron la entrada (RN-04.2) en sesiones completadas de CU-04 |
| Conformidad en calidad | (productos − no conformes) ÷ productos, en sesiones completadas de CU-03 |
| Alertas por caso | Gráfico de barras: total y pendientes de cada caso |
| Por severidad | Alertas altas, medias, etc. |

Si no hay sesiones (primera vez o historial borrado), **Cargar sesiones de ejemplo** crea una sesión completada de cada caso. Usa la misma simulación y quedan marcadas como "ejemplo".

### Historial y reportes CSV

- **Filtros:** caso, estado y "solo mis sesiones". El detalle de cada sesión muestra sus estados, las versiones de reglas, el resumen y sus alertas.
- **Los tres reportes:**

| Reporte | Contenido |
| --- | --- |
| Resumen de una sesión | Las alertas de esa sesión |
| Historial filtrado | Una fila por sesión |
| Reporte de alertas | Las alertas de las sesiones filtradas |

- **Formato del CSV:** separador `;` para que Excel en español lo abra en columnas. La primera línea indica PROTOTIPO, quién lo generó, cuándo y con qué filtros, y cada fila termina en `PROTOTIPO`.
- **Permisos:** el operador exporta solo sus propias sesiones. El auditor y el supervisor exportan todo.

### Bandeja simulada (solo administrador)

- **Cuándo se crea un correo:** por cada alerta **alta** y al completar cada sesión. La bandeja muestra el correo que recibiría el administrador.
- **Nada se envía:** cada correo dice "no enviado (simulado)".
- **Destinatario:** queda pendiente (decisión D1 del documento).

## Reglas (`src/rules/reglas.json`)

Cada regla tiene:

- **`condicion`:** qué se mide. Los tipos son `presencia`, `presenciaCerca`, `ocupacion`, `cambioOcupacion`, `conteo`, `cruce`, `atributo`, `defecto` y `faltante`.
- **`duracion`:** cuántos segundos debe mantenerse la condición (RN-G1).
- **`severidad`** y **`accion`:** la acción puede ser `alerta`, `advertencia` o `informativa`.
- **`version`:** número de versión de la regla.

RN-02.2 lleva `reemplaza: "RN-02.1"`: si se cumple la versión grave, no se crea también la leve.

[`validar.js`](src/simulation/validar.js) revisa que guiones y reglas estén completos. Comprueba los ids únicos, que los valores estén entre 0 y 1 (RI-02), las clases existentes y los tiempos dentro de la duración. Las pruebas de `src/tests/guiones.test.js` verifican, con geometría, que cada guion produce la situación del documento en el segundo indicado.

### Valores iniciales decididos en la fase 2 (ajustables)

- **D2:** las clases y colores de regiones y figuras están en `clases.json`.
- **"Cerca" del montacargas (RN-02.2):** a menos de 0,2 de distancia entre centros, con el montacargas en movimiento.
- **Salida bloqueada (RN-01.2):** obstruida por objetos en más del 50 %.
- **Tránsito obstruido (RN-02.3) y salida bloqueada (RN-01.2):** se miden con la obstrucción, sin contar personas. Este cambio se hizo en la fase 4.
- **Congestión (RN-04.1):** se mide en pasillos y cajas, no en el suelo general.
- **RN-01.1:** tiene dos variantes, casco (alta) y chaleco (media). Comparten el código RN-01.1.

## Publicar (fase 8)

La aplicación es un sitio estático, así que se publica gratis.

**Decisión D4: se publica en Vercel**, en https://vision-ai-bice-delta.vercel.app. Cada `git push` a `main` vuelve a publicar el sitio solo.

La aplicación solo necesita ese alojamiento: no hay servidor, base de datos externa, variables de entorno ni claves. Cada navegador guarda sus propios datos. Se conserva también la configuración de Netlify por si se quisiera cambiar.

- **Vercel:**
  1. En vercel.com, entrar con GitHub y pulsar **Add New → Project**.
  2. Elegir el repositorio **VISION-AI** y pulsar **Deploy**. [`vercel.json`](vercel.json) ya indica el comando `npm run build`, la carpeta `dist` y que todas las rutas abran la aplicación.
- **Netlify:**
  1. En netlify.com, ir a **Add new site → Import an existing project** y elegir el repositorio.
  2. [`netlify.toml`](netlify.toml) ya trae la misma configuración.

Cada vez que se sube un cambio a `main`, el sitio se vuelve a publicar solo. Antes de presentar, conviene abrir la dirección publicada y probar los cuatro casos y una exportación CSV.

Si una pantalla falla, la aplicación muestra un mensaje con **Reintentar** en lugar de una página en blanco.

## Lista de entrega (Proyecto, sección 13)

- [x] Las pruebas PF-01 a PF-10 pasan y las pruebas automáticas están en verde (126). Ver [docs/PRUEBAS.md](docs/PRUEBAS.md).
- [x] El rótulo PROTOTIPO se ve siempre y no se usa ninguna imagen ni video.
- [x] El documento (este README) está actualizado y hay un [guion de presentación](docs/GUION_PRESENTACION.md).
- [x] Publicada en Vercel (D4): https://vision-ai-bice-delta.vercel.app. Se comprobó que carga sin pedir login, que abrir una ruta directa (`/analisis`) no da 404, que el almacén genera sus alertas a los 23 s y a los 35 s, que el historial guarda la sesión y que no hay errores.
- [x] Funciona en Chrome, Edge y Firefox. Firefox se probó sobre la versión publicada; Chrome y Edge usan el mismo motor que el navegador de las pruebas.
- [x] Código en GitHub con la rama `main` funcionando.
- [ ] Ensayar el guion de presentación.
- [ ] Decidir el nombre, el logotipo y los colores finales (D5). Los actuales son provisionales.

## Avance por fases

| Fase | Contenido | Estado |
| --- | --- | --- |
| 1. Base | React + Vite, menú, rutas y roles de ejemplo | Hecha |
| 2. Datos y reglas | Guiones de los cuatro casos y reglas en archivos de datos | Hecha |
| 3. Motor de escenas | Escena dibujada con Konva, con reloj y semilla | Hecha |
| 4. Análisis simulado | Regiones, ocupación, obstrucciones y cambios | Hecha |
| 5. Visor | Mapas, capas, controles y animación de entrenamiento | Hecha |
| 6. Reglas y alertas | Motor de reglas y ciclo de alertas | Hecha |
| 7. Historial y reportes | Dashboard, historial, CSV y bandeja simulada | Hecha |
| 8. Pruebas y presentación | Pruebas, publicación y guion de presentación | Hecha |
