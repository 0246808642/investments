import type * as React from 'react';

import type { MesISO } from '../../types';
import { useTextos } from '../../i18n';
import { formatarMesTitulo, mesAnterior, mesAtual, mesSeguinte } from '../../types';

interface CabecalhoMesProps {
  mes: MesISO;
  aoMudarMes: (mes: MesISO) => void;
  className?: string;
}

/**
 * Navegacao de competencia, no topo da faixa de saldo. Alvo de 44px no toque;
 * em lg ha ponteiro, o alvo pode encolher para 36px e devolver peso ao titulo.
 *
 * O mes e o recorte de tudo que esta abaixo, entao o titulo fica na esquerda —
 * onde a leitura comeca — e os controles na direita, juntos. Titulo centralizado
 * entre duas setas transformava o cabecalho num widget solto, sem dono.
 */
const BOTAO =
  'flex min-h-toque w-toque items-center justify-center rounded-lg border border-superficie-borda bg-superficie text-tinta-suave active:bg-superficie-fundo md:hover:bg-superficie-fundo md:hover:text-tinta lg:min-h-0 lg:h-9 lg:w-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

export function CabecalhoMes({
  mes,
  aoMudarMes,
  className = '',
}: CabecalhoMesProps): React.JSX.Element {
  const agora = mesAtual();
  const t = useTextos();

  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <h1 className="min-w-0 truncate text-base font-semibold tabular-nums text-tinta md:text-lg lg:text-xl">
        {formatarMesTitulo(mes)}
      </h1>

      <div className="flex shrink-0 items-center gap-1.5">
        {/* So aparece longe de casa: um "Hoje" permanente seria um botao morto
            na maior parte do tempo, e botao morto ensina a ignorar o lugar. */}
        {mes === agora ? null : (
          <button
            type="button"
            onClick={() => {
              aoMudarMes(agora);
            }}
            className="flex min-h-toque items-center rounded-lg px-2.5 text-sm font-medium text-marca active:bg-marca-suave md:min-h-0 md:h-9 md:hover:bg-marca-suave focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
          >
            {t.comum.voltarParaHoje}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            aoMudarMes(mesAnterior(mes));
          }}
          aria-label={t.comum.mesAnterior}
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

        <button
          type="button"
          onClick={() => {
            aoMudarMes(mesSeguinte(mes));
          }}
          aria-label={t.comum.proximoMes}
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
    </div>
  );
}
