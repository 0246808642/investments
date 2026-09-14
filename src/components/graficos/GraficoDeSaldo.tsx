import { useId, useState } from 'react';
import type * as React from 'react';

import type { SaldoMensal } from '../../db/consultas';
import type { MesISO } from '../../types';
import { useTextos } from '../../i18n';
import { centavos, formatarMesAbreviado, formatarMesTitulo, formatarMoeda } from '../../types';

interface GraficoDeSaldoProps {
  serie: readonly SaldoMensal[];
  /** Mes em foco no painel: ganha marcacao propria, separada do hover. */
  mesSelecionado?: MesISO;
  /** Quando existe, cada mes vira um alvo de clique que troca o recorte da tela. */
  aoSelecionarMes?: (mes: MesISO) => void;
  /**
   * Liga as linhas de referencia com valor. So vale onde ha altura para elas: num
   * card estreito, quatro rotulos de moeda competem com a propria curva.
   */
  eixo?: boolean;
  className?: string;
}

/** Caixa de desenho. So a geometria mora no SVG; todo texto e HTML por cima. */
const L = 1000;
const A = 260;

/**
 * Curva do saldo acumulado — a "equity curve" do extrato pessoal.
 *
 * Area e nao barra: saldo e um nivel que existe em todo instante, nao uma
 * quantidade contada por periodo. Barra afirma que cada mes e uma unidade
 * separada; a area afirma continuidade, que e o que o saldo e.
 *
 * TECNICA: o SVG usa `preserveAspectRatio="none"` e uma caixa fixa, entao o
 * desenho estica na largura sem precisar medir o container. O que nao pode
 * esticar — traco e texto — fica fora dessa regra: o traco usa
 * `vector-effect="non-scaling-stroke"` e os rotulos sao HTML posicionado por
 * cima, nunca <text> dentro do SVG.
 *
 * UM eixo. O saldo e a unica medida aqui: entradas e saidas tem escala propria e
 * vivem no grafico ao lado, nunca num segundo eixo deste.
 */
export function GraficoDeSaldo({
  serie,
  mesSelecionado,
  aoSelecionarMes,
  eixo = false,
  className = '',
}: GraficoDeSaldoProps): React.JSX.Element {
  const gradiente = useId();
  const [ativo, setAtivo] = useState<number | null>(null);
  const t = useTextos();

  // A curva aparece assim que existe QUALQUER saldo para desenhar. O degrau de um
  // mes so tambem e informacao — e o momento em que o dinheiro entrou — e esconder
  // isso atras de "faltam dados" faz a tela parecer quebrada justo para quem
  // acabou de lancar o primeiro valor. So o extrato inteiro zerado nao rende
  // curva: ai a linha reta no zero nao diz nada que o texto nao diga melhor.
  const temMovimento = serie.some(
    (item) => item.entradas > 0 || item.saidas > 0 || item.saldo !== 0,
  );

  if (serie.length < 2 || !temMovimento) {
    return (
      <div className={`rounded-lg bg-superficie-fundo px-4 py-10 text-center ${className}`}>
        <p className="text-sm text-tinta-suave">{t.graficos.semSaldo}</p>
        <p className="mt-1 text-xs text-tinta-fraca">{t.graficos.curvaAparece}</p>
      </div>
    );
  }

  const valores = serie.map((item) => item.saldo);
  const maximo = Math.max(...valores, 0);
  const minimo = Math.min(...valores, 0);
  // Respiro de 8% em cima e embaixo: curva encostada na borda da caixa parece
  // cortada, e o pico deixa de ser legivel como pico.
  const folga = (maximo - minimo) * 0.08 || 1;
  const teto = maximo + folga;
  const piso = minimo - folga;

  const x = (indice: number): number => (indice / (serie.length - 1)) * L;
  const y = (valor: number): number => A - ((valor - piso) / (teto - piso)) * A;

  const pontos = serie.map((item, indice) => `${x(indice).toFixed(2)},${y(item.saldo).toFixed(2)}`);
  const linha = `M${pontos.join(' L')}`;
  const area = `${linha} L${L},${A} L0,${A} Z`;
  const zero = y(0);
  const mostraZero = piso < 0 && teto > 0;

  const emFoco = ativo === null ? undefined : serie[ativo];
  const indiceSelecionado = serie.findIndex((item) => item.mes === mesSelecionado);
  const clicavel = aoSelecionarMes !== undefined;

  // Tres referencias: topo, meio e base do intervalo desenhado. Numero redondo
  // seria melhor, mas exigiria reescalar a caixa — e a curva e a figura aqui, nao
  // a regua.
  const referencias = eixo ? [maximo, (maximo + minimo) / 2, minimo] : [];

  return (
    <div className={`relative ${className}`}>
      <div className="relative h-[200px] md:h-[240px]">
        <svg
          viewBox={`0 0 ${L.toString()} ${A.toString()}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label={t.estatisticas.saldoAcumulado}
        >
          <defs>
            <linearGradient id={gradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="text-marca" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" className="text-marca" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Faixa do mes que a tela esta mostrando. Fica ATRAS da curva: e
              contexto de leitura, nao um dado a mais. */}
          {indiceSelecionado >= 0 ? (
            <rect
              x={Math.max(0, x(indiceSelecionado) - L / (serie.length * 2))}
              y="0"
              width={L / serie.length}
              height={A}
              className="fill-marca"
              fillOpacity="0.1"
            />
          ) : null}

          {/* Referencias horizontais. Recessivas de proposito: grade que compete
              com a curva vira ruido quadriculado. */}
          {eixo
            ? referencias.map((valor) => (
                <line
                  key={valor}
                  x1="0"
                  x2={L}
                  y1={y(valor)}
                  y2={y(valor)}
                  className="stroke-superficie-borda"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))
            : null}

          {/* Linha do zero: sem ela, uma curva inteiramente negativa parece
              inteiramente positiva — a forma e a mesma, so o eixo muda. */}
          {mostraZero ? (
            <line
              x1="0"
              x2={L}
              y1={zero}
              y2={zero}
              className="stroke-superficie-forte"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          <path d={area} fill={`url(#${gradiente})`} />
          <path
            d={linha}
            fill="none"
            className="stroke-marca"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {ativo === null ? null : (
            <line
              x1={x(ativo)}
              x2={x(ativo)}
              y1="0"
              y2={A}
              className="stroke-tinta-fraca"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Ponto do mes em foco: fora do SVG esticado, senao ele viraria elipse. */}
        {ativo === null || emFoco === undefined ? null : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-marca ring-2 ring-superficie"
            style={{
              left: `${((ativo / (serie.length - 1)) * 100).toFixed(2)}%`,
              top: `${((y(emFoco.saldo) / A) * 100).toFixed(2)}%`,
            }}
          />
        )}

        {/*
          Faixas de acerto: uma coluna inteira por mes, e nao o ponto de 2px.
          Perseguir um ponto com o mouse e trabalho; a coluna entrega o mesmo
          dado sem mira. Sao botoes de verdade, entao o teclado chega junto — e,
          quando ha `aoSelecionarMes`, sao eles tambem que trocam o mes da tela.
        */}
        <div className="absolute inset-0 flex">
          {serie.map((item, indice) => (
            <button
              key={item.mes}
              type="button"
              disabled={!clicavel}
              className={`flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-inset ${
                clicavel ? 'cursor-pointer' : 'cursor-default'
              }`}
              onClick={() => {
                aoSelecionarMes?.(item.mes);
              }}
              onMouseEnter={() => {
                setAtivo(indice);
              }}
              onMouseLeave={() => {
                setAtivo(null);
              }}
              onFocus={() => {
                setAtivo(indice);
              }}
              onBlur={() => {
                setAtivo(null);
              }}
              aria-label={`${formatarMesTitulo(item.mes)}: ${formatarMoeda(item.saldo)}${
                clicavel ? `. ${t.graficos.verEsteMes}` : ''
              }`}
              aria-pressed={clicavel ? item.mes === mesSelecionado : undefined}
            />
          ))}
        </div>
      </div>

      {eixo ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[200px] md:h-[240px]">
          {referencias.map((valor) => (
            <span
              key={valor}
              className="absolute right-0 -translate-y-1/2 bg-superficie px-1 text-[11px] tabular-nums text-tinta-fraca"
              style={{ top: `${((y(valor) / A) * 100).toFixed(2)}%` }}
            >
              {formatarMoeda(centavos(Math.round(valor)))}
            </span>
          ))}
        </div>
      ) : null}

      {/*
        Doze rotulos em 390px dao 32px cada e viram papa. No celular so os pares
        aparecem: a escala continua legivel e a serie continua inteira.
      */}
      <div className="mt-2 flex text-[11px] tabular-nums text-tinta-fraca">
        {serie.map((item, indice) => (
          <span
            key={item.mes}
            className={`flex-1 text-center ${
              serie.length > 8 && indice % 2 === 1 ? 'hidden sm:block' : ''
            } ${
              item.mes === mesSelecionado
                ? 'font-semibold text-marca'
                : indice === ativo
                  ? 'font-semibold text-tinta'
                  : ''
            }`}
          >
            {formatarMesAbreviado(item.mes)}
          </span>
        ))}
      </div>

      {/* Altura reservada: sem ela o card pula 40px toda vez que o mouse entra. */}
      <div className="mt-2 min-h-[2.75rem] rounded-lg bg-superficie-fundo px-3 py-2">
        {emFoco === undefined ? (
          <p className="text-xs text-tinta-suave">
            {clicavel ? t.graficos.cliqueNoMes : t.graficos.passeOMouse}
          </p>
        ) : (
          <p className="text-xs tabular-nums text-tinta">
            {t.graficos.saldoDe(
              formatarMesTitulo(emFoco.mes),
              formatarMoeda(emFoco.saldo),
              formatarMoeda(emFoco.resultado),
            )}
          </p>
        )}
      </div>
    </div>
  );
}
