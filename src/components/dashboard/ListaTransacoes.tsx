import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import { indexarPorId, listarCategorias, listarTransacoesDoMes } from '../../db/consultas';
import type { Categoria, DataISO, MesISO, Transacao } from '../../types';
import { MENOS, formatarDataCurta, formatarMesNome, formatarMoeda } from '../../types';
import { useAbrirLancamento } from '../lancamento';
import { useTextos } from '../../i18n';

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
 * PRIMARIA da tela: o calendario ao lado e o filtro dela, e toda pergunta que
 * comeca no grafico ou na trilha termina aqui, numa linha com nome e valor.
 *
 * A linha e compacta e de duas alturas (descricao em cima, categoria e data
 * embaixo) em qualquer largura. A versao em colunas so existia para gastar a
 * largura de um card de 7/12; agora o card tem 5/12 e a linha dupla le melhor
 * do que quatro colunas espremidas.
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
  const t = useTextos();

  const visiveis =
    transacoes === undefined
      ? []
      : diaSelecionado === null
        ? transacoes
        : transacoes.filter((transacao) => transacao.data === diaSelecionado);

  return (
    <section
      aria-label={t.inicio.lancamentosDoMes}
      className={`rounded-xl border border-superficie-borda bg-superficie p-4 md:p-5 lg:p-6 ${className}`}
    >
      <div className="flex min-h-[1.75rem] items-center justify-between gap-2">
        <h2 className="text-rotulo font-medium text-tinta-suave">
          {diaSelecionado === null
            ? t.inicio.lancamentosDoMes
            : t.inicio.lancamentosDe(formatarDataCurta(diaSelecionado))}
        </h2>

        {diaSelecionado === null ? (
          visiveis.length === 0 ? null : (
            <p className="shrink-0 text-xs tabular-nums text-tinta-fraca">
              {t.comum.lancamentos(visiveis.length)}
            </p>
          )
        ) : (
          <button
            type="button"
            onClick={aoLimparFiltro}
            className="-mr-2 flex min-h-toque shrink-0 items-center rounded-lg px-2 text-sm font-medium text-marca active:bg-marca-suave md:min-h-0 md:py-1 md:hover:bg-marca-suave focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
          >
            {t.inicio.verMesTodo}
          </button>
        )}
      </div>

      <div className="mt-2">
        {transacoes === undefined ? (
          <div className="h-20 animate-pulse rounded-lg bg-superficie-fundo" />
        ) : visiveis.length === 0 ? (
          <Vazio mes={mes} diaSelecionado={diaSelecionado} />
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
  const t = useTextos();
  const nomeDaCategoria = categoria?.nome ?? t.comum.semCategoria;

  // Saida usa text-tinta com o menos tipografico: sao ~90% das linhas e pintar
  // todas de vermelho faz o extrato inteiro parecer alarme. So a entrada, que e
  // rara, ganha cor.
  const corDoValor = ehEntrada ? 'text-entrada' : 'text-tinta';

  return (
    <li className="flex min-h-toque items-center gap-3 py-3 md:-mx-2 md:min-h-0 md:rounded-lg md:px-2 md:py-2.5 md:hover:bg-superficie-fundo">
      <span
        aria-hidden="true"
        className="h-7 w-1.5 shrink-0 rounded-md"
        style={{ backgroundColor: categoria?.cor ?? COR_SEM_CATEGORIA }}
      />

      <span className="w-9 shrink-0 text-xs tabular-nums text-tinta-fraca">
        {formatarDataCurta(transacao.data)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-tinta">
          {descricao === '' ? nomeDaCategoria : descricao}
        </p>
        {/* A categoria so repete a descricao quando o usuario nao escreveu nada;
            nesse caso ela ja subiu para a linha de cima e some daqui. */}
        {descricao === '' ? null : (
          <p className="truncate text-xs text-tinta-suave">{nomeDaCategoria}</p>
        )}
      </div>

      <span className={`shrink-0 text-right text-valor font-semibold tabular-nums ${corDoValor}`}>
        {ehEntrada ? '+' : MENOS}
        {formatarMoeda(transacao.valor)}
      </span>
    </li>
  );
}

interface VazioProps {
  mes: MesISO;
  diaSelecionado: DataISO | null;
}

/**
 * Tela vazia e convite, nao aviso. O texto diz o que falta e o botao faz — sem
 * ele, o unico caminho a partir daqui era procurar o "Novo lancamento" no canto
 * oposto da tela.
 */
function Vazio({ mes, diaSelecionado }: VazioProps): React.JSX.Element {
  const abrir = useAbrirLancamento();
  const t = useTextos();

  return (
    <div className="py-10 text-center">
      <p className="text-sm text-tinta-suave">
        {diaSelecionado === null
          ? t.inicio.nadaEm(formatarMesNome(mes))
          : t.inicio.nadaNoDia(formatarDataCurta(diaSelecionado))}
      </p>
      <button
        type="button"
        onClick={abrir}
        className="mt-3 inline-flex min-h-toque items-center rounded-lg border border-superficie-forte bg-superficie px-4 text-sm font-medium text-tinta active:bg-superficie-fundo md:min-h-0 md:py-2 md:hover:bg-superficie-fundo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
      >
        {t.inicio.lancarPrimeiro}
      </button>
    </div>
  );
}
