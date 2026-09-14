import type * as React from 'react';

import type { MesISO } from '../../types';
import { formatarMesTitulo, mesAnterior, mesSeguinte } from '../../types';

interface CabecalhoMesProps {
  mes: MesISO;
  aoMudarMes: (mes: MesISO) => void;
  className?: string;
}

/**
 * Navegacao de competencia. Alvo de 44px no toque; em lg ha ponteiro, o alvo
 * pode encolher para 36px e devolver o peso visual ao titulo.
 */
const BOTAO =
  'flex min-h-toque w-toque items-center justify-center rounded-lg border border-superficie-borda bg-superficie text-tinta-suave active:bg-superficie-fundo md:hover:bg-superficie-fundo md:hover:text-tinta lg:min-h-0 lg:h-9 lg:w-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

export function CabecalhoMes({
  mes,
  aoMudarMes,
  className = '',
}: CabecalhoMesProps): React.JSX.Element {
  const titulo = formatarMesTitulo(mes);

  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => {
          aoMudarMes(mesAnterior(mes));
        }}
        aria-label="Mês anterior"
        className={BOTAO}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 lg:h-4 lg:w-4" aria-hidden="true">
          <path
            d="M15 5 8 12l7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <h1 className="flex-1 text-center text-base font-semibold tabular-nums text-tinta md:text-lg lg:text-xl">
        {titulo}
      </h1>

      <button
        type="button"
        onClick={() => {
          aoMudarMes(mesSeguinte(mes));
        }}
        aria-label="Próximo mês"
        className={BOTAO}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 lg:h-4 lg:w-4" aria-hidden="true">
          <path
            d="m9 5 7 7-7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
