import { useContext } from 'react';
import { ContextoConta, type AbrirConta } from './contextoConta';

/** Abre a folha de entrar/criar conta de qualquer lugar abaixo de <ProvedorConta>. */
export function useAbrirConta(): AbrirConta {
  const abrir = useContext(ContextoConta);
  if (abrir === null) {
    throw new Error('useAbrirConta precisa estar dentro de <ProvedorConta>.');
  }
  return abrir;
}
