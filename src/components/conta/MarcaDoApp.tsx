import type * as React from 'react';

interface MarcaDoAppProps {
  className?: string;
}

/**
 * O simbolo do app: quatro barras subindo — a trilha de meses da tela inicial
 * reduzida ao minimo, e o mesmo motivo do icone instalavel de `public/icone.svg`.
 *
 * Um simbolo generico (cifrao, carteira, cofrinho) serviria a qualquer app de
 * dinheiro; este so serve a um que mede o mes pelo que sobrou dele.
 *
 * Monocromatico, em `currentColor` e opacidade: assim ele funciona sobre o
 * ladrilho indigo, sobre a superficie clara e sobre a escura sem nenhuma
 * variante — quem define a cor e onde ele esta.
 */
export function MarcaDoApp({ className = '' }: MarcaDoAppProps): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <rect x="2" y="14" width="4" height="7.5" rx="1.2" opacity="0.45" />
      <rect x="7.6" y="11" width="4" height="10.5" rx="1.2" opacity="0.62" />
      <rect x="13.2" y="7" width="4" height="14.5" rx="1.2" opacity="0.8" />
      <rect x="18.8" y="2.5" width="4" height="19" rx="1.2" />
    </svg>
  );
}
