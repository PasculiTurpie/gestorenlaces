import { useEffect, useState } from 'react';

/** Reloj reactivo: re-renderiza cada `ms` para mantener al día los "hace X min". */
export function useNow(ms = 30_000) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return ahora;
}
