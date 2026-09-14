import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import type { MovimentoDiario } from '../../db/consultas';
import { movimentoPorDiaDoMes } from '../../db/consultas';
import type { DataISO, MesISO } from '../../types';
import type { Textos } from '../../i18n';
import { useTextos } from '../../i18n';
import { formatarDataCurta, formatarMoeda, hoje } from '../../types';

interface CalendarioMesProps {
  mes: MesISO;
  diaSelecionado: DataISO | null;
  aoSelecionarDia: (dia: DataISO | null) => void;
  className?: string;
}

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
  'flex aspect-square min-h-toque w-full flex-col items-center justify-center gap-0.5 rounded-lg border md:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

/**
 * Heatmap do mes ao lado do extrato dos dias que pesaram.
 *
 * A grade responde QUANDO o dinheiro saiu: comparar magnitude numa matriz de
 * datas pede escala sequencial de uma cor so, e a posicao ja carrega a data.
 * A celula nao mostra valor — trinta numeros de quatro digitos espalhados pela
 * grade competem entre si e apagam justamente o padrao que o heatmap existe
 * para revelar. QUANTO fica na lateral, em ordem de peso, onde os valores ficam
 * alinhados numa coluna so e da para ler cada um inteiro.
 *
 * As duas metades sao o mesmo dado e o mesmo controle: clicar na celula ou na
 * linha da lateral filtra o extrato do mes por aquele dia.
 */
export function CalendarioMes({
  mes,
  diaSelecionado,
  aoSelecionarDia,
  className = '',
}: CalendarioMesProps): React.JSX.Element {
  const dias = useLiveQuery(() => movimentoPorDiaDoMes(mes), [mes]);
  const dataDeHoje = hoje();
  const t = useTextos();

  const maiorSaida =
    dias === undefined ? 0 : dias.reduce<number>((maior, dia) => Math.max(maior, dia.saidas), 0);

  const vaziosIniciais = dias === undefined ? 0 : indiceDaSemana(primeiraData(dias));

  const alternarDia = (dia: DataISO): void => {
    aoSelecionarDia(dia === diaSelecionado ? null : dia);
  };

  return (
    <section
      aria-label={t.inicio.calendario}
      className={`rounded-xl border border-superficie-borda bg-superficie p-4 md:p-5 lg:p-6 ${className}`}
    >
      <h2 className="text-rotulo font-medium text-tinta-suave">{t.inicio.quandoSaiu}</h2>

      {/* Lateral a partir de md; no celular ela vira a secao de baixo, que e a
          mesma leitura em coluna unica. */}
      <div className="mt-3 grid gap-5 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-6">
        <div>
          <div className="grid grid-cols-7 gap-1 md:gap-1.5" role="grid">
            {t.inicio.diasDaSemana.map((rotulo) => (
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
                    textos={t}
                    aoTocar={() => {
                      alternarDia(dia.data);
                    }}
                  />
                ))}
          </div>

          <Legenda />
        </div>

        <DiasQuePesaram
          dias={dias}
          maiorSaida={maiorSaida}
          diaSelecionado={diaSelecionado}
          aoSelecionarDia={alternarDia}
        />
      </div>
    </section>
  );
}

interface DiasQuePesaramProps {
  dias: readonly MovimentoDiario[] | undefined;
  maiorSaida: number;
  diaSelecionado: DataISO | null;
  aoSelecionarDia: (dia: DataISO) => void;
}

/**
 * A lateral: os dias com saida, do mais pesado para o mais leve. Ordem de peso e
 * nao cronologica de proposito — a cronologia ja esta desenhada na grade ao
 * lado, e repetir a mesma ordem aqui gastaria a lateral dizendo duas vezes a
 * mesma coisa.
 */
function DiasQuePesaram({
  dias,
  maiorSaida,
  diaSelecionado,
  aoSelecionarDia,
}: DiasQuePesaramProps): React.JSX.Element {
  const t = useTextos();

  if (dias === undefined) {
    return <div className="h-40 animate-pulse rounded-lg bg-superficie-fundo" aria-hidden="true" />;
  }

  const comSaida = dias.filter((dia) => dia.saidas > 0).sort((a, b) => b.saidas - a.saidas);

  return (
    <div className="min-w-0 md:border-l md:border-superficie-borda md:pl-5">
      <h3 className="text-xs font-medium text-tinta-suave">{t.inicio.diasQuePesaram}</h3>

      {comSaida.length === 0 ? (
        <p className="mt-3 text-sm text-tinta-suave">{t.inicio.semSaidaNoMes}</p>
      ) : (
        <ul className="mt-2 max-h-[17.5rem] space-y-0.5 overflow-y-auto">
          {comSaida.map((dia) => (
            <LinhaDoDia
              key={dia.data}
              dia={dia}
              maiorSaida={maiorSaida}
              estaSelecionado={dia.data === diaSelecionado}
              aoTocar={() => {
                aoSelecionarDia(dia.data);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface LinhaDoDiaProps {
  dia: MovimentoDiario;
  maiorSaida: number;
  estaSelecionado: boolean;
  aoTocar: () => void;
}

function LinhaDoDia({
  dia,
  maiorSaida,
  estaSelecionado,
  aoTocar,
}: LinhaDoDiaProps): React.JSX.Element {
  const proporcao = maiorSaida === 0 ? 0 : (dia.saidas / maiorSaida) * 100;

  return (
    <li>
      <button
        type="button"
        onClick={aoTocar}
        aria-pressed={estaSelecionado}
        aria-label={`${formatarDataCurta(dia.data)}, ${formatarMoeda(dia.saidas)}`}
        className={`relative flex min-h-toque w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left md:min-h-0 md:py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-1 ${
          estaSelecionado ? 'bg-marca-suave' : 'md:hover:bg-superficie-fundo'
        }`}
      >
        {/* A barra e a segunda codificacao da mesma proporcao: o olho compara
            comprimento mais rapido do que le quatro digitos em sequencia. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 bg-saida-calor1"
          style={{ width: `${proporcao.toFixed(2)}%` }}
        />
        <span
          className={`relative w-10 shrink-0 text-xs tabular-nums ${
            estaSelecionado ? 'font-semibold text-marca' : 'text-tinta-suave'
          }`}
        >
          {formatarDataCurta(dia.data)}
        </span>
        <span className="relative flex-1 text-right text-sm font-medium tabular-nums text-tinta">
          {formatarMoeda(dia.saidas)}
        </span>
      </button>
    </li>
  );
}

function Legenda(): React.JSX.Element {
  const t = useTextos();

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-tinta-suave">
      <span className="flex items-center gap-1">
        {t.inicio.menos}
        <span className="h-2.5 w-2.5 rounded-sm bg-saida-calor1" />
        <span className="h-2.5 w-2.5 rounded-sm bg-saida-calor2" />
        <span className="h-2.5 w-2.5 rounded-sm bg-saida-calor3" />
        <span className="h-2.5 w-2.5 rounded-sm bg-saida-calor4" />
        {t.inicio.maisSaida}
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-entrada" />
        {t.inicio.teveEntrada}
      </span>
    </div>
  );
}

interface CelulaDoDiaProps {
  dia: MovimentoDiario;
  nivel: number;
  ehHoje: boolean;
  estaSelecionado: boolean;
  /** Passados por prop: sao ate 31 celulas, e 31 assinaturas da loja custariam caro. */
  textos: Textos;
  aoTocar: () => void;
}

function CelulaDoDia({
  dia,
  nivel,
  ehHoje,
  estaSelecionado,
  textos,
  aoTocar,
}: CelulaDoDiaProps): React.JSX.Element {
  // Selecao e ACAO, nao estado financeiro: usa o accent de marca, nunca um tom
  // mais forte da rampa — senao "selecionado" leria como "gastou muito".
  const tom = estaSelecionado
    ? 'bg-marca-suave border-marca-borda text-marca'
    : `${NIVEIS[nivel] ?? NIVEIS[0]} ${ehHoje ? 'border-tinta-suave' : 'border-transparent'}`;

  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={estaSelecionado}
      aria-label={descrever(dia, ehHoje, textos)}
      className={`${CELULA} ${tom}`}
    >
      <span className={`text-sm tabular-nums ${ehHoje ? 'font-bold' : 'font-medium'}`}>
        {dia.dia}
      </span>

      {/* Entrada nao entra na rampa (que e de saidas) e sumiria se dependesse so
          da cor de fundo. O ponto e o unico marcador que ela tem na grade. */}
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ring-1 ring-superficie ${
          dia.entradas > 0 ? 'bg-entrada' : 'bg-transparent ring-transparent'
        }`}
      />
    </button>
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

function descrever(dia: MovimentoDiario, ehHoje: boolean, t: Textos): string {
  if (dia.quantidade === 0) {
    return t.inicio.diaSemMovimento(dia.dia, ehHoje);
  }

  const partes = [t.inicio.dia(dia.dia, ehHoje)];
  if (dia.saidas > 0) {
    partes.push(`${t.comum.saiu} ${formatarMoeda(dia.saidas)}`);
  }
  if (dia.entradas > 0) {
    partes.push(`${t.comum.entrou} ${formatarMoeda(dia.entradas)}`);
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
