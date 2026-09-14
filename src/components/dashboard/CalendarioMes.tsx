import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import type { MovimentoDiario } from '../../db/consultas';
import { movimentoPorDiaDoMes } from '../../db/consultas';
import type { DataISO, MesISO } from '../../types';
import { formatarCompacto, formatarDataCurta, formatarMoeda, hoje, subtrair } from '../../types';

interface CalendarioMesProps {
  mes: MesISO;
  diaSelecionado: DataISO | null;
  aoSelecionarDia: (dia: DataISO | null) => void;
  className?: string;
}

const CABECALHOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

/**
 * Rampa sequencial de uma cor so (saida), clara -> escura, em TOKENS e nao em
 * bg-saida/20: opacidade compoe com o fundo, e no dia em que existir modo
 * escuro cada degrau teria de ser recalculado. Classes literais de proposito —
 * o Tailwind nao gera classe montada em runtime.
 */
const NIVEIS = [
  'bg-superficie-fundo text-tinta-suave',
  'bg-saida-calor1 text-tinta',
  'bg-saida-calor2 text-tinta',
  'bg-saida-calor3 text-tinta',
  'bg-saida-calor4 text-tinta',
] as const;

const CELULA =
  'flex aspect-square min-h-toque w-full flex-col items-center justify-center rounded-lg border md:min-h-0 lg:aspect-auto lg:min-h-[60px] lg:items-start lg:justify-between lg:p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

/**
 * Heatmap do mes: comparar magnitude numa grade pede escala sequencial de uma
 * cor so. A intensidade da celula e o quanto saiu naquele dia. Tocar um dia
 * filtra a lista — e a camada de detalhe que substitui o hover no toque.
 *
 * Em lg a celula deixa de ser quadrada (quadrado em 500px de largura vira caixa
 * de 68px quase vazia) e o ponto de 6px cede lugar ao valor liquido em forma
 * compacta: o ponto so existia porque numero nao cabia.
 */
export function CalendarioMes({
  mes,
  diaSelecionado,
  aoSelecionarDia,
  className = '',
}: CalendarioMesProps): React.JSX.Element {
  const dias = useLiveQuery(() => movimentoPorDiaDoMes(mes), [mes]);
  const dataDeHoje = hoje();

  const maiorSaida =
    dias === undefined ? 0 : dias.reduce<number>((maior, dia) => Math.max(maior, dia.saidas), 0);

  const selecionado =
    dias === undefined || diaSelecionado === null
      ? undefined
      : dias.find((dia) => dia.data === diaSelecionado);

  const vaziosIniciais = dias === undefined ? 0 : indiceDaSemana(primeiraData(dias));

  return (
    <section
      aria-label="Calendário do mês"
      className={`rounded-xl border border-superficie-borda bg-superficie p-4 md:p-5 lg:p-6 ${className}`}
    >
      <h2 className="text-rotulo font-medium text-tinta-suave">Quando saiu dinheiro</h2>

      <div className="mt-3 grid grid-cols-7 gap-1 md:gap-1.5 lg:gap-2" role="grid">
        {CABECALHOS.map((rotulo) => (
          <div key={rotulo} className="pb-1 text-center text-xs font-medium text-tinta-suave">
            {rotulo}
          </div>
        ))}

        {Array.from({ length: vaziosIniciais }, (_, indice) => (
          <div key={`vazio-${indice.toString()}`} aria-hidden="true" />
        ))}

        {dias === undefined
          ? Array.from({ length: 30 }, (_, indice) => (
              <div
                key={`carregando-${indice.toString()}`}
                className="aspect-square animate-pulse rounded-lg bg-superficie-fundo lg:aspect-auto lg:min-h-[60px]"
              />
            ))
          : dias.map((dia) => (
              <CelulaDoDia
                key={dia.data}
                dia={dia}
                nivel={nivelDaSaida(dia.saidas, maiorSaida)}
                ehHoje={dia.data === dataDeHoje}
                estaSelecionado={dia.data === diaSelecionado}
                aoTocar={() => {
                  aoSelecionarDia(dia.data === diaSelecionado ? null : dia.data);
                }}
              />
            ))}
      </div>

      {/* Em lg a lista filtrada fica ao lado e esta tira vira redundante: some e
          devolve ~60px de altura ao calendario. */}
      <div className="mt-3 min-h-[2.5rem] rounded-lg bg-superficie-fundo px-3 py-2 lg:hidden">
        {selecionado === undefined ? (
          <Legenda />
        ) : (
          <p className="text-xs text-tinta">
            <span className="font-semibold tabular-nums">{formatarDataCurta(selecionado.data)}</span>
            <span className="text-tinta-suave"> · </span>
            <span className="tabular-nums text-saida">saiu {formatarMoeda(selecionado.saidas)}</span>
            {selecionado.entradas > 0 ? (
              <>
                <span className="text-tinta-suave"> · </span>
                <span className="tabular-nums text-entrada">
                  entrou {formatarMoeda(selecionado.entradas)}
                </span>
              </>
            ) : null}
          </p>
        )}
      </div>
    </section>
  );
}

interface CelulaDoDiaProps {
  dia: MovimentoDiario;
  nivel: number;
  ehHoje: boolean;
  estaSelecionado: boolean;
  aoTocar: () => void;
}

function CelulaDoDia({
  dia,
  nivel,
  ehHoje,
  estaSelecionado,
  aoTocar,
}: CelulaDoDiaProps): React.JSX.Element {
  // Selecao e ACAO, nao estado financeiro: usa o accent de marca, nunca um tom
  // mais forte da rampa — senao "selecionado" leria como "gastou muito".
  const tom = estaSelecionado
    ? 'bg-marca-suave border-marca-borda text-marca'
    : `${NIVEIS[nivel] ?? NIVEIS[0]} ${ehHoje ? 'border-tinta-suave' : 'border-transparent'}`;

  const liquido = subtrair(dia.entradas, dia.saidas);

  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={estaSelecionado}
      aria-label={descrever(dia, ehHoje)}
      className={`${CELULA} ${tom}`}
    >
      <span className={`text-sm tabular-nums ${ehHoje ? 'font-bold' : 'font-medium'}`}>
        {dia.dia}
      </span>

      <span
        aria-hidden="true"
        className={`mt-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-superficie lg:hidden ${
          dia.entradas > 0 ? 'bg-entrada' : 'bg-transparent ring-transparent'
        }`}
      />

      <span
        aria-hidden="true"
        className="hidden self-end text-[11px] tabular-nums text-tinta-suave lg:block"
      >
        {formatarCompacto(liquido)}
      </span>
    </button>
  );
}

function Legenda(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-tinta-suave">
      <span className="flex items-center gap-1">
        menos
        <span className="h-2.5 w-2.5 rounded-sm bg-saida-calor1" />
        <span className="h-2.5 w-2.5 rounded-sm bg-saida-calor2" />
        <span className="h-2.5 w-2.5 rounded-sm bg-saida-calor3" />
        <span className="h-2.5 w-2.5 rounded-sm bg-saida-calor4" />
        mais saída
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-entrada" />
        teve entrada
      </span>
    </div>
  );
}

/** 0 = sem saida; 1..4 = quartis do maior dia do mes. */
function nivelDaSaida(saidas: number, maiorSaida: number): number {
  if (saidas <= 0 || maiorSaida <= 0) {
    return 0;
  }
  const proporcao = saidas / maiorSaida;
  if (proporcao <= 0.25) {
    return 1;
  }
  if (proporcao <= 0.5) {
    return 2;
  }
  if (proporcao <= 0.75) {
    return 3;
  }
  return 4;
}

function descrever(dia: MovimentoDiario, ehHoje: boolean): string {
  const partes = [`Dia ${dia.dia.toString()}${ehHoje ? ' (hoje)' : ''}`];
  if (dia.saidas > 0) {
    partes.push(`saídas ${formatarMoeda(dia.saidas)}`);
  }
  if (dia.entradas > 0) {
    partes.push(`entradas ${formatarMoeda(dia.entradas)}`);
  }
  if (dia.quantidade === 0) {
    partes.push('sem movimento');
  }
  return partes.join(', ');
}

function primeiraData(dias: readonly MovimentoDiario[]): DataISO | null {
  const primeiro = dias.at(0);
  return primeiro === undefined ? null : primeiro.data;
}

/** Segunda = 0 ... domingo = 6. Date local so para o calculo; o dado continua DataISO. */
function indiceDaSemana(data: DataISO | null): number {
  if (data === null) {
    return 0;
  }
  const [ano, mes, dia] = data.split('-').map(Number);
  const referencia = new Date(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1);
  return (referencia.getDay() + 6) % 7;
}
