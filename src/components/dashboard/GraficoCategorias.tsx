import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import type { GastoPorCategoria } from '../../db/consultas';
import { gastosPorCategoriaDoMes } from '../../db/consultas';
import type { Centavos, MesISO } from '../../types';
import { centavos, formatarMoeda } from '../../types';

interface GraficoCategoriasProps {
  mes: MesISO;
  className?: string;
}

/** Teto de fatias antes de dobrar a cauda; acima de ~7 hues nenhuma paleta se distingue. */
const MAXIMO_DE_FATIAS = 6;
/** Espelha o token `categoria.outros`; entra como dado (campo `cor`), igual ao que vem do banco. */
const COR_DA_CAUDA = '#94a3b8';
/** Abaixo disso o nome nao cabe dentro do segmento nem em 1920px. */
const LARGURA_MINIMA_PARA_ROTULO = 12;

/**
 * "Para onde foi o dinheiro" e part-to-whole: fita empilhada horizontal mais as
 * linhas de legenda com valor e %. A fita fica — e nao vira donut — porque ela
 * MELHORA com largura: cresce no eixo que sobra, compara comprimento (que se le
 * melhor que angulo) e, a partir de lg, absorve o rotulo dentro do proprio
 * segmento. Um donut de 8 fatias e quadrado: gasta altura, desperdica largura e
 * ainda exige a mesma legenda.
 */
export function GraficoCategorias({
  mes,
  className = '',
}: GraficoCategoriasProps): React.JSX.Element {
  const gastos = useLiveQuery(() => gastosPorCategoriaDoMes(mes), [mes]);

  if (gastos === undefined) {
    return (
      <Moldura className={className}>
        <div className="h-24 animate-pulse rounded-lg bg-superficie-fundo" />
      </Moldura>
    );
  }

  const itens = dobrarCauda(gastos);
  const total = somarTotais(itens);

  if (itens.length === 0) {
    return (
      <Moldura className={className}>
        <p className="py-6 text-center text-sm text-tinta-suave">
          Nenhuma saída neste mês. Quando houver, o dinheiro aparece dividido por categoria aqui.
        </p>
      </Moldura>
    );
  }

  const segmentos = posicionar(itens);

  return (
    <Moldura className={className}>
      <p className="mb-2 text-sm font-semibold tabular-nums text-tinta md:text-base">
        {formatarMoeda(total)}
      </p>

      {/* O arredondamento vem do wrapper: assim a altura da fita pode ser
          responsiva sem que um rx fixo vire lozango na altura menor. */}
      <div className="h-3 overflow-hidden rounded-md md:h-4 lg:h-5">
        <svg
          width="100%"
          height="100%"
          role="img"
          aria-label={`Saídas por categoria, total de ${formatarMoeda(total)}`}
          className="block h-full w-full"
        >
          {segmentos.map((segmento) => (
            <rect
              key={segmento.categoriaId}
              x={`${segmento.inicio}%`}
              y="0"
              width={`${segmento.largura}%`}
              height="100%"
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
              height="100%"
              transform="translate(-1 0)"
              className="fill-superficie"
            />
          ))}

          {/* Em lg sobra largura: o segmento largo passa a carregar o proprio nome. */}
          {segmentos
            .filter((segmento) => segmento.largura >= LARGURA_MINIMA_PARA_ROTULO)
            .map((segmento) => (
              <text
                key={`rotulo-${segmento.categoriaId}`}
                x={`${segmento.inicio + segmento.largura / 2}%`}
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
                className="hidden fill-white text-[11px] font-medium lg:inline"
              >
                {segmento.nome}
              </text>
            ))}
        </svg>
      </div>

      <ul className="mt-3 space-y-1.5 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-1 md:space-y-0">
        {itens.map((item) => (
          <li key={item.categoriaId} className="relative flex items-center gap-2.5 py-0.5">
            {/* Em lg a linha ganha barra de fundo proporcional: a largura morta
                vira uma segunda codificacao da mesma proporcao. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 hidden rounded-md lg:block"
              style={{
                width: `${(item.fracao * 100).toFixed(2)}%`,
                backgroundColor: item.cor,
                opacity: 0.1,
              }}
            />
            <span
              aria-hidden="true"
              className="relative h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.cor }}
            />
            <span className="relative min-w-0 flex-1 truncate text-sm text-tinta">{item.nome}</span>
            <span className="relative w-24 shrink-0 text-right text-sm font-medium tabular-nums text-tinta">
              {formatarMoeda(item.total)}
            </span>
            <span className="relative w-10 shrink-0 text-right text-xs tabular-nums text-tinta-suave">
              {formatarFracao(item.fracao)}
            </span>
          </li>
        ))}
      </ul>
    </Moldura>
  );
}

interface MolduraProps {
  children: React.ReactNode;
  className: string;
}

function Moldura({ children, className }: MolduraProps): React.JSX.Element {
  return (
    <section
      aria-label="Saídas por categoria"
      className={`rounded-xl border border-superficie-borda bg-superficie p-4 md:p-5 lg:p-6 ${className}`}
    >
      <h2 className="text-rotulo font-medium text-tinta-suave">Para onde foi o dinheiro</h2>
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
  nome: string;
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
    segmentos.push({
      categoriaId: item.categoriaId,
      nome: item.nome,
      cor: item.cor,
      inicio: cursor,
      largura,
    });
    cursor += largura;
  });

  return segmentos;
}
