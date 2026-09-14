import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import { serieDeSaldo } from '../../db/consultas';
import type { MesISO } from '../../types';
import { useTextos } from '../../i18n';
import { MENOS, centavos, formatarMoeda, subtrair } from '../../types';
import { GraficoDeSaldo } from '../graficos/GraficoDeSaldo';

interface CartaoEvolucaoProps {
  mes: MesISO;
  /** Clicar num mes da curva troca o recorte da tela inteira. */
  aoMudarMes: (mes: MesISO) => void;
  className?: string;
}

/** Um ano fecha o ciclo de sazonalidade (13o, ferias, IPTU) sem virar linha do tempo. */
export const MESES_NA_CURVA = 12;

/**
 * A curva de saldo dos ultimos doze meses, com a variacao do periodo no
 * cabecalho.
 *
 * O numero no cabecalho e a VARIACAO, nao o saldo: o saldo ja e o heroi da faixa
 * de cima, e repetir o mesmo valor em dois lugares da tela nao acrescenta nada.
 * O que este card responde e outra pergunta — para onde a linha vem indo.
 *
 * A curva tambem NAVEGA: clicar num mes leva a tela inteira para ele. Ver um
 * degrau no grafico e querer saber o que aconteceu ali sao a mesma acao, e
 * separa-las obrigaria a voltar ao seletor de mes e contar para tras.
 */
export function CartaoEvolucao({
  mes,
  aoMudarMes,
  className = '',
}: CartaoEvolucaoProps): React.JSX.Element {
  const serie = useLiveQuery(() => serieDeSaldo(mes, MESES_NA_CURVA), [mes]);
  const t = useTextos();

  const primeiro = serie?.at(0);
  const ultimo = serie?.at(-1);
  const variacao =
    primeiro === undefined || ultimo === undefined
      ? null
      : subtrair(ultimo.saldo, centavos(primeiro.saldo - primeiro.resultado));

  return (
    <section
      aria-label={t.inicio.evolucaoDoSaldo}
      className={`rounded-xl border border-superficie-borda bg-superficie p-4 md:p-5 lg:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-rotulo font-medium text-tinta-suave">{t.inicio.evolucaoDoSaldo}</h2>
        {variacao === null ? null : (
          <p
            className={`text-base font-semibold tabular-nums md:text-lg ${
              variacao < 0 ? 'text-saida' : 'text-entrada'
            }`}
          >
            {variacao < 0 ? MENOS : '+'}
            {formatarMoeda(centavos(Math.abs(variacao)))}
            <span className="ml-1.5 text-xs font-normal text-tinta-suave">{t.inicio.emDozeMeses}</span>
          </p>
        )}
      </div>

      {serie === undefined ? (
        <div className="mt-3 h-[240px] animate-pulse rounded-lg bg-superficie-fundo" />
      ) : (
        <GraficoDeSaldo
          serie={serie}
          mesSelecionado={mes}
          aoSelecionarMes={aoMudarMes}
          className="mt-3"
        />
      )}
    </section>
  );
}
