import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type * as React from 'react';

import {
  RESUMO_VAZIO,
  compararCategorias,
  indexarPorId,
  listarCategorias,
  listarTransacoesDoMes,
  maioresDoMes,
  movimentoPorMes,
  resumirMes,
  serieDeSaldo,
} from '../../db/consultas';
import type { Categoria, Centavos, MesISO, Transacao } from '../../types';
import {
  MENOS,
  centavos,
  formatarDataCurta,
  formatarMesNome,
  formatarMesTitulo,
  formatarMoeda,
  formatarMoedaSemSimbolo,
  mesAnterior,
  mesAtual,
  mesSeguinte,
} from '../../types';
import { GraficoButterfly } from '../graficos/GraficoButterfly';
import { GraficoDeComparacao } from '../graficos/GraficoDeComparacao';
import { GraficoDeSaldo } from '../graficos/GraficoDeSaldo';
import { BotaoExportarPdf } from '../impressao';
import { useAbrirLancamento } from '../lancamento';
import { useTextos } from '../../i18n';

/** Espelha o token `categoria.outros`; entra como dado, igual ao que vem do banco. */
const COR_SEM_CATEGORIA = '#94a3b8';

const MESES_NA_CURVA = 12;
const MESES_NO_FLUXO = 6;
const MAIORES = 6;

/** Fio que separa as secoes DENTRO da folha. E o que substitui a borda de card. */
const DIVISOR = 'border-t border-superficie-borda';

/**
 * Relatorio do mes — uma FOLHA, nao um painel.
 *
 * A versao anterior era o kit de cards de qualquer admin: oito caixas brancas de
 * mesmo peso, mesma borda e mesmo raio, empilhadas. Cada caixa dizia "eu sou
 * mais uma coisa", e nenhuma dizia "eu sou a conclusao".
 *
 * Aqui a tela e um documento contínuo. Uma superficie, dividida por FIOS, com
 * uma hierarquia que se le de cima para baixo e que existe de verdade:
 *
 *   1. o resultado do mes, grande, sozinho — e a conclusao
 *   2. os quatro numeros que o explicam, em linha, separados por divisor
 *   3. a curva que mostra de onde ele veio
 *   4. os dois recortes de analise: por mes e por categoria
 *   5. os lancamentos que mais pesaram
 *
 * Nada aqui e "mais um card": cada faixa e um degrau a menos de importancia.
 */
export function PaginaEstatisticas(): React.JSX.Element {
  const [mes, setMes] = useState<MesISO>(() => mesAtual());
  const anterior = mesAnterior(mes);

  const transacoes = useLiveQuery(() => listarTransacoesDoMes(mes), [mes]);
  const transacoesAnteriores = useLiveQuery(() => listarTransacoesDoMes(anterior), [anterior]);
  const curva = useLiveQuery(() => serieDeSaldo(mes, MESES_NA_CURVA), [mes]);
  const fluxo = useLiveQuery(() => movimentoPorMes(mes, MESES_NO_FLUXO), [mes]);
  const categorias = useLiveQuery(() => compararCategorias(mes), [mes]);
  const maiores = useLiveQuery(() => maioresDoMes(mes, MAIORES), [mes]);
  const todasCategorias = useLiveQuery(() => listarCategorias(), []);
  const porId = indexarPorId<Categoria>(todasCategorias ?? []);
  const t = useTextos();

  const resumo = transacoes === undefined ? RESUMO_VAZIO : resumirMes(transacoes);
  const resumoAnterior =
    transacoesAnteriores === undefined ? RESUMO_VAZIO : resumirMes(transacoesAnteriores);

  const lancamentos = transacoes?.length ?? 0;
  const mesVazio = transacoes !== undefined && lancamentos === 0;

  const saidas = transacoes?.filter((t) => t.tipo === 'saida') ?? [];
  const media = saidas.length === 0 ? null : centavos(Math.round(resumo.saidas / saidas.length));
  const maiorSaida = saidas.reduce<Transacao | null>(
    (maior, t) => (maior === null || t.valor > maior.valor ? t : maior),
    null,
  );

  return (
    <div className="space-y-4 md:space-y-5 lg:space-y-6">
      <section
        aria-label={t.estatisticas.resumoDoMes}
        className="overflow-hidden rounded-xl border border-superficie-borda bg-superficie"
      >
        <Cabecalho mes={mes} aoMudarMes={setMes} />

        {mesVazio ? (
          <MesSemLancamento mes={mes} />
        ) : (
          <>
            <Conclusao
              resultado={resumo.saldo}
              referencia={resumoAnterior.saldo}
              mesDaReferencia={anterior}
              lancamentos={lancamentos}
            />

            <dl className={`grid grid-cols-2 ${DIVISOR} lg:grid-cols-4`}>
              <Numero
                rotulo={t.comum.entrou}
                valor={formatarMoeda(resumo.entradas)}
                cor="text-entrada"
                apoio={
                  <Variacao
                    valor={resumo.entradas}
                    referencia={resumoAnterior.entradas}
                    mes={anterior}
                    subirEhBom
                  />
                }
              />
              <Numero
                rotulo={t.comum.saiu}
                valor={formatarMoeda(resumo.saidas)}
                cor="text-saida"
                apoio={
                  <Variacao
                    valor={resumo.saidas}
                    referencia={resumoAnterior.saidas}
                    mes={anterior}
                    subirEhBom={false}
                  />
                }
              />
              <Numero
                rotulo={t.estatisticas.saidaMedia}
                valor={media === null ? '—' : formatarMoeda(media)}
                cor="text-tinta"
                apoio={
                  <span className="text-tinta-fraca">{t.comum.saidas(saidas.length)}</span>
                }
              />
              <Numero
                rotulo={t.estatisticas.maiorSaida}
                valor={maiorSaida === null ? '—' : formatarMoeda(maiorSaida.valor)}
                cor="text-tinta"
                apoio={
                  <span className="truncate text-tinta-fraca">
                    {maiorSaida === null
                      ? t.estatisticas.nenhumaNoMes
                      : `${porId.get(maiorSaida.categoriaId)?.nome ?? t.comum.semCategoria}, ${formatarDataCurta(maiorSaida.data)}`}
                  </span>
                }
              />
            </dl>
          </>
        )}

        <Faixa titulo={t.estatisticas.saldoAcumulado} apoio={t.estatisticas.ultimosDozeMeses}>
          {curva === undefined ? (
            <Esqueleto altura="h-[240px]" />
          ) : (
            <GraficoDeSaldo serie={curva} mesSelecionado={mes} aoSelecionarMes={setMes} eixo />
          )}
        </Faixa>
      </section>

      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-12 lg:gap-6">
        <section
          aria-label={t.estatisticas.entrouContraSaiu}
          className="overflow-hidden rounded-xl border border-superficie-borda bg-superficie lg:col-span-5"
        >
          <Faixa
            titulo={t.estatisticas.entrouContraSaiu}
            apoio={t.estatisticas.meses(MESES_NO_FLUXO)}
            primeira
          >
            {fluxo === undefined ? (
              <Esqueleto altura="h-[200px]" />
            ) : (
              <GraficoButterfly serie={fluxo} mesSelecionado={mes} aoSelecionarMes={setMes} />
            )}
          </Faixa>
        </section>

        <section
          aria-label={t.estatisticas.ondeMudou}
          className="overflow-hidden rounded-xl border border-superficie-borda bg-superficie lg:col-span-7"
        >
          <Faixa
            titulo={t.estatisticas.ondeMudou}
            apoio={t.estatisticas.contra(formatarMesNome(anterior), formatarMesNome(mes))}
            primeira
          >
            {categorias === undefined ? (
              <Esqueleto altura="h-[200px]" />
            ) : (
              <GraficoDeComparacao itens={categorias} mes={mes} mesAnterior={anterior} />
            )}
          </Faixa>
        </section>
      </div>

      <section
        aria-label={t.estatisticas.oQueMaisPesou}
        className="overflow-hidden rounded-xl border border-superficie-borda bg-superficie"
      >
        <Faixa titulo={t.estatisticas.oQueMaisPesou} apoio={formatarMesNome(mes)} primeira>
          {maiores === undefined ? (
            <Esqueleto altura="h-32" />
          ) : maiores.length === 0 ? (
            <p className="py-8 text-center text-sm text-tinta-suave">
              {t.estatisticas.nadaEm(formatarMesNome(mes))}
            </p>
          ) : (
            <ol className="divide-y divide-superficie-borda">
              {maiores.map((transacao) => (
                <LinhaDoMaior
                  key={transacao.id}
                  transacao={transacao}
                  categoria={porId.get(transacao.categoriaId)}
                  teto={maiores[0]?.valor ?? 0}
                />
              ))}
            </ol>
          )}
        </Faixa>
      </section>
    </div>
  );
}

interface CabecalhoProps {
  mes: MesISO;
  aoMudarMes: (mes: MesISO) => void;
}

/**
 * Cabecalho da folha. O titulo da tela e o periodo dividem a MESMA faixa, com o
 * periodo em destaque: em relatorio, o que se procura primeiro e de quando ele e.
 */
function Cabecalho({ mes, aoMudarMes }: CabecalhoProps): React.JSX.Element {
  const agora = mesAtual();
  const t = useTextos();
  const seta =
    'flex h-9 w-9 items-center justify-center rounded-lg border border-superficie-borda text-tinta-suave transition-colors md:hover:bg-superficie-fundo md:hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 md:px-6 md:py-5">
      <div className="min-w-0">
        <p className="text-rotulo font-medium text-tinta-suave">{t.estatisticas.relatorioDoMes}</p>
        <h1 className="truncate text-xl font-semibold tracking-tight text-tinta md:text-2xl">
          {formatarMesTitulo(mes)}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <BotaoExportarPdf mes={mes} className="mr-1.5" />

        {mes === agora ? null : (
          <button
            type="button"
            onClick={() => {
              aoMudarMes(agora);
            }}
            className="flex h-9 items-center rounded-lg px-2.5 text-sm font-medium text-marca transition-colors md:hover:bg-marca-suave focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
          >
            {t.comum.voltarParaHoje}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            aoMudarMes(mesAnterior(mes));
          }}
          aria-label={t.comum.mesAnterior}
          className={seta}
        >
          <Seta direcao="esquerda" />
        </button>
        <button
          type="button"
          onClick={() => {
            aoMudarMes(mesSeguinte(mes));
          }}
          aria-label={t.comum.proximoMes}
          className={seta}
        >
          <Seta direcao="direita" />
        </button>
      </div>
    </div>
  );
}

function Seta({ direcao }: { direcao: 'esquerda' | 'direita' }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d={direcao === 'esquerda' ? 'M15 5 8 12l7 7' : 'm9 5 7 7-7 7'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ConclusaoProps {
  resultado: Centavos;
  referencia: Centavos;
  mesDaReferencia: MesISO;
  lancamentos: number;
}

/**
 * O resultado do mes, grande e sozinho.
 *
 * E o unico numero da tela com esse peso. Empatado com os outros quatro — que e
 * o que acontecia antes, nas quatro caixinhas iguais — ele deixava de ser a
 * conclusao do relatorio e virava mais uma metrica.
 */
function Conclusao({
  resultado,
  referencia,
  mesDaReferencia,
  lancamentos,
}: ConclusaoProps): React.JSX.Element {
  const negativo = resultado < 0;
  const t = useTextos();

  return (
    <div className={`${DIVISOR} px-4 py-5 md:px-6 md:py-6`}>
      <p className="text-rotulo font-medium text-tinta-suave">
        {negativo ? t.estatisticas.fechouNoVermelho : t.estatisticas.sobrouNoMes}
      </p>

      <p
        className={`mt-1.5 font-semibold slashed-zero tabular-nums text-heroi lg:text-heroi-lg ${
          negativo ? 'text-saida' : 'text-entrada'
        }`}
      >
        {negativo ? MENOS : ''}
        <span className="mr-1 text-[0.5em] font-medium text-tinta-suave">R$</span>
        {formatarMoedaSemSimbolo(centavos(Math.abs(resultado)))}
      </p>

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Variacao
          valor={resultado}
          referencia={referencia}
          mes={mesDaReferencia}
          subirEhBom
          tamanho="normal"
        />
        <span className="tabular-nums text-tinta-suave">{t.comum.lancamentos(lancamentos)}</span>
      </p>
    </div>
  );
}

interface NumeroProps {
  rotulo: string;
  valor: string;
  cor: string;
  apoio: React.ReactNode;
}

/**
 * Numero de apoio. Sao celulas de uma linha unica, separadas por FIO — e nao
 * quatro cards flutuando: quatro caixas com borda propria afirmam quatro
 * assuntos, e estes quatro sao o mesmo assunto visto de quatro angulos.
 */
function Numero({ rotulo, valor, cor, apoio }: NumeroProps): React.JSX.Element {
  return (
    <div className="min-w-0 border-superficie-borda px-4 py-3.5 [&:nth-child(even)]:border-l md:px-6 lg:border-l lg:first:border-l-0">
      <dt className="text-xs text-tinta-suave">{rotulo}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums md:text-xl ${cor}`}>{valor}</dd>
      <dd className="mt-0.5 truncate text-xs tabular-nums">{apoio}</dd>
    </div>
  );
}

interface FaixaProps {
  titulo: string;
  apoio: string;
  /** Primeira faixa da folha dispensa o fio de cima: a borda do card ja separa. */
  primeira?: boolean;
  children: React.ReactNode;
}

function Faixa({ titulo, apoio, primeira = false, children }: FaixaProps): React.JSX.Element {
  return (
    <div className={`${primeira ? '' : DIVISOR} px-4 py-5 md:px-6 md:py-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>
        <p className="text-xs text-tinta-fraca">{apoio}</p>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Esqueleto({ altura }: { altura: string }): React.JSX.Element {
  return <div className={`${altura} animate-pulse rounded-lg bg-superficie-fundo`} aria-hidden="true" />;
}

interface VariacaoProps {
  valor: Centavos;
  referencia: Centavos;
  mes: MesISO;
  subirEhBom: boolean;
  tamanho?: 'pequeno' | 'normal';
}

/** Sem base de comparacao nao ha variacao: "+100%" sobre um mes vazio e ruido. */
function Variacao({
  valor,
  referencia,
  mes,
  subirEhBom,
  tamanho = 'pequeno',
}: VariacaoProps): React.JSX.Element {
  const t = useTextos();
  const nome = formatarMesNome(mes);
  const classe = tamanho === 'normal' ? 'text-sm' : 'text-xs';

  if (referencia === 0) {
    return <span className={`${classe} text-tinta-fraca`}>{t.comum.semBaseEm(nome)}</span>;
  }

  const porcento = Math.round(((valor - referencia) / Math.abs(referencia)) * 100);
  if (porcento === 0) {
    return <span className={`${classe} text-tinta-fraca`}>{t.comum.igualA(nome)}</span>;
  }

  const subiu = porcento > 0;
  const cor = subiu === subirEhBom ? 'text-entrada' : 'text-saida';

  return (
    <span className={`${classe} tabular-nums ${cor}`}>
      {subiu ? '▲' : '▼'} {t.comum.variacao(Math.abs(porcento).toString(), nome)}
    </span>
  );
}

interface LinhaDoMaiorProps {
  transacao: Transacao;
  categoria: Categoria | undefined;
  teto: number;
}

/**
 * A barra de fundo e a segunda codificacao do valor: sem ela, seis linhas de
 * numero exigem ler todas para descobrir qual e a maior — que e justamente a
 * pergunta que a secao responde.
 */
function LinhaDoMaior({ transacao, categoria, teto }: LinhaDoMaiorProps): React.JSX.Element {
  const t = useTextos();
  const ehEntrada = transacao.tipo === 'entrada';
  const descricao = transacao.descricao.trim();
  const nomeDaCategoria = categoria?.nome ?? t.comum.semCategoria;
  const proporcao = teto === 0 ? 0 : (transacao.valor / teto) * 100;

  return (
    <li className="relative flex items-center gap-3 overflow-hidden py-2.5">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 opacity-[0.08]"
        style={{ width: `${proporcao.toFixed(2)}%`, backgroundColor: categoria?.cor ?? COR_SEM_CATEGORIA }}
      />

      <span
        aria-hidden="true"
        className="relative h-6 w-1 shrink-0 rounded-md"
        style={{ backgroundColor: categoria?.cor ?? COR_SEM_CATEGORIA }}
      />
      <span className="relative w-9 shrink-0 text-xs tabular-nums text-tinta-fraca">
        {formatarDataCurta(transacao.data)}
      </span>
      <span className="relative min-w-0 flex-1 truncate text-sm text-tinta">
        {descricao === '' ? nomeDaCategoria : descricao}
      </span>
      <span className="relative hidden w-28 shrink-0 truncate text-xs text-tinta-suave sm:block">
        {nomeDaCategoria}
      </span>
      <span
        className={`relative shrink-0 text-sm font-semibold tabular-nums ${
          ehEntrada ? 'text-entrada' : 'text-tinta'
        }`}
      >
        {ehEntrada ? '+' : MENOS}
        {formatarMoeda(transacao.valor)}
      </span>
    </li>
  );
}

/**
 * O mes escolhido nao tem lancamento.
 *
 * Duas saidas, nessa ordem: ir para um mes que tem dado (o caso comum de quem
 * esta navegando a curva) ou lancar agora. Tela vazia e convite, nao aviso.
 */
function MesSemLancamento({ mes }: { mes: MesISO }): React.JSX.Element {
  const abrir = useAbrirLancamento();
  const t = useTextos();

  return (
    <div className={`${DIVISOR} px-4 py-12 text-center md:px-6`}>
      <p className="text-base font-medium text-tinta">
        {t.estatisticas.nadaEm(formatarMesNome(mes))}
      </p>
      <p className="mx-auto mt-1 max-w-[46ch] text-sm text-tinta-suave">
        {t.estatisticas.convite}
      </p>
      <button
        type="button"
        onClick={abrir}
        className="mt-4 inline-flex min-h-toque items-center rounded-lg bg-marca px-4 text-sm font-semibold text-marca-contraste shadow-sm transition-colors hover:bg-marca-forte md:min-h-0 md:py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
      >
        {t.inicio.lancarPrimeiro}
      </button>
    </div>
  );
}
