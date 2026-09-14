import { useState } from 'react';
import type * as React from 'react';

import type { DataISO, MesISO } from '../../types';
import { mesAtual } from '../../types';
import { CabecalhoMes } from './CabecalhoMes';
import { CalendarioMes } from './CalendarioMes';
import { CartaoSaldo } from './CartaoSaldo';
import { GraficoCategorias } from './GraficoCategorias';
import { ListaTransacoes } from './ListaTransacoes';

/**
 * Tela inicial. Guarda o mes e o dia selecionado — a integracao no App e so
 * montar <Dashboard />.
 */
export function Dashboard(): React.JSX.Element {
  const [mes, setMes] = useState<MesISO>(() => mesAtual());
  const [diaSelecionado, setDiaSelecionado] = useState<DataISO | null>(null);

  const trocarMes = (proximo: MesISO): void => {
    setMes(proximo);
    // O dia selecionado pertencia ao mes anterior; mante-lo esvaziaria a lista.
    setDiaSelecionado(null);
  };

  return (
    <div className="min-h-screen bg-superficie-fundo">
      <div className="mx-auto w-full max-w-md space-y-3 px-3 pt-3 pb-[calc(6rem_+_env(safe-area-inset-bottom))]">
        <CabecalhoMes mes={mes} aoMudarMes={trocarMes} />
        <CartaoSaldo mes={mes} />
        <GraficoCategorias mes={mes} />
        <CalendarioMes
          mes={mes}
          diaSelecionado={diaSelecionado}
          aoSelecionarDia={setDiaSelecionado}
        />
        <ListaTransacoes
          mes={mes}
          diaSelecionado={diaSelecionado}
          aoLimparFiltro={() => {
            setDiaSelecionado(null);
          }}
        />
      </div>
    </div>
  );
}
