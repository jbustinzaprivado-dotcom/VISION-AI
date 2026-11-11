import { useEffect, useState } from 'react';

// Tema de color: 'sistema' (sigue al sistema operativo), 'claro' u 'oscuro'.
// Se recuerda en el navegador y se aplica con el atributo data-tema de <html>.
const CLAVE = 'vision-ai:tema';
const ORDEN = ['sistema', 'claro', 'oscuro'];

function leer() {
  try {
    const t = localStorage.getItem(CLAVE);
    return ORDEN.includes(t) ? t : 'sistema';
  } catch {
    return 'sistema';
  }
}

export function aplicarTema(tema) {
  const raiz = document.documentElement;
  if (tema === 'sistema') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', tema);
}

export function useTema() {
  const [tema, setTema] = useState(leer);

  useEffect(() => {
    aplicarTema(tema);
    try {
      localStorage.setItem(CLAVE, tema);
    } catch {
      // Sin almacenamiento: el tema dura hasta recargar.
    }
  }, [tema]);

  const siguiente = () => setTema((t) => ORDEN[(ORDEN.indexOf(t) + 1) % ORDEN.length]);
  return { tema, siguiente };
}

// Se aplica antes de dibujar la aplicación para evitar un destello de color.
aplicarTema(leer());
