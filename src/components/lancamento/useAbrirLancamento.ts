import { useContext } from 'react';
import { ContextoLancamento } from './contextoLancamento';

/**
 * Abre o formulario de lancamento de qualquer lugar da arvore, desde que
 * abaixo de <ProvedorLancamento>. Retorna a funcao estavel (useCallback no
 * provedor), entao pode ir direto para onClick sem gerar re-render.
 */
export function useAbrirLancamento(): () => void {
  const abrir = useContext(ContextoLancamento);
  if (abrir === null) {
    throw new Error('useAbrirLancamento precisa estar dentro de <ProvedorLancamento>.');
  }
  return abrir;
}
