import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import type { MovimentoMensal } from '../../db/consultas';
import { movimentoPorMes } from '../../db/consultas';
import type { MesISO } from '../../types';
import { useTextos } from '../../i18n';
import { formatarMesAbreviado, formatarMesTitulo, formatarMoeda } from '../../types';

interface TrilhaMesesProps {
  mes: MesISO;
  aoMudarMes: (mes: MesISO) => void;
  className?: string;
}

/** Janela da trilha. Seis colunas cabem em 320px com alvo de toque de 44px. */
export const MESES_NA_TRILHA = 6;

/** Altura de meia trilha, em px. O eixo zero fica no meio: 2 x META + a linha. */
const META = 34;
/** Mes sem nenhum lancamento vira um toco visivel, nao uma coluna vazia. */
const TOCO = 3;

/**
 * Trajetoria dos ultimos meses E seletor de mes, na mesma peca.
 *
 * Duas barras separadas por um eixo zero: para cima o mes fechou positivo, para
 * baixo fechou negativo. E divergente porque o dado tem sinal — empilhar tudo
 * para cima obrigaria a ler a cor para saber se o mes foi bom, e a altura
 * deixaria de significar "quanto" para significar "quanto, em modulo".
 *
 * Clicar numa coluna troca o mes do painel inteiro. Por isso a marcacao do mes
 * ativo usa `marca` e nunca um tom mais forte da propria barra: selecao e ACAO,
 * e escurecer a barra leria como "esse mes foi pior".
 */
export function TrilhaMeses({ mes, aoMudarMes, className = '' }: TrilhaMesesProps): React.JSX.Element {
  const meses = useLiveQuery(() => movimentoPorMes(mes, MESES_NA_TRILHA), [mes]);
  const t = useTextos();

  if (meses === undefined) {
    return (
      <div
        className={`h-[124px] animate-pulse rounded-lg bg-superficie-fundo ${className}`}
        aria-hidden="true"
      />
    );
  }

  const teto = meses.reduce<number>((maior, item) => Math.max(maior, Math.abs(item.resultado)), 0);

  return (
    <div className={className}>
      <div className="flex items-end gap-1 sm:gap-1.5">
        {meses.map((item) => (
          <Coluna
            key={item.mes}
            item={item}
            teto={teto}
            ativo={item.mes === mes}
            aoTocar={() => {
              aoMudarMes(item.mes);
            }}
          />
        ))}
      </div>

      <p className="mt-2.5 flex items-center gap-3 text-xs text-tinta-suave">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-entrada" />
          {t.inicio.sobrou}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-saida" />
          {t.inicio.faltou}
        </span>
      </p>
    </div>
  );
}

interface ColunaProps {
  item: MovimentoMensal;
  teto: number;
  ativo: boolean;
  aoTocar: () => void;
}

function Coluna({ item, teto, ativo, aoTocar }: ColunaProps): React.JSX.Element {
  // Mes sem movimento nao e "sobrou zero": pintar o toco de verde afirmaria um
  // resultado positivo que nunca existiu. Vazio fica neutro, em cima do eixo.
  const vazio = item.resultado === 0;
  const positivo = item.resultado > 0;
  const altura =
    teto === 0 ? TOCO : Math.max(TOCO, Math.round((Math.abs(item.resultado) / teto) * META));
  const cor = vazio ? 'bg-superficie-forte' : positivo ? 'bg-entrada' : 'bg-saida';

  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={ativo}
      aria-label={`${formatarMesTitulo(item.mes)}, resultado ${formatarMoeda(item.resultado)}`}
      className="group flex min-w-0 flex-1 flex-col items-center rounded-lg px-0.5 pb-1 pt-1.5 active:bg-superficie-fundo md:hover:bg-superficie-fundo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
    >
      {/* Duas metades de altura fixa em vez de uma so com transform: assim o eixo
          zero fica alinhado entre todas as colunas, tenha o mes fechado como for. */}
      <span aria-hidden="true" className="flex w-full flex-col items-stretch">
        <span className="flex items-end" style={{ height: META }}>
          {positivo || vazio ? (
            <span className={`w-full rounded-t-sm ${cor}`} style={{ height: vazio ? TOCO : altura }} />
          ) : null}
        </span>

        <span className="h-px w-full bg-superficie-borda" />

        <span className="flex items-start" style={{ height: META }}>
          {positivo || vazio ? null : (
            <span className={`w-full rounded-b-sm ${cor}`} style={{ height: altura }} />
          )}
        </span>
      </span>

      <span
        className={`mt-1.5 w-full truncate text-center text-[11px] tabular-nums ${
          ativo ? 'font-semibold text-marca' : 'text-tinta-suave'
        }`}
      >
        {formatarMesAbreviado(item.mes)}
      </span>

      <span
        aria-hidden="true"
        className={`mt-1 h-0.5 w-5 rounded-full ${ativo ? 'bg-marca' : 'bg-transparent'}`}
      />
    </button>
  );
}
