import { useContext } from 'react';
import { ContextoAlertas } from './contextoAlertas';

/** Abre a folha de limites de qualquer lugar abaixo de <ProvedorAlertas>. */
export function useAbrirAlertas(): () => void {
  const abrir = useContext(ContextoAlertas);
  if (abrir === null) {
    throw new Error('useAbrirAlertas precisa estar dentro de <ProvedorAlertas>.');
  }
  return abrir;
}
