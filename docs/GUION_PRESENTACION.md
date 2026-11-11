# Guion de presentación (unos 12 minutos)

**Antes de empezar**

- Abrir la aplicación publicada (o ejecutar `npm run dev`).
- Si se va a mostrar el dashboard con datos desde el inicio, entrar como **Operador** y pulsar **Cargar sesiones de ejemplo** en Inicio.

## 1. Qué es y qué no es (1 min)

- VISION AI **simula** cómo un sistema de visión artificial entiende un entorno: no solo cuenta objetos, sino que divide la escena en regiones, mide su ocupación, detecta obstrucciones y cambios, y genera alertas.
- **No usa imágenes, videos ni inteligencia artificial real.** La escena se dibuja con figuras a partir de un guion. Por eso todo lleva el rótulo **PROTOTIPO**.

## 2. Roles (1 min)

- En la pantalla de ingreso, explicar los cuatro roles de ejemplo. El inicio de sesión es simulado.
- Entrar como **Operador** y mostrar que el menú no tiene "Reglas".

## 3. Entrenamiento ilustrativo (2 min)

En **Entrenamiento**, caso Almacén, pulsar **Reproducir todo** e ir comentando cada etapa:

1. **Ejemplos etiquetados:** el modelo aprende de ejemplos con su caja y su clase.
2. **Preparación:** redimensionar, normalizar y aumentar los ejemplos.
3. **Entrenamiento:** el error baja y la precisión sube, época a época.
4. **Validación:** la caja real frente a la predicha. Explicar el **IoU**: 1 es solape perfecto.
5. **Umbral:** mover el deslizador. Más alto da menos falsas alarmas pero más casos sin detectar.
6. **Modelo listo.**

Aclarar que es ilustrativo y que el análisis real del prototipo usa geometría.

## 4. Caso principal: almacén (4 min)

En **Análisis visual**, caso CU-02, con **Modo presentación** activado:

1. Pulsar **Iniciar**. Explicar el mapa de regiones: pasillos, estanterías, zona de tránsito y zona restringida.
2. Activar la capa **Ocupación**. A los 12 s entra el montacargas y sube la ocupación del pasillo central (panel lateral).
3. A los **23 s** sale la alerta alta **RN-02.2**: una persona lleva 3 s en la zona restringida con el montacargas cerca. Mostrar el marco rojo y el panel de alertas.
   - Explicar el **reemplazo**: no se crea también la alerta leve RN-02.1.
4. Activar **Cambios**. A los 30 s el pallet ocupa la zona de tránsito (+38 % respecto del inicio), y a los **35 s** sale **RN-02.3**, obstrucción.
5. A los 50 s se retira el pallet y la zona vuelve a estar libre.
6. Usar **Pausar**, **Paso a paso** y la **línea de tiempo** para saltar a un evento.

## 5. Otro caso rápido (1 min)

Elegir uno:

- **Tienda (CU-04), saltar a los 35 s:** capa Mapa de calor. Se ven 7 personas en la caja 1 y la alerta de congestión con recomendación.
- **Seguridad (CU-01), saltar a los 10 s:** trabajador sin casco. A los 22 s, advertencia por figura poco visible, sin alerta.

## 6. Revisar y cerrar una alerta (2 min)

1. Como Operador, ir a **Alertas**, pulsar **Ver evidencia** (es el cuadro exacto, reconstruido con la semilla) y luego **Marcar como revisada**.
2. **Cambiar rol** a Supervisor e intentar cerrar sin observación: el sistema lo rechaza. Escribir la observación y cerrar.

## 7. Dashboard, historial y bandeja (1 min)

- **Inicio:** los indicadores salen de los datos guardados. La alerta cerrada ya cuenta como cerrada.
- **Historial:** detalle de una sesión y **Exportar** en CSV.
- Como **Administrador**:
  - **Reglas:** cambiar un umbral crea una versión nueva.
  - **Bandeja simulada:** el correo que recibiría el administrador, que nunca se envía.

## Preguntas frecuentes

| Pregunta | Respuesta |
| --- | --- |
| ¿Es inteligencia artificial? | No. El análisis calcula con la posición y el tamaño de las figuras que el propio programa dibujó. Enseña el flujo de un sistema de visión, no reconoce imágenes. |
| ¿Por qué siempre sale igual? | Por la **semilla**. Con otra semilla cambia el pequeño movimiento de las figuras, pero el guion sigue igual. |
| ¿Dónde se guardan los datos? | En el navegador (IndexedDB). Si se borra, se exporta antes en CSV o se cargan las sesiones de ejemplo. |
| ¿Y si se quisiera hacer real? | Habría que reemplazar el análisis por un modelo que trabaje con imágenes. Eso está fuera del alcance (decisiones DT-2 y DT-6). |
