import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type * as React from 'react';

import {
  excluirTransacao,
  indexarPorId,
  listarCategorias,
  listarTransacoesDoMes,
  resumirMes,
} from '../../db/consultas';
import type { Categoria, DataISO, MesISO, TipoMovimento, Transacao } from '../../types';
import {
  MENOS,
  centavos,
  formatarDataComSemana,
  formatarMesNome,
  formatarMoeda,
  mesAtual,
} from '../../types';
import { CabecalhoMes } from '../dashboard';
import { BotaoExportarPdf } from '../impressao';
import { useAbrirLancamento } from '../lancamento';
import { useTextos } from '../../i18n';

/** Espelha o token `categoria.outros`; entra como dado, igual ao que vem do banco. */
const COR_SEM_CATEGORIA = '#94a3b8';

type FiltroDeTipo = TipoMovimento | 'todos';

const ANEL_FOCO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

/**
 * Extrato do mes inteiro, agrupado por dia.
 *
 * A diferenca para o card da tela inicial nao e tamanho, e proposito: la a lista
 * e a evidencia ao lado do calendario e do grafico, e cabe em cinco linhas; aqui
 * ela E a tela, entao ganha filtro, cabecalho de dia com o total do dia, e o
 * unico lugar do app onde da para apagar um lancamento.
 */
export function PaginaLancamentos(): React.JSX.Element {
  const [mes, setMes] = useState<MesISO>(() => mesAtual());
  const [tipo, setTipo] = useState<FiltroDeTipo>('todos');
  const [categoriaId, setCategoriaId] = useState<string>('todas');

  const transacoes = useLiveQuery(() => listarTransacoesDoMes(mes), [mes]);
  const categorias = useLiveQuery(() => listarCategorias(), []);
  const porId = indexarPorId<Categoria>(categorias ?? []);
  const t = useTextos();

  const visiveis = (transacoes ?? []).filter(
    (transacao) =>
      (tipo === 'todos' || transacao.tipo === tipo) &&
      (categoriaId === 'todas' || transacao.categoriaId === categoriaId),
  );

  const resumo = resumirMes(visiveis);
  const dias = agruparPorDia(visiveis);
  const filtrando = tipo !== 'todos' || categoriaId !== 'todas';

  return (
    <div className="pb-[calc(6rem_+_env(safe-area-inset-bottom))] md:pb-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CabecalhoMes
          mes={mes}
          aoMudarMes={(proximo) => {
            setMes(proximo);
          }}
          className="min-w-[16rem] flex-1"
        />
        <BotaoExportarPdf mes={mes} />
      </div>

      <section
        aria-label={t.extrato.filtros}
        className="rounded-xl border border-superficie-borda bg-superficie p-4 md:p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Filtro
            rotulo={t.extrato.tudo}
            selecionado={tipo === 'todos'}
            aoTocar={() => {
              setTipo('todos');
            }}
          />
          <Filtro
            rotulo={t.extrato.soSaidas}
            selecionado={tipo === 'saida'}
            aoTocar={() => {
              setTipo('saida');
            }}
          />
          <Filtro
            rotulo={t.extrato.soEntradas}
            selecionado={tipo === 'entrada'}
            aoTocar={() => {
              setTipo('entrada');
            }}
          />

          {/*
            Largura DEFINIDA, e nao `ml-auto` com filho `w-full`: item flex de
            largura automatica cujo filho pede 100% forma um ciclo de medicao, e
            num container `flex-wrap` esse ciclo empata com a barra de rolagem
            (a pagina cresce, a barra aparece, a linha reflui, a barra some) ate
            travar o layout. Foi exatamente o que congelava esta tela.
          */}
          <label className="w-full sm:ml-auto sm:w-56">
            <span className="sr-only">{t.extrato.filtrarPorCategoria}</span>
            <select
              value={categoriaId}
              onChange={(evento) => {
                setCategoriaId(evento.target.value);
              }}
              /* text-base abaixo de md e obrigatorio: com fonte menor que 16px
                 o iOS da auto-zoom ao focar o campo e a tela fica torta. */
              className={`min-h-toque w-full rounded-lg border border-superficie-borda bg-superficie px-3 text-base text-tinta md:min-h-0 md:py-2 md:text-sm ${ANEL_FOCO}`}
            >
              <option value="todas">{t.extrato.todasCategorias}</option>
              {(categorias ?? []).map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-superficie-borda pt-4">
          <Total
            rotulo={t.comum.entrou}
            valor={formatarMoeda(resumo.entradas)}
            classe="text-entrada"
          />
          <Total rotulo={t.comum.saiu} valor={formatarMoeda(resumo.saidas)} classe="text-saida" />
          <p className="ml-auto text-xs tabular-nums text-tinta-fraca">
            {t.comum.lancamentos(visiveis.length)}
          </p>
        </div>
      </section>

      {transacoes === undefined ? (
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-superficie" />
      ) : dias.length === 0 ? (
        <Vazio mes={mes} filtrando={filtrando} />
      ) : (
        <div className="mt-4 space-y-4">
          {dias.map((dia) => (
            <GrupoDoDia key={dia.data} dia={dia} porId={porId} />
          ))}
        </div>
      )}
    </div>
  );
}

interface TotalProps {
  rotulo: string;
  valor: string;
  classe: string;
}

function Total({ rotulo, valor, classe }: TotalProps): React.JSX.Element {
  return (
    <p className="text-sm text-tinta-suave">
      {rotulo} <span className={`font-semibold tabular-nums ${classe}`}>{valor}</span>
    </p>
  );
}

interface FiltroProps {
  rotulo: string;
  selecionado: boolean;
  aoTocar: () => void;
}

function Filtro({ rotulo, selecionado, aoTocar }: FiltroProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={selecionado}
      className={`min-h-toque shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors md:min-h-0 md:py-2 ${ANEL_FOCO} ${
        selecionado
          ? 'border-marca-borda bg-marca-suave text-marca'
          : 'border-superficie-borda bg-superficie text-tinta-suave md:hover:border-superficie-forte md:hover:text-tinta'
      }`}
    >
      {rotulo}
    </button>
  );
}

interface DiaAgrupado {
  data: DataISO;
  itens: Transacao[];
  liquido: number;
}

interface GrupoDoDiaProps {
  dia: DiaAgrupado;
  porId: Map<string, Categoria>;
}

/**
 * Cabecalho por dia com o liquido do dia. O extrato de um mes inteiro sem
 * quebra vira uma coluna de sessenta linhas iguais; a data repetida em cada uma
 * ocupa espaco e mesmo assim nao forma bloco.
 */
function GrupoDoDia({ dia, porId }: GrupoDoDiaProps): React.JSX.Element {
  return (
    <section
      aria-label={formatarDataComSemana(dia.data)}
      className="rounded-xl border border-superficie-borda bg-superficie"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-superficie-borda px-4 py-2.5 md:px-5">
        <h2 className="text-rotulo font-medium text-tinta">{formatarDataComSemana(dia.data)}</h2>
        <p
          className={`text-xs tabular-nums ${dia.liquido < 0 ? 'text-tinta-suave' : 'text-entrada'}`}
        >
          {dia.liquido < 0 ? MENOS : '+'}
          {formatarMoeda(centavos(Math.abs(dia.liquido)))}
        </p>
      </div>

      <ul className="divide-y divide-superficie-borda px-4 md:px-5">
        {dia.itens.map((transacao) => (
          <Linha
            key={transacao.id}
            transacao={transacao}
            categoria={porId.get(transacao.categoriaId)}
          />
        ))}
      </ul>
    </section>
  );
}

interface LinhaProps {
  transacao: Transacao;
  categoria: Categoria | undefined;
}

function Linha({ transacao, categoria }: LinhaProps): React.JSX.Element {
  const [confirmando, setConfirmando] = useState(false);
  const t = useTextos();

  const ehEntrada = transacao.tipo === 'entrada';
  const descricao = transacao.descricao.trim();
  const nomeDaCategoria = categoria?.nome ?? t.comum.semCategoria;

  return (
    <li className="flex min-h-toque items-center gap-3 py-3 md:py-2.5">
      <span
        aria-hidden="true"
        className="h-7 w-1.5 shrink-0 rounded-md"
        style={{ backgroundColor: categoria?.cor ?? COR_SEM_CATEGORIA }}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-tinta">
          {descricao === '' ? nomeDaCategoria : descricao}
        </p>
        {descricao === '' ? null : (
          <p className="truncate text-xs text-tinta-suave">{nomeDaCategoria}</p>
        )}
      </div>

      {/*
        Confirmacao dentro da propria linha, e nao um window.confirm: o dialogo
        do navegador trava a pagina inteira e nao diz QUAL lancamento vai embora.
        Aqui a linha que some e a que esta perguntando.
      */}
      {confirmando ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void excluirTransacao(transacao.id)}
            className={`min-h-toque rounded-lg bg-saida px-3 text-sm font-semibold text-superficie shadow-sm md:min-h-0 md:py-1.5 ${ANEL_FOCO}`}
          >
            {t.comum.excluir}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmando(false);
            }}
            className={`min-h-toque rounded-lg px-2 text-sm font-medium text-tinta-suave md:min-h-0 md:py-1.5 md:hover:text-tinta ${ANEL_FOCO}`}
          >
            {t.comum.cancelar}
          </button>
        </div>
      ) : (
        <>
          <span
            className={`shrink-0 text-right text-valor font-semibold tabular-nums ${
              ehEntrada ? 'text-entrada' : 'text-tinta'
            }`}
          >
            {ehEntrada ? '+' : MENOS}
            {formatarMoeda(transacao.valor)}
          </span>

          <button
            type="button"
            onClick={() => {
              setConfirmando(true);
            }}
            aria-label={t.extrato.excluirItem(descricao === '' ? nomeDaCategoria : descricao)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-tinta-fraca md:hover:bg-superficie-fundo md:hover:text-saida ${ANEL_FOCO}`}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
            </svg>
          </button>
        </>
      )}
    </li>
  );
}

interface VazioProps {
  mes: MesISO;
  filtrando: boolean;
}

function Vazio({ mes, filtrando }: VazioProps): React.JSX.Element {
  const abrir = useAbrirLancamento();
  const t = useTextos();

  return (
    <div className="mt-4 rounded-xl border border-superficie-borda bg-superficie py-12 text-center">
      <p className="text-sm text-tinta-suave">
        {filtrando ? t.extrato.semResultado : t.inicio.nadaEm(formatarMesNome(mes))}
      </p>
      {filtrando ? null : (
        <button
          type="button"
          onClick={abrir}
          className={`mt-3 inline-flex min-h-toque items-center rounded-lg border border-superficie-forte bg-superficie px-4 text-sm font-medium text-tinta md:min-h-0 md:py-2 md:hover:bg-superficie-fundo ${ANEL_FOCO}`}
        >
          {t.inicio.lancarPrimeiro}
        </button>
      )}
    </div>
  );
}

/** As transacoes ja vem do mais recente para o mais antigo; o agrupamento preserva a ordem. */
function agruparPorDia(transacoes: readonly Transacao[]): DiaAgrupado[] {
  const dias: DiaAgrupado[] = [];

  for (const transacao of transacoes) {
    const atual = dias.at(-1);
    const delta = transacao.tipo === 'entrada' ? transacao.valor : -transacao.valor;

    if (atual !== undefined && atual.data === transacao.data) {
      atual.itens.push(transacao);
      atual.liquido += delta;
      continue;
    }
    dias.push({ data: transacao.data, itens: [transacao], liquido: delta });
  }

  return dias;
}
