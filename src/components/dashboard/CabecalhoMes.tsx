import type * as React from 'react';

import type { MesISO } from '../../types';
import { formatarMesTitulo, mesAnterior, mesSeguinte } from '../../types';

interface CabecalhoMesProps {
  mes: MesISO;
  aoMudarMes: (mes: MesISO) => void;
}

/** Navegacao de competencia. Setas com alvo de 44px, titulo por extenso no meio. */
export function CabecalhoMes({ mes, aoMudarMes }: CabecalhoMesProps): React.JSX.Element {
  const titulo = formatarMesTitulo(mes);

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => aoMudarMes(mesAnterior(mes))}
        aria-label="Mês anterior"
        className="flex min-h-toque w-toque items-center justify-center rounded-xl border border-superficie-borda bg-superficie text-tinta-suave active:bg-superficie-fundo"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
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

      <h1 className="flex-1 text-center text-base font-semibold text-tinta">{titulo}</h1>

      <button
        type="button"
        onClick={() => aoMudarMes(mesSeguinte(mes))}
        aria-label="Próximo mês"
        className="flex min-h-toque w-toque items-center justify-center rounded-xl border border-superficie-borda bg-superficie text-tinta-suave active:bg-superficie-fundo"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
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
