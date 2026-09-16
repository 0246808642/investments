import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type * as React from 'react';

import { useTextos } from '../../i18n';
import type { Rota } from '../../rotas/rotas';
import { useItensNav } from './navegacao';

interface NavegacaoEmAbasProps {
  rota: Rota;
  className?: string;
}

/**
 * Abas de secao no TOPO, dentro da barra superior, abaixo de `md`.
 *
 * Fica em cima e nao no rodape porque o app e instalado (display: standalone) e
 * o rodape do celular ja e do sistema: uma aba colada ali divide alvo com a
 * barra de gestos do iOS e do Android. Em cima, o alvo e so nosso. A zona do
 * polegar continua servida pelo FAB, que e acao e nao destino.
 *
 * SO A ABA ATIVA ESCREVE O NOME; as outras tres sao icone puro. E o que faz a
 * navegacao caber na MESMA faixa dos controles, em vez de exigir uma segunda: o
 * header inteiro cai de ~92px para ~52px, e num celular de 844px isso e uma
 * linha e meia de extrato a mais em cada tela. O preco e que tres destinos ficam
 * sem nome escrito — por isso o nome da secao em que se esta nunca some, e cada
 * icone carrega `aria-label`: para o leitor de tela, nada foi perdido.
 *
 * E o nome so aparece SE COUBER, medido (veja `useRotuloCabe`), nunca chutado
 * por breakpoint: a largura que sobra depende de coisas que nenhum `min-[Npx]`
 * enxerga — o botao ao lado diz "Entrar" ou so mostra o icone conforme a sessao,
 * e "Lançamentos" e "Movimientos" nao medem o mesmo. Quando nao cabe, o rotulo
 * vira `sr-only` e as quatro abas continuam inteiras na tela. Essa e a regra que
 * nao se negocia: destino fora da tela e destino que nao existe.
 */
export function NavegacaoEmAbas({
  rota,
  className = '',
}: NavegacaoEmAbasProps): React.JSX.Element {
  const itens = useItensNav();
  const t = useTextos();
  const abaAtiva = useRef<HTMLAnchorElement | null>(null);
  const faixa = useRef<HTMLUListElement | null>(null);
  const medidor = useRef<HTMLSpanElement | null>(null);
  const rotuloCabe = useRotuloCabe(faixa, medidor, rota, t.navegacao.secoes);

  // Se a fila rolar, a aba atual pode nascer fora da tela. Instantaneo de
  // proposito: e correcao de enquadramento, nao animacao.
  useEffect(() => {
    abaAtiva.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [rota]);

  return (
    <nav aria-label={t.navegacao.secoes} className={`relative ${className}`}>
      {/*
        Fantasma do rotulo ativo, fora do fluxo: e como se sabe de quantos pixels
        o rotulo precisa MESMO ESTANDO ESCONDIDO. Sem ele a decisao oscilaria —
        escondido o rotulo, a fila caberia, e ele voltaria; visivel, nao caberia,
        e sumiria de novo, a cada quadro.
      */}
      <span
        ref={medidor}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap text-[13px] font-medium"
      >
        {t.navegacao[rota]}
      </span>

      <ul
        ref={faixa}
        className="flex items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {itens.map((item) => {
          const ativo = item.rota === rota;
          const Icone = ICONES[item.rota];
          return (
            <li key={item.rota} className="shrink-0">
              <a
                ref={ativo ? abaAtiva : null}
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                // Inativa nao tem texto: sem isto o leitor de tela anuncia "link".
                // Ativa tira o rotulo daqui porque ja o tem escrito na tela.
                aria-label={ativo ? undefined : item.rotulo}
                onClick={ativo ? voltarAoTopo : undefined}
                className={`flex min-h-toque items-center justify-center gap-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca ${
                  ativo
                    ? 'bg-marca-suave px-3 font-medium text-marca'
                    : 'w-11 text-tinta-suave active:bg-superficie'
                }`}
              >
                <Icone />
                {ativo ? (
                  <span
                    className={`whitespace-nowrap text-[13px] leading-none ${
                      rotuloCabe ? '' : 'sr-only'
                    }`}
                  >
                    {item.rotulo}
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** gap-2 entre o icone e o rotulo: entra na conta de quanto o rotulo custa. */
const GAP_DO_ROTULO = 8;

/**
 * O rotulo da aba ativa cabe na faixa?
 *
 * A conta e a mesma nos dois estados, e e isso que a mantem estavel: o que as
 * abas ja ocupam mais o que o rotulo ocuparia se voltasse (zero quando ele ja
 * esta na tela). Um unico numero comparado a largura disponivel — sem
 * histerese, sem piscar.
 *
 * A largura ocupada sai da distancia entre a primeira e a ultima aba, e NAO de
 * `scrollWidth`: `scrollWidth` nunca devolve menos que `clientWidth`, entao com
 * espaco sobrando ele responde "ocupo a faixa inteira" e a conta concluiria que
 * nada mais cabe — o rotulo nunca apareceria em celular nenhum.
 *
 * `useLayoutEffect` porque a decisao tem que valer ANTES da pintura: medir
 * depois faria o rotulo aparecer e sumir na frente do usuario. E o
 * ResizeObserver cobre o que muda sem troca de rota — girar o celular, entrar na
 * conta (o botao ao lado encolhe de "Entrar" para o icone) e trocar de idioma.
 *
 * Ele observa a FILA e o FANTASMA, e precisa dos dois. A fila pega o que muda a
 * largura disponivel. O fantasma pega o que muda a largura NECESSARIA sem mexer
 * em caixa nenhuma: a Inter chega da rede depois da primeira pintura e troca as
 * metricas do texto embaixo do app inteiro — a fila continua do mesmo tamanho
 * (ela ocupa a linha toda), entao sozinha ela nunca avisaria, e a medida ficaria
 * presa na fonte de sistema que valia no primeiro quadro.
 */
function useRotuloCabe(
  faixa: React.RefObject<HTMLUListElement | null>,
  medidor: React.RefObject<HTMLSpanElement | null>,
  rota: Rota,
  idioma: string,
): boolean {
  const [cabe, setCabe] = useState(true);

  useLayoutEffect(() => {
    const lista = faixa.current;
    if (lista === null) {
      return undefined;
    }

    function medir(): void {
      if (lista === null) {
        return;
      }
      const abas = lista.children;
      const primeira = abas.item(0)?.getBoundingClientRect();
      const ultima = abas.item(abas.length - 1)?.getBoundingClientRect();
      if (primeira === undefined || ultima === undefined) {
        return;
      }

      const ocupado = ultima.right - primeira.left;
      const custoDoRotulo = cabe ? 0 : (medidor.current?.offsetWidth ?? 0) + GAP_DO_ROTULO;
      setCabe(ocupado + custoDoRotulo <= lista.clientWidth);
    }

    medir();

    if (typeof ResizeObserver !== 'function') {
      return undefined;
    }
    const observador = new ResizeObserver(medir);
    observador.observe(lista);
    if (medidor.current !== null) {
      observador.observe(medidor.current);
    }
    return () => observador.disconnect();
  }, [faixa, medidor, rota, idioma, cabe]);

  return cabe;
}

/**
 * Tocar na aba em que ja se esta volta ao topo — o idioma de celular que todo
 * app nativo fala. So existe porque o link aponta para o mesmo hash: sem
 * preventDefault o toque nao produziria evento nenhum e pareceria um botao
 * quebrado.
 */
function voltarAoTopo(evento: React.MouseEvent<HTMLAnchorElement>): void {
  evento.preventDefault();

  const reduzido =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.scrollTo({ top: 0, behavior: reduzido ? 'auto' : 'smooth' });
}

/* ------------------------------------------------------------------ *
 * Icones
 *
 * `Record<Rota, ...>` de proposito: criar uma rota nova sem desenhar o icone
 * dela para o build, em vez de mandar uma aba muda para a producao.
 *
 * Os desenhos saem do vocabulario do app, nao de um kit generico: lancamento e
 * um RECIBO (o papel do que se gastou) e nao uma lista qualquer; categoria e
 * uma ETIQUETA, que e o gesto de marcar um gasto. So inicio e estatisticas
 * usam o simbolo obvio, porque casa e barras nao se confundem com nada.
 * ------------------------------------------------------------------ */

const TRACO = {
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  className: 'h-[18px] w-[18px] shrink-0',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const ICONES: Record<Rota, () => React.JSX.Element> = {
  inicio: () => (
    <svg {...TRACO}>
      <path d="M3 10.7 12 3.2l9 7.5" />
      <path d="M5.6 9.6V20.3h12.8V9.6" />
    </svg>
  ),
  lancamentos: () => (
    <svg {...TRACO}>
      <path d="M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 18.9z" />
      <path d="M9.5 8.6h5M9.5 12.6h5" />
    </svg>
  ),
  estatisticas: () => (
    <svg {...TRACO}>
      <path d="M5 20.3V10.6M12 20.3V3.7M19 20.3v-6.9" />
    </svg>
  ),
  categorias: () => (
    <svg {...TRACO}>
      <path d="M3.2 12V5.2a2 2 0 0 1 2-2H12l8.8 8.8-6.8 6.8z" />
      <path d="M7.6 7.6h.01" />
    </svg>
  ),
};
