import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import { indexarPorId, listarCategorias, listarTransacoesDoMes } from '../../db/consultas';
import type { Categoria, DataISO, MesISO, Transacao } from '../../types';
import { formatarDataCurta, formatarMoeda } from '../../types';

interface ListaTransacoesProps {
  mes: MesISO;
  diaSelecionado: DataISO | null;
  aoLimparFiltro: () => void;
}

const COR_SEM_CATEGORIA = '#94a3b8';

/** Lancamentos do mes, do mais recente para o mais antigo. */
export function ListaTransacoes({
  mes,
  diaSelecionado,
  aoLimparFiltro,
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
    <section aria-label="Lançamentos do mês" className="space-y-2">
      <div className="flex min-h-toque items-center justify-between gap-2 px-1">
        <h2 className="text-xs font-medium uppercase tracking-wide text-tinta-suave">
          {diaSelecionado === null
            ? 'Lançamentos do mês'
            : `Lançamentos de ${formatarDataCurta(diaSelecionado)}`}
        </h2>
        {diaSelecionado === null ? null : (
          <button
            type="button"
            onClick={aoLimparFiltro}
            className="flex min-h-toque items-center rounded-xl px-3 text-sm font-medium text-tinta-suave active:text-tinta"
          >
            Ver o mes todo
          </button>
        )}
      </div>

      {transacoes === undefined ? (
        <div className="h-20 animate-pulse rounded-2xl bg-superficie" />
      ) : visiveis.length === 0 ? (
        <Vazio temFiltro={diaSelecionado !== null} />
      ) : (
        <ul className="divide-y divide-superficie-borda overflow-hidden rounded-2xl border border-superficie-borda bg-superficie shadow-sm">
          {visiveis.map((transacao) => (
            <Linha
              key={transacao.id}
              transacao={transacao}
              categoria={porId.get(transacao.categoriaId)}
            />
          ))}
        </ul>
      )}
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

  return (
    <li className="flex min-h-toque items-center gap-3 px-3 py-2.5">
      <span
        aria-hidden="true"
        className="h-8 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: categoria?.cor ?? COR_SEM_CATEGORIA }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-tinta">
          {descricao === '' ? (categoria?.nome ?? 'Sem categoria') : descricao}
        </p>
        <p className="truncate text-xs text-tinta-suave">
          {categoria?.nome ?? 'Sem categoria'} · {formatarDataCurta(transacao.data)}
        </p>
      </div>
      <span
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          ehEntrada ? 'text-entrada' : 'text-saida'
        }`}
      >
        {ehEntrada ? '+' : '-'}
        {formatarMoeda(transacao.valor)}
      </span>
    </li>
  );
}

function Vazio({ temFiltro }: { temFiltro: boolean }): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-dashed border-superficie-borda bg-superficie px-4 py-8 text-center">
      <p className="text-sm font-medium text-tinta">
        {temFiltro ? 'Nenhum lançamento neste dia' : 'Nenhum lançamento ainda'}
      </p>
      <p className="mt-1 text-xs text-tinta-suave">
        {temFiltro
          ? 'Toque no dia de novo para ver o mes inteiro.'
          : 'Use o botao + para registrar a primeira entrada ou saida. O saldo, o grafico e o calendario se preenchem sozinhos.'}
      </p>
    </div>
  );
}
