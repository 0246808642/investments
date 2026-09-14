import { useEffect } from 'react';

/**
 * Trava o scroll do body enquanto a folha esta aberta. Sem isso o iOS rola a
 * pagina atras do bottom sheet quando o teclado abre e o usuario arrasta.
 *
 * Guarda e restaura o valor anterior em vez de zerar: se um dia existir outro
 * overlay, quem fecha por ultimo devolve o estado original.
 */
export function useTravaScroll(travado: boolean): void {
  useEffect(() => {
    if (!travado) {
      return;
    }
    const corpo = document.body;
    const anterior = corpo.style.overflow;
    corpo.style.overflow = 'hidden';
    return () => {
      corpo.style.overflow = anterior;
    };
  }, [travado]);
}
