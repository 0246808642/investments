import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import { movimentoPorMes, saldoAcumulado } from '../../db/consultas';
import { useAlertas } from '../../hooks/useAlertas';
import { useAbrirAlertas } from '../alertas';
import { useTextos } from '../../i18n';
import type { Centavos, MesISO } from '../../types';
import {
  MENOS,
  centavos,
  formatarMesNome,
  formatarMoeda,
  formatarMoedaSemSimbolo,
  mesAnterior,
} from '../../types';
import { CabecalhoMes } from './CabecalhoMes';
import { MESES_NA_TRILHA, TrilhaMeses } from './TrilhaMeses';

interface FaixaSaldoProps {
  mes: MesISO;
  aoMudarMes: (mes: MesISO) => void;
  className?: string;
}

/**
 * Faixa de abertura da tela: onde voce esta (saldo) e como chegou ate aqui
 * (trilha dos ultimos meses). Ocupa a largura inteira porque e o unico bloco da
 * home que responde a pergunta que traz o usuario aqui; os tres cards de baixo
 * sao a evidencia.
 *
 * Nao e mais um card entre quatro iguais: a hierarquia vem do tamanho do numero
 * e do span, nao de sombra ou de cor de fundo — o sistema ja decidiu que sombra
 * e so para o que flutua.
 *
 * A faixa tambem absorveu a navegacao de mes, que antes vivia solta no topo da
 * pagina: o mes e o recorte de TUDO que esta abaixo, entao ele pertence ao bloco
 * que mostra o efeito de trocar de mes.
 */
export function FaixaSaldo({ mes, aoMudarMes, className = '' }: FaixaSaldoProps): React.JSX.Element {
  const saldo = useLiveQuery(() => saldoAcumulado(), []);
  const janela = useLiveQuery(() => movimentoPorMes(mes, MESES_NA_TRILHA), [mes]);
  const t = useTextos();

  const doMes = janela?.at(-1);
  const anterior = janela?.at(-2);

  const carregando = saldo === undefined;
  const texto = carregando ? '—' : formatarMoeda(saldo);
  // Degrau de tamanho por comprimento: o heroi divide a linha com o rotulo e um
  // saldo de sete digitos nao pode empurrar o layout.
  const tamanho = texto.length > 13 ? 'text-3xl' : texto.length > 11 ? 'text-4xl' : 'text-heroi';
  const corDoSaldo = !carregando && saldo < 0 ? 'text-saida' : 'text-tinta';

  return (
    <section
      aria-label={t.inicio.saldoAtual}
      className={`rounded-xl border border-superficie-borda bg-superficie ${className}`}
    >
      <CabecalhoMes
        mes={mes}
        aoMudarMes={aoMudarMes}
        className="border-b border-superficie-borda px-4 py-2.5 md:px-6 lg:px-7"
      />

      <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2 md:gap-8 md:p-6 lg:grid-cols-12 lg:gap-10 lg:p-7">
        <div className="lg:col-span-4">
          <p className="text-rotulo font-medium text-tinta-suave">{t.inicio.saldoAtual}</p>

          <p
            className={`mt-1.5 font-semibold slashed-zero tabular-nums ${tamanho} lg:text-heroi-lg ${corDoSaldo}`}
          >
            {carregando ? (
              '—'
            ) : (
              <>
                {saldo < 0 ? MENOS : ''}
                <span className="mr-1 text-[0.5em] font-medium text-tinta-suave">R$</span>
                {formatarMoedaSemSimbolo(centavos(Math.abs(saldo)))}
              </>
            )}
          </p>

          <p className="mt-2 max-w-[34ch] text-sm text-tinta-suave">
            {t.inicio.explicacaoDoSaldo}
          </p>
        </div>

        {/* Divisor no lugar de caixinhas: o bloco ja esta dentro de uma borda, e
            borda dentro de borda empilharia tres camadas para dois numeros. */}
        <div className="grid grid-cols-2 gap-5 lg:col-span-4 lg:border-x lg:border-superficie-borda lg:px-10">
          <ValorDoMes
            rotulo={t.inicio.entrouNoMes}
            valor={doMes?.entradas}
            referencia={anterior?.entradas}
            mesAnteriorAoAtual={mesAnterior(mes)}
            classeTexto="text-entrada"
            subirEhBom
          />
          <ValorDoMes
            rotulo={t.inicio.saiuNoMes}
            valor={doMes?.saidas}
            referencia={anterior?.saidas}
            mesAnteriorAoAtual={mesAnterior(mes)}
            classeTexto="text-saida"
            subirEhBom={false}
          />
          <LimiteDeGastos mes={mes} className="col-span-2" />
        </div>

        <div className="md:col-span-2 lg:col-span-4">
          <p className="text-rotulo font-medium text-tinta-suave">{t.inicio.comoFecharam}</p>
          <TrilhaMeses mes={mes} aoMudarMes={aoMudarMes} className="mt-2" />
        </div>
      </div>
    </section>
  );
}

interface ValorDoMesProps {
  rotulo: string;
  valor: Centavos | undefined;
  /** Mesmo recorte no mes anterior. `undefined` enquanto carrega. */
  referencia: Centavos | undefined;
  mesAnteriorAoAtual: MesISO;
  classeTexto: string;
  /** Entrada que sobe e boa noticia; saida que sobe, nao. Decide a cor da variacao. */
  subirEhBom: boolean;
}

function ValorDoMes({
  rotulo,
  valor,
  referencia,
  mesAnteriorAoAtual,
  classeTexto,
  subirEhBom,
}: ValorDoMesProps): React.JSX.Element {
  return (
    <div>
      <p className="text-xs text-tinta-suave">{rotulo}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums md:text-xl ${classeTexto}`}>
        {valor === undefined ? '—' : formatarMoeda(valor)}
      </p>
      <Variacao
        valor={valor}
        referencia={referencia}
        mes={mesAnteriorAoAtual}
        subirEhBom={subirEhBom}
      />
    </div>
  );
}

interface LimiteDeGastosProps {
  mes: MesISO;
  className?: string;
}

/**
 * O teto de gastos mora colado no numero que ele limita — "R$ 45 de R$ 3.000"
 * so quer dizer alguma coisa ao lado do "Saiu no mes".
 *
 * So aparece no mes corrente. O teto e do mes de hoje; desenhar a barra enquanto
 * a tela mostra marco afirmaria que R$ 3.000 valem para marco, e nao valem.
 */
function LimiteDeGastos({ mes, className = '' }: LimiteDeGastosProps): React.JSX.Element | null {
  const { configuracao, carregando, mesVigente, gastosDoMes, tetoEstourado } = useAlertas();
  const abrir = useAbrirAlertas();
  const t = useTextos();

  if (carregando || mes !== mesVigente) {
    return null;
  }

  if (!configuracao.teto.ativo) {
    return (
      <button
        type="button"
        onClick={abrir}
        className={`-ml-1 flex min-h-toque items-center self-start rounded-lg px-1 text-xs font-medium text-marca md:min-h-0 md:py-1 md:hover:bg-marca-suave focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2 ${className}`}
      >
        {t.inicio.definirTeto}
      </button>
    );
  }

  const teto = configuracao.teto.valor;
  // Trava em 100: passar do teto ja e dito pelo texto e pela cor; deixar a barra
  // transbordar a caixa so quebraria o layout.
  const ocupado = teto === 0 ? 0 : Math.min(100, (gastosDoMes / teto) * 100);

  return (
    <div className={className}>
      <div className="h-1.5 overflow-hidden rounded-full bg-superficie-fundo">
        <div
          className={`h-full rounded-full ${tetoEstourado ? 'bg-saida' : 'bg-tinta-fraca'}`}
          style={{ width: `${ocupado.toFixed(2)}%` }}
        />
      </div>

      <button
        type="button"
        onClick={abrir}
        aria-label={`${t.alertas.teto}: ${t.inicio.tetoDe(formatarMoeda(gastosDoMes), formatarMoeda(teto))}`}
        className="-ml-1 mt-1.5 flex min-h-toque items-center rounded-lg px-1 text-xs tabular-nums text-tinta-suave md:min-h-0 md:py-0.5 md:hover:bg-superficie-fundo md:hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
      >
        {t.inicio.tetoDe(formatarMoeda(gastosDoMes), formatarMoeda(teto))}
      </button>
    </div>
  );
}

interface VariacaoProps {
  valor: Centavos | undefined;
  referencia: Centavos | undefined;
  mes: MesISO;
  subirEhBom: boolean;
}

/**
 * Um numero sozinho nao diz se e muito. A comparacao com o mes anterior e a
 * base mais barata que existe — e some quando nao ha base: "+100%" sobre um mes
 * sem nenhum lancamento seria ruido com cara de informacao.
 */
function Variacao({ valor, referencia, mes, subirEhBom }: VariacaoProps): React.JSX.Element | null {
  const t = useTextos();

  if (valor === undefined || referencia === undefined || referencia === 0) {
    return null;
  }

  const porcento = Math.round(((valor - referencia) / referencia) * 100);
  const nome = formatarMesNome(mes);

  if (porcento === 0) {
    return <p className="mt-1 text-xs text-tinta-fraca">{t.comum.igualA(nome)}</p>;
  }

  const subiu = porcento > 0;
  const cor = subiu === subirEhBom ? 'text-entrada' : 'text-saida';

  return (
    <p className={`mt-1 text-xs tabular-nums ${cor}`}>
      {subiu ? '▲' : '▼'} {t.comum.variacao(Math.abs(porcento).toString(), nome)}
    </p>
  );
}
