'use client';

/**
 * Tema claro / oscuro.
 *
 * Por defecto oscuro, como ha sido siempre la app: nadie se encuentra con un
 * cambio que no pidió. La preferencia se guarda en el navegador y se aplica
 * poniendo o quitando la clase `dark` en <html>, que es de donde cuelgan las
 * variantes `dark:` de Tailwind.
 *
 * Para que no haya un parpadeo claro antes de que corra React, el layout
 * renderiza <html class="dark"> y un script mínimo aplica la preferencia
 * guardada antes de pintar.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type Tema = 'claro' | 'oscuro';

const CLAVE = 'tema';

interface ThemeContextType {
  tema: Tema;
  alternarTema: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Script que corre antes de pintar, para evitar el parpadeo. */
export const SCRIPT_TEMA_INICIAL = `
try {
  var t = localStorage.getItem('${CLAVE}');
  document.documentElement.classList.toggle('dark', t !== 'claro');
} catch (e) {}
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Se arranca en oscuro para coincidir con lo que el servidor renderizó; la
  // preferencia guardada se lee después de hidratar.
  const [tema, setTema] = useState<Tema>('oscuro');

  useEffect(() => {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem(CLAVE);
    } catch {
      guardado = null;
    }
    const inicial: Tema = guardado === 'claro' ? 'claro' : 'oscuro';
    setTema(inicial);
    document.documentElement.classList.toggle('dark', inicial === 'oscuro');
  }, []);

  const alternarTema = useCallback(() => {
    setTema(actual => {
      const nuevo: Tema = actual === 'oscuro' ? 'claro' : 'oscuro';
      document.documentElement.classList.toggle('dark', nuevo === 'oscuro');
      try {
        localStorage.setItem(CLAVE, nuevo);
      } catch {
        // Modo privado o almacenamiento bloqueado: el tema vale para esta
        // sesión y no se recuerda. Mejor eso que romper el cambio.
      }
      return nuevo;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ tema, alternarTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTema(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTema debe usarse dentro de ThemeProvider');
  return ctx;
}
