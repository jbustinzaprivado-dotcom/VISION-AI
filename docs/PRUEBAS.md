# Pruebas de entrega (Proyecto, sección 13)

Resultado del 10 de noviembre de 2026, sobre la versión compilada (`npm run build` + `npx vite preview`).

## Matriz PF-01 a PF-10

| ID | Prueba | Cómo se comprobó | Resultado |
| --- | --- | --- | --- |
| PF-01 | El operador intenta abrir la pantalla de reglas | Automática (`permisos.test.js`) y en el navegador: el menú no muestra "Reglas" y `/reglas` muestra "Acceso denegado" | ✅ |
| PF-02 | Ejecutar CU-02 dos veces con la misma semilla | Automática (`motor.test.js`, `analisis.test.js`, `reglas.test.js`): los cuadros, el análisis y los eventos son idénticos en los 4 casos | ✅ |
| PF-03 | Cambiar el tamaño de la ventana durante la escena | En el navegador: escena CU-04 en t=35 a 1024 px y a 375 px (móvil). Las regiones, las figuras y el mapa de calor siguen alineados, sin desplazamiento horizontal | ✅ |
| PF-04 | Pausar, reanudar, cambiar velocidad y avanzar paso a paso | Automática (`motor.test.js`) y medida en el navegador: reanudar 5 ms, pausar 13 ms, velocidad 13 ms, paso a paso 14 ms | ✅ |
| PF-05 | Ejecutar los guiones de los cuatro casos | Automática (`reglas.test.js`): las alertas, advertencias y clasificaciones coinciden con las de la sección 11, sin duplicados. Además se probaron completas en el navegador | ✅ |
| PF-06 | Revisar como operador y cerrar como supervisor con observación | Automática (`datos.test.js`) y en el navegador | ✅ |
| PF-07 | Intentar cerrar como operador o sin observación | Automática (`datos.test.js`) y en el navegador: el sistema rechaza la acción con un mensaje | ✅ |
| PF-08 | Cambiar el umbral de una regla | Automática (`datos.test.js`, `reglas.test.js`) y en el navegador: se crea la versión 2, la versión 1 se conserva y las sesiones anteriores siguen con la suya | ✅ |
| PF-09 | Comparar el dashboard con las sesiones y exportar CSV | Automática (`reportes.test.js`): los indicadores son iguales a los datos guardados y el CSV tiene todas las columnas y la marca PROTOTIPO | ✅ |
| PF-10 | Revisar el rótulo PROTOTIPO, la bandeja simulada y el movimiento reducido | En el navegador: el rótulo aparece en la cabecera y en el visor, y la bandeja muestra "no enviado (simulado)". La hoja de estilos tiene la regla `prefers-reduced-motion` y el entrenamiento muestra las curvas sin animar | ✅ |

## Calidad mínima (Arquitectura, A9)

| Requisito | Resultado |
| --- | --- |
| Escena fluida (10 cuadros por segundo o más) | 72 cuadros/s dibujados con todas las capas; el análisis corre a 12 cuadros/s |
| La misma semilla produce la misma sesión | PF-02 ✅ |
| Funciona en Chrome, Edge y Firefox | ✅ Probado en un navegador Chromium, el mismo motor de Chrome y Edge, y en Firefox sobre la versión publicada (https://vision-ai-bice-delta.vercel.app) |
| Pruebas automáticas de reglas y cálculos | 126 pruebas en verde (`npm run test`) |
| Rótulo PROTOTIPO siempre visible | En la cabecera, el visor, el entrenamiento, los CSV y la bandeja |
| Carga en menos de 3 segundos | 98 ms en local. En internet depende de la conexión; el build va repartido en archivos para que se carguen en paralelo |

## Pruebas automáticas por archivo

| Archivo | Qué comprueba |
| --- | --- |
| `permisos.test.js` | Matriz de roles y permisos |
| `guiones.test.js` | Formato de guiones y reglas; cada guion produce su situación en el segundo indicado |
| `motor.test.js` | Reloj, velocidades, paso a paso, semilla y ruido |
| `analisis.test.js` | Ocupación, obstrucción, personas, zonas libres y cambios coinciden con el guion |
| `entrenamiento.test.js` | Curvas, IoU y matriz de confusión del entrenamiento ilustrativo |
| `reglas.test.js` | Cada alerta en su segundo, sin duplicados, con reemplazo y con umbrales cambiados |
| `datos.test.js` | Sesiones, alertas y reglas guardadas; reglas de integridad RI-01 a RI-05 |
| `reportes.test.js` | Indicadores, CSV y bandeja simulada |
