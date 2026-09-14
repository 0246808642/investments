import { useState } from 'react';
import type * as React from 'react';

import type { MovimentoMensal } from '../../db/consultas';
import type { MesISO } from '../../types';
import { useTextos } from '../../i18n';
import { formatarMesAbreviado, formatarMesTitulo, formatarMoeda } from '../../types';

interface GraficoEntradaSaidaProps {
  serie: readonly MovimentoMensal[];
  /** Mes em foco no painel: ganha marcacao propria, separada do hover. */
  mesSelecionado?: MesISO;
  /** Quando existe, cada mes vira um alvo de clique que troca o recorte da tela. */
  aoSelecionarMes?: (mes: MesISO) => void;
  className?: string;
}

/**
 * Entradas e saidas lado a lado, mes a mes.
 *
 * Barras AGRUPADAS e nao empilhadas: a pergunta e "entrou mais do que saiu?", e
 * empilhar transforma as duas numa soma que ninguem quer somar — dinheiro que
 * entra e dinheiro que sai nao formam um total.
 *
 * Um eixo so, compartilhado pelas duas series: e o que permite comparar a altura
 * de uma com a da outra. Duas escalas fariam qualquer mes parecer equilibrado.
 *
 * Tudo em HTML/flex, sem SVG: sao retangulos alinhados a uma base, e div faz
 * isso sem precisar de viewBox nem de medir o container.
 */
export function GraficoEntradaSaida({
  serie,
  mesSelecionado,
  aoSelecionarMes,
  className = '',
}: GraficoEntradaSaidaProps): React.JSX.Element {
  const [ativo, setAtivo] = useState<number | null>(null);
  const t = useTextos();

  const teto = serie.reduce<number>(
    (maior, item) => Math.max(maior, item.entradas, item.saidas),
    0,
  );

  const emFoco = ativo === null ? undefined : serie[ativo];
  const clicavel = aoSelecionarMes !== undefined;

  if (teto === 0) {
    return (
      <div className={`rounded-lg bg-superficie-fundo px-4 py-10 text-center ${className}`}>
        <p className="text-sm text-tinta-suave">{t.graficos.semMovimento(serie.length)}</p>
        <p className="mt-1 text-xs text-tinta-fraca">{t.graficos.barrasAparecem}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex h-[200px] items-end gap-1.5 md:h-[240px] md:gap-2">
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
              aria-label={`${t.graficos.entrouContra(
                formatarMesTitulo(item.mes),
                formatarMoeda(item.entradas),
                formatarMoeda(item.saidas),
              )}${clicavel ? `. ${t.graficos.verEsteMes}` : ''}`}
              aria-pressed={clicavel ? selecionado : undefined}
              className={`flex h-full min-w-0 flex-1 items-end gap-0.5 rounded-t-md px-0.5 pt-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca ${
                clicavel ? 'cursor-pointer' : 'cursor-default'
              } ${
                selecionado
                  ? 'bg-marca-suave'
                  : indice === ativo
                    ? 'bg-superficie-fundo'
                    : ''
              }`}
            >
              <Barra valor={item.entradas} teto={teto} classe="bg-entrada" />
              <Barra valor={item.saidas} teto={teto} classe="bg-saida" />
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1.5 text-[11px] tabular-nums text-tinta-fraca md:gap-2">
        {serie.map((item, indice) => (
          <span
            key={item.mes}
            className={`min-w-0 flex-1 truncate text-center ${
              item.mes === mesSelecionado
                ? 'font-semibold text-marca'
                : indice === ativo
                  ? 'font-semibold text-tinta'
                  : ''
            }`}
          >
            {formatarMesAbreviado(item.mes)}
          </span>
        ))}
      </div>

      {/* Legenda sempre presente: com duas series, identidade nunca pode depender
          so da cor. */}
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tinta-suave">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-entrada" />
          {t.comum.entrou}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-sm bg-saida" />
          {t.comum.saiu}
        </span>
      </p>

      <div className="mt-2 min-h-[2.75rem] rounded-lg bg-superficie-fundo px-3 py-2">
        {emFoco === undefined ? (
          <p className="text-xs text-tinta-suave">
            {clicavel ? t.graficos.cliqueNoMes : t.graficos.passeOMouseNumeros}
          </p>
        ) : (
          <p className="text-xs tabular-nums text-tinta">
            {t.graficos.entrouContra(
              formatarMesTitulo(emFoco.mes),
              formatarMoeda(emFoco.entradas),
              formatarMoeda(emFoco.saidas),
            )}
          </p>
        )}
      </div>
    </div>
  );
}

interface BarraProps {
  valor: number;
  teto: number;
  classe: string;
}

function Barra({ valor, teto, classe }: BarraProps): React.JSX.Element {
  // Piso de 2px: mes com movimento minusculo nao pode desaparecer e virar "mes
  // sem nada" — sao leituras diferentes.
  const altura = teto === 0 || valor === 0 ? 0 : Math.max(2, (valor / teto) * 100);

  return (
    <span
      aria-hidden="true"
      className={`min-w-0 flex-1 rounded-t-sm ${classe}`}
      style={{ height: `${altura.toFixed(2)}%` }}
    />
  );
}
