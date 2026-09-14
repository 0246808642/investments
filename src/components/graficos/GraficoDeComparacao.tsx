import type * as React from 'react';

import type { ComparacaoDeCategoria } from '../../db/consultas';
import type { MesISO } from '../../types';
import { useTextos } from '../../i18n';
import { MENOS, centavos, formatarMesNome, formatarMoeda, subtrair } from '../../types';

interface GraficoDeComparacaoProps {
  itens: readonly ComparacaoDeCategoria[];
  mes: MesISO;
  mesAnterior: MesISO;
  className?: string;
}

/**
 * Halteres: cada categoria vira um segmento entre o mes passado e este.
 *
 * Substitui a tabela de quatro colunas de numeros. A tabela era exata e ilegivel
 * — para saber quem cresceu, o olho tinha que subtrair linha a linha. Aqui a
 * MUDANCA e o proprio desenho: o comprimento do segmento e o tamanho dela, e o
 * lado para onde ele aponta e o sinal. Os valores continuam escritos na direita,
 * entao nada de exatidao se perdeu.
 *
 * Uma escala so, em dinheiro, compartilhada por todas as linhas: e o que permite
 * comparar categorias entre si, e nao so cada uma consigo mesma.
 */
export function GraficoDeComparacao({
  itens,
  mes,
  mesAnterior: referencia,
  className = '',
}: GraficoDeComparacaoProps): React.JSX.Element {
  const t = useTextos();
  const teto = itens.reduce<number>((maior, item) => Math.max(maior, item.atual, item.anterior), 0);

  if (itens.length === 0 || teto === 0) {
    return (
      <div className={`px-4 py-12 text-center ${className}`}>
        <p className="text-sm text-tinta-suave">
          {t.graficos.semSaidasEntre(formatarMesNome(mes), formatarMesNome(referencia))}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <ul className="space-y-1">
        {itens.map((item) => (
          <Haltere key={item.categoriaId} item={item} teto={teto} />
        ))}
      </ul>

      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-superficie-borda pt-3 text-xs text-tinta-suave">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full border-2 border-tinta-fraca bg-superficie"
          />
          {formatarMesNome(referencia)}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-tinta" />
          {formatarMesNome(mes)}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-saida" />
          {t.graficos.gastouMais}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-entrada" />
          {t.graficos.gastouMenos}
        </span>
      </p>
    </div>
  );
}

interface HaltereProps {
  item: ComparacaoDeCategoria;
  teto: number;
}

function Haltere({ item, teto }: HaltereProps): React.JSX.Element {
  const t = useTextos();
  const diferenca = subtrair(item.atual, item.anterior);
  const subiu = diferenca > 0;

  const posicao = (valor: number): number => (valor / teto) * 100;
  const de = Math.min(posicao(item.anterior), posicao(item.atual));
  const ate = Math.max(posicao(item.anterior), posicao(item.atual));

  return (
    <li className="group flex items-center gap-3 rounded-md py-1.5 md:hover:bg-superficie-fundo">
      <span className="flex w-24 shrink-0 items-center gap-2 md:w-28">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: item.cor }}
        />
        <span className="truncate text-sm text-tinta">{item.nome}</span>
      </span>

      <span
        className="relative h-5 min-w-0 flex-1"
        role="img"
        aria-label={`${item.nome}: ${t.estatisticas.contra(formatarMoeda(item.anterior), formatarMoeda(item.atual))}`}
      >
        {/* Trilho: sem ele, uma categoria de valor baixo vira um ponto solto no
            comeco e some da comparacao entre as linhas. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-superficie-borda"
        />

        <span
          aria-hidden="true"
          className={`absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full ${
            diferenca === 0 ? 'bg-superficie-forte' : subiu ? 'bg-saida' : 'bg-entrada'
          }`}
          style={{ left: `${de.toFixed(2)}%`, width: `${Math.max(0, ate - de).toFixed(2)}%` }}
        />

        <span
          aria-hidden="true"
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-tinta-fraca bg-superficie"
          style={{ left: `${posicao(item.anterior).toFixed(2)}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tinta ring-2 ring-superficie"
          style={{ left: `${posicao(item.atual).toFixed(2)}%` }}
        />
      </span>

      <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums text-tinta">
        {formatarMoeda(item.atual)}
      </span>

      <span
        className={`w-20 shrink-0 text-right text-xs tabular-nums ${
          diferenca === 0 ? 'text-tinta-fraca' : subiu ? 'text-saida' : 'text-entrada'
        }`}
      >
        {diferenca === 0
          ? '—'
          : `${subiu ? '+' : MENOS}${formatarMoeda(centavos(Math.abs(diferenca)))}`}
      </span>
    </li>
  );
}
