import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import type { MovimentoDiario } from '../../db/consultas';
import { movimentoPorDiaDoMes } from '../../db/consultas';
import type { DataISO, MesISO } from '../../types';
import { formatarDataCurta, formatarMoeda, hoje } from '../../types';

interface CalendarioMesProps {
  mes: MesISO;
  diaSelecionado: DataISO | null;
  aoSelecionarDia: (dia: DataISO | null) => void;
}

const CABECALHOS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const;

/**
 * Rampa sequencial de uma cor so (saida), clara -> escura. Sao classes literais
 * de proposito: o Tailwind nao gera classe montada em runtime.
 */
const NIVEIS = [
  'bg-superficie-fundo text-tinta-suave',
  'bg-saida/20 text-tinta',
  'bg-saida/40 text-tinta',
  'bg-saida/70 text-white',
  'bg-saida text-white',
] as const;

/**
 * Heatmap do mes: comparar magnitude numa grade pede escala sequencial de uma
 * cor so. A intensidade da celula e o quanto saiu naquele dia; o ponto verde
 * marca dia com entrada. Tocar um dia filtra a lista abaixo — e a camada de
 * detalhe que substitui o hover num aparelho de toque.
 */
export function CalendarioMes({
  mes,
  diaSelecionado,
  aoSelecionarDia,
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
      className="rounded-2xl border border-superficie-borda bg-superficie p-3 shadow-sm"
    >
      <div className="px-1">
        <h2 className="text-xs font-medium uppercase tracking-wide text-tinta-suave">
          Quando saiu dinheiro
        </h2>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1" role="grid">
        {CABECALHOS.map((rotulo) => (
          <div
            key={rotulo}
            className="pb-1 text-center text-xs font-medium capitalize text-tinta-suave"
          >
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
                className="aspect-square animate-pulse rounded-lg bg-superficie-fundo"
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

      <div className="mt-3 min-h-[2.5rem] rounded-xl bg-superficie-fundo px-3 py-2">
        {selecionado === undefined ? (
          <Legenda />
        ) : (
          <p className="text-xs text-tinta">
            <span className="font-semibold">{formatarDataCurta(selecionado.data)}</span>
            <span className="text-tinta-suave"> · </span>
            <span className="text-saida">saiu {formatarMoeda(selecionado.saidas)}</span>
            {selecionado.entradas > 0 ? (
              <>
                <span className="text-tinta-suave"> · </span>
                <span className="text-entrada">entrou {formatarMoeda(selecionado.entradas)}</span>
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
  const tom = NIVEIS[nivel] ?? NIVEIS[0];
  const contorno = estaSelecionado
    ? 'ring-2 ring-tinta border-transparent'
    : ehHoje
      ? 'border-tinta-suave'
      : 'border-transparent';

  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={estaSelecionado}
      aria-label={descrever(dia, ehHoje)}
      className={`flex aspect-square w-full flex-col items-center justify-center rounded-lg border ${tom} ${contorno}`}
    >
      <span className={`text-sm tabular-nums ${ehHoje ? 'font-bold' : 'font-medium'}`}>
        {dia.dia}
      </span>
      <span
        aria-hidden="true"
        className={`mt-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-superficie ${
          dia.entradas > 0 ? 'bg-entrada' : 'bg-transparent ring-transparent'
        }`}
      />
    </button>
  );
}

function Legenda(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-tinta-suave">
      <span className="flex items-center gap-1">
        menos
        <span className="h-2.5 w-2.5 rounded-sm bg-saida/20" />
        <span className="h-2.5 w-2.5 rounded-sm bg-saida/40" />
        <span className="h-2.5 w-2.5 rounded-sm bg-saida/70" />
        <span className="h-2.5 w-2.5 rounded-sm bg-saida" />
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
