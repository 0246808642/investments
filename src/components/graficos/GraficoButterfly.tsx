import { useState } from 'react';
import type * as React from 'react';

import type { MovimentoMensal } from '../../db/consultas';
import type { MesISO } from '../../types';
import { useTextos } from '../../i18n';
import { centavos, formatarMesAbreviado, formatarMesTitulo, formatarMoeda } from '../../types';

interface GraficoButterflyProps {
  serie: readonly MovimentoMensal[];
  mesSelecionado?: MesISO;
  aoSelecionarMes?: (mes: MesISO) => void;
  className?: string;
}

/** Meia altura, em px. O eixo fica no meio: 2 x META mais a linha. */
const META = 84;
/** Mes com movimento minusculo nao pode sumir e virar "mes sem nada". */
const PISO = 2;

/**
 * Entrou acima do eixo, saiu abaixo — o grafico "borboleta" do extrato.
 *
 * E a mesma informacao das barras agrupadas, lida de outro jeito: espelhado, o
 * mes equilibrado fica simetrico e o desequilibrado salta sem precisar comparar
 * duas alturas vizinhas. O olho compara distancia ate um eixo comum, que e a
 * comparacao mais barata que existe.
 *
 * UM eixo, uma escala: as duas metades dividem o mesmo teto. Escalas separadas
 * fariam todo mes parecer equilibrado — que e exatamente a leitura errada.
 */
export function GraficoButterfly({
  serie,
  mesSelecionado,
  aoSelecionarMes,
  className = '',
}: GraficoButterflyProps): React.JSX.Element {
  const [ativo, setAtivo] = useState<number | null>(null);
  const t = useTextos();

  const teto = serie.reduce<number>((maior, item) => Math.max(maior, item.entradas, item.saidas), 0);
  const emFoco = ativo === null ? undefined : serie[ativo];
  const clicavel = aoSelecionarMes !== undefined;

  if (teto === 0) {
    return (
      <div className={`px-4 py-12 text-center ${className}`}>
        <p className="text-sm text-tinta-suave">{t.graficos.semMovimento(serie.length)}</p>
      </div>
    );
  }

  const altura = (valor: number): number =>
    valor === 0 ? 0 : Math.max(PISO, Math.round((valor / teto) * META));

  return (
    <div className={className}>
      <div className="flex items-stretch gap-1 sm:gap-1.5">
        {serie.map((item, indice) => {
          const selecionado = item.mes === mesSelecionado;
          return (
            <button
              key={item.mes}
              type="button"
              disabled={!clicavel}
              onClick={() => {
                aoSelecionarMes?.(item.mes);
              }}
              onMouseEnter={() => {
                setAtivo(indice);
              }}
              onMouseLeave={() => {
                setAtivo(null);
              }}
              onFocus={() => {
                setAtivo(indice);
              }}
              onBlur={() => {
                setAtivo(null);
              }}
              aria-pressed={clicavel ? selecionado : undefined}
              aria-label={`${t.graficos.entrouContra(
                formatarMesTitulo(item.mes),
                formatarMoeda(item.entradas),
                formatarMoeda(item.saidas),
              )}${clicavel ? `. ${t.graficos.verEsteMes}` : ''}`}
              className={`group flex min-w-0 flex-1 flex-col rounded-md px-0.5 pb-1 pt-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca ${
                clicavel ? 'cursor-pointer' : 'cursor-default'
              } ${selecionado ? 'bg-marca-suave' : indice === ativo ? 'bg-superficie-fundo' : ''}`}
            >
              <span aria-hidden="true" className="flex w-full flex-col items-stretch">
                <span className="flex items-end justify-center" style={{ height: META }}>
                  <span
                    className="w-full rounded-t-sm bg-entrada"
                    style={{ height: altura(item.entradas) }}
                  />
                </span>

                {/* O eixo zero e um fio continuo, e nao a borda das barras: e ele
                    que da o ponto de comparacao entre as duas metades. */}
                <span className="h-px w-full bg-superficie-forte" />

                <span className="flex items-start justify-center" style={{ height: META }}>
                  <span
                    className="w-full rounded-b-sm bg-saida"
                    style={{ height: altura(item.saidas) }}
                  />
                </span>
              </span>

              <span
                className={`mt-2 w-full truncate text-center text-[11px] tabular-nums ${
                  selecionado
                    ? 'font-semibold text-marca'
                    : indice === ativo
                      ? 'font-semibold text-tinta'
                      : 'text-tinta-fraca'
                }`}
              >
                {formatarMesAbreviado(item.mes)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-superficie-borda pt-3">
        <p className="flex items-center gap-4 text-xs text-tinta-suave">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-entrada" />
            {t.comum.entrou}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-saida" />
            {t.comum.saiu}
          </span>
        </p>

        {/* Largura reservada: sem ela a linha reflui a cada passagem do mouse. */}
        <p className="min-h-[1.25rem] text-xs tabular-nums text-tinta">
          {emFoco === undefined ? (
            <span className="text-tinta-fraca">
              {t.graficos.tetoDaEscala(formatarMoeda(centavos(teto)))}
            </span>
          ) : (
            t.graficos.entrouContra(
              formatarMesTitulo(emFoco.mes),
              formatarMoeda(emFoco.entradas),
              formatarMoeda(emFoco.saidas),
            )
          )}
        </p>
      </div>
    </div>
  );
}
