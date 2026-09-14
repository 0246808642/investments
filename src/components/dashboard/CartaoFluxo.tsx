import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import { movimentoPorMes } from '../../db/consultas';
import { useTextos } from '../../i18n';
import type { MesISO } from '../../types';
import { GraficoEntradaSaida } from '../graficos/GraficoEntradaSaida';

interface CartaoFluxoProps {
  mes: MesISO;
  /** Clicar num par de barras troca o recorte da tela inteira. */
  aoMudarMes: (mes: MesISO) => void;
  className?: string;
}

/** Seis meses: e o que cabe como par de barras legivel na coluna estreita do grid. */
export const MESES_NO_FLUXO = 6;

/**
 * Entradas contra saidas, mes a mes.
 *
 * Fica ao lado da curva de saldo porque as duas leituras se completam: a curva
 * diz PARA ONDE o saldo foi, e este diz POR QUE. Uma curva que cai sem este
 * grafico ao lado nao distingue "entrou menos" de "saiu mais".
 *
 * Como a curva, as barras navegam: clicar num mes leva a tela inteira para ele.
 */
export function CartaoFluxo({
  mes,
  aoMudarMes,
  className = '',
}: CartaoFluxoProps): React.JSX.Element {
  const serie = useLiveQuery(() => movimentoPorMes(mes, MESES_NO_FLUXO), [mes]);
  const t = useTextos();

  return (
    <section
      aria-label={t.inicio.entrouESaiu}
      className={`rounded-xl border border-superficie-borda bg-superficie p-4 md:p-5 lg:p-6 ${className}`}
    >
      <h2 className="text-rotulo font-medium text-tinta-suave">{t.inicio.entrouESaiu}</h2>

      {serie === undefined ? (
        <div className="mt-3 h-[240px] animate-pulse rounded-lg bg-superficie-fundo" />
      ) : (
        <GraficoEntradaSaida
          serie={serie}
          mesSelecionado={mes}
          aoSelecionarMes={aoMudarMes}
          className="mt-3"
        />
      )}
    </section>
  );
}
