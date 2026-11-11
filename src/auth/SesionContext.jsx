import { createContext, useContext, useState } from 'react';
import { USUARIOS_EJEMPLO, puede } from './roles.js';

// Guarda qué usuario de ejemplo eligió la persona.
// Se recuerda en el navegador para no elegirlo de nuevo al recargar.
const CLAVE = 'vision-ai:usuario';
const SesionContext = createContext(null);

function leerGuardado() {
  try {
    const id = localStorage.getItem(CLAVE);
    return USUARIOS_EJEMPLO.find((u) => u.id === id) ?? null;
  } catch {
    return null;
  }
}

export function SesionProvider({ children }) {
  const [usuario, setUsuario] = useState(leerGuardado);

  function entrar(id) {
    const elegido = USUARIOS_EJEMPLO.find((u) => u.id === id) ?? null;
    setUsuario(elegido);
    try {
      localStorage.setItem(CLAVE, id);
    } catch {
      // Sin almacenamiento: la sesión dura hasta recargar.
    }
  }

  function salir() {
    setUsuario(null);
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      // Nada que borrar.
    }
  }

  const valor = {
    usuario,
    entrar,
    salir,
    puede: (permiso) => (usuario ? puede(usuario.rol, permiso) : false),
  };

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  const ctx = useContext(SesionContext);
  if (!ctx) throw new Error('useSesion debe usarse dentro de SesionProvider');
  return ctx;
}
