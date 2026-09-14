import { useLiveQuery } from 'dexie-react-hooks';
import { useId } from 'react';
import type * as React from 'react';

import type { GastoPorCategoria } from '../../db/consultas';
import { gastosPorCategoriaDoMes } from '../../db/consultas';
import type { Centavos, MesISO } from '../../types';
import { centavos, formatarMoeda } from '../../types';

interface GraficoCategoriasProps {
  mes: MesISO;
}

/** Teto de fatias antes de dobrar a cauda; acima de ~7 hues nenhuma paleta se distingue. */
const MAXIMO_DE_FATIAS = 6;
const COR_DA_CAUDA = '#94a3b8';
const ALTURA_DA_FITA = 14;

/**
 * "Para onde foi o dinheiro" e part-to-whole: uma barra empilhada horizontal
 * (a forma indicada para muitas categorias de nome longo em 390px) mais as
 * linhas de legenda com valor e %. Donut foi descartado: em 390px o rotulo de
 * cada fatia nao cabe legivel, e as cores vem do banco — sem rotulo visivel a
 * identidade ficaria so na cor, que e justamente o que a paleta do seed nao
 * sustenta (laranja/azul-claro/amarelo ficam abaixo de 3:1 contra o branco).
 */
export function GraficoCategorias({ mes }: GraficoCategoriasProps): React.JSX.Element {
  const idDoRecorte = useId();
  const gastos = useLiveQuery(() => gastosPorCategoriaDoMes(mes), [mes]);

  if (gastos === undefined) {
    return (
      <Moldura>
        <div className="h-24 animate-pulse rounded-xl bg-superficie-fundo" />
      </Moldura>
    );
  }

  const itens = dobrarCauda(gastos);
  const total = somarTotais(itens);

  if (itens.length === 0) {
    return (
      <Moldura>
        <p className="py-6 text-center text-sm text-tinta-suave">
          Nenhuma saída neste mês. Quando houver, o dinheiro aparece dividido por categoria aqui.
        </p>
      </Moldura>
    );
  }

  const segmentos = posicionar(itens);

  return (
    <Moldura>
      <p className="mb-2 text-sm font-semibold tabular-nums text-tinta">{formatarMoeda(total)}</p>

      <svg
        width="100%"
        height={ALTURA_DA_FITA}
        role="img"
        aria-label={`Saidas por categoria, total de ${formatarMoeda(total)}`}
        className="block"
      >
        <clipPath id={idDoRecorte}>
          <rect x="0" y="0" width="100%" height={ALTURA_DA_FITA} rx={ALTURA_DA_FITA / 2} />
        </clipPath>
        <g clipPath={`url(#${idDoRecorte})`}>
          {segmentos.map((segmento) => (
            <rect
              key={segmento.categoriaId}
              x={`${segmento.inicio}%`}
              y="0"
              width={`${segmento.largura}%`}
              height={ALTURA_DA_FITA}
              fill={segmento.cor}
            />
          ))}
          {/* Surface gap: 2px da cor da superficie separando fatias vizinhas. */}
          {segmentos.slice(1).map((segmento) => (
            <rect
              key={`vao-${segmento.categoriaId}`}
              x={`${segmento.inicio}%`}
              y="0"
              width="2"
              height={ALTURA_DA_FITA}
              transform="translate(-1 0)"
              className="fill-superficie"
            />
          ))}
        </g>
      </svg>

      <ul className="mt-3 space-y-2">
        {itens.map((item) => (
          <li key={item.categoriaId} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.cor }}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-tinta">{item.nome}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums text-tinta">
              {formatarMoeda(item.total)}
            </span>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-tinta-suave">
              {formatarFracao(item.fracao)}
            </span>
          </li>
        ))}
      </ul>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <section
      aria-label="Saídas por categoria"
      className="rounded-2xl border border-superficie-borda bg-superficie p-4 shadow-sm"
    >
      <h2 className="text-xs font-medium uppercase tracking-wide text-tinta-suave">
        Para onde foi o dinheiro
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** 0.1234 -> "12%" ; fracoes abaixo de 1% viram "<1%" em vez de "0%". */
function formatarFracao(fracao: number): string {
  const porcento = fracao * 100;
  if (porcento > 0 && porcento < 1) {
    return '<1%';
  }
  return `${Math.round(porcento)}%`;
}

function somarTotais(itens: readonly GastoPorCategoria[]): Centavos {
  return centavos(itens.reduce<number>((soma, item) => soma + item.total, 0));
}

/** Mantem as maiores e junta o resto numa fatia neutra; nunca inventa uma cor nova. */
function dobrarCauda(gastos: readonly GastoPorCategoria[]): GastoPorCategoria[] {
  if (gastos.length <= MAXIMO_DE_FATIAS + 1) {
    return [...gastos];
  }

  const principais = gastos.slice(0, MAXIMO_DE_FATIAS);
  const cauda = gastos.slice(MAXIMO_DE_FATIAS);

  return [
    ...principais,
    {
      categoriaId: 'demais',
      nome: `Demais (${cauda.length.toString()})`,
      cor: COR_DA_CAUDA,
      total: somarTotais(cauda),
      fracao: cauda.reduce<number>((soma, item) => soma + item.fracao, 0),
    },
  ];
}

interface Segmento {
  categoriaId: string;
  cor: string;
  inicio: number;
  largura: number;
}

/** Posicoes acumuladas em %, com a ultima fatia fechando exatamente em 100. */
function posicionar(itens: readonly GastoPorCategoria[]): Segmento[] {
  const segmentos: Segmento[] = [];
  let cursor = 0;

  itens.forEach((item, indice) => {
    const ultimo = indice === itens.length - 1;
    const largura = ultimo ? Math.max(0, 100 - cursor) : item.fracao * 100;
    segmentos.push({ categoriaId: item.categoriaId, cor: item.cor, inicio: cursor, largura });
    cursor += largura;
  });

  return segmentos;
}
