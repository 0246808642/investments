import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import { indexarPorId, listarCategorias, listarTransacoesDoMes } from '../../db/consultas';
import type { Categoria, DataISO, MesISO, Transacao } from '../../types';
import { MENOS, formatarDataCurta, formatarMesExtenso, formatarMoeda } from '../../types';

interface ListaTransacoesProps {
  mes: MesISO;
  diaSelecionado: DataISO | null;
  aoLimparFiltro: () => void;
  className?: string;
}

/** Espelha o token `categoria.outros`; entra como dado, igual ao que vem do banco. */
const COR_SEM_CATEGORIA = '#94a3b8';

/**
 * Lancamentos do mes, do mais recente para o mais antigo. E a estrutura
 * PRIMARIA no desktop — nao o grafico — e por isso fica mais densa conforme a
 * tela cresce, nao mais solta: mais linhas visiveis sem rolar e o unico ganho
 * real de uma tabela larga. Em xl a largura extra vira coluna (data e
 * categoria saem da linha de meta e ganham lugar proprio), nao espaco em branco.
 */
export function ListaTransacoes({
  mes,
  diaSelecionado,
  aoLimparFiltro,
  className = '',
}: ListaTransacoesProps): React.JSX.Element {
  const transacoes = useLiveQuery(() => listarTransacoesDoMes(mes), [mes]);
  const categorias = useLiveQuery(() => listarCategorias(), []);
  const porId = indexarPorId<Categoria>(categorias ?? []);

  const visiveis =
    transacoes === undefined
      ? []
      : diaSelecionado === null
        ? transacoes
        : transacoes.filter((transacao) => transacao.data === diaSelecionado);

  return (
    <section
      aria-label="Lançamentos do mês"
      className={`rounded-xl border border-superficie-borda bg-superficie p-4 md:p-5 lg:p-6 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-rotulo font-medium text-tinta-suave">
          {diaSelecionado === null
            ? 'Lançamentos do mês'
            : `Lançamentos de ${formatarDataCurta(diaSelecionado)}`}
        </h2>
        {diaSelecionado === null ? null : (
          <button
            type="button"
            onClick={aoLimparFiltro}
            className="-mr-2 flex min-h-toque items-center rounded-lg px-2 text-sm font-medium text-tinta-suave active:text-tinta md:min-h-0 md:py-1 md:hover:bg-superficie-fundo md:hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
          >
            Ver o mês todo
          </button>
        )}
      </div>

      <div className="mt-2">
        {transacoes === undefined ? (
          <div className="h-20 animate-pulse rounded-lg bg-superficie-fundo" />
        ) : visiveis.length === 0 ? (
          <Vazio
            texto={
              diaSelecionado === null
                ? `Nenhum lançamento em ${nomeDoMes(mes)}.`
                : `Nenhum lançamento em ${formatarDataCurta(diaSelecionado)}.`
            }
          />
        ) : (
          <ul className="divide-y divide-superficie-borda">
            {visiveis.map((transacao) => (
              <Linha
                key={transacao.id}
                transacao={transacao}
                categoria={porId.get(transacao.categoriaId)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface LinhaProps {
  transacao: Transacao;
  categoria: Categoria | undefined;
}

function Linha({ transacao, categoria }: LinhaProps): React.JSX.Element {
  const ehEntrada = transacao.tipo === 'entrada';
  const descricao = transacao.descricao.trim();
  const nomeDaCategoria = categoria?.nome ?? 'Sem categoria';

  // Saida usa text-tinta com o menos tipografico: sao ~90% das linhas e pintar
  // todas de vermelho faz o extrato inteiro parecer alarme. So a entrada, que e
  // rara, ganha cor.
  const corDoValor = ehEntrada ? 'text-entrada' : 'text-tinta';

  return (
    <li className="flex min-h-toque items-center gap-3 py-3 md:-mx-2 md:min-h-0 md:rounded-lg md:px-2 md:py-2.5 md:hover:bg-superficie-fundo lg:py-2">
      <span
        aria-hidden="true"
        className="h-7 w-1.5 shrink-0 rounded-md"
        style={{ backgroundColor: categoria?.cor ?? COR_SEM_CATEGORIA }}
      />

      <span className="hidden w-12 shrink-0 text-xs tabular-nums text-tinta-suave xl:block">
        {formatarDataCurta(transacao.data)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-tinta">
          {descricao === '' ? nomeDaCategoria : descricao}
        </p>
        {/* Em xl a meta vira coluna; manter as duas seria dizer a mesma coisa duas vezes. */}
        <p className="truncate text-xs tabular-nums text-tinta-suave xl:hidden">
          {nomeDaCategoria} · {formatarDataCurta(transacao.data)}
        </p>
      </div>

      <span className="hidden w-32 shrink-0 truncate text-sm text-tinta-suave xl:block">
        {nomeDaCategoria}
      </span>

      <span
        className={`w-28 shrink-0 text-right text-valor font-semibold tabular-nums md:w-32 ${corDoValor}`}
      >
        {ehEntrada ? '+' : MENOS}
        {formatarMoeda(transacao.valor)}
      </span>
    </li>
  );
}

function Vazio({ texto }: { texto: string }): React.JSX.Element {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-tinta-suave">{texto}</p>
    </div>
  );
}

/** '2026-09' -> "setembro". O ano ja esta no cabecalho da tela. */
function nomeDoMes(mes: MesISO): string {
  return formatarMesExtenso(mes).replace(/ de \d{4}$/, '');
}
