import { useTextos } from '../../i18n';

export interface BotaoFlutuanteProps {
  aoTocar: () => void;
  /** Lido pelo leitor de tela; o botao so mostra o "+". Padrao: o do dicionario. */
  rotulo?: string;
}

/**
 * FAB na zona do polegar (canto inferior direito), 56px, acima da safe area do
 * iPhone.
 *
 * E o unico morador do rodape: os destinos subiram para as abas do topo. O que
 * se FAZ fica onde o polegar alcanca; para onde se VAI fica no topo, longe da
 * barra de gestos do sistema.
 *
 * md:hidden de proposito: com mouse nao existe zona do polegar, o canto
 * inferior direito vira o pior alvo da tela e um circulo sem rotulo custa um
 * ciclo de adivinhacao. De md para cima quem abre e o BotaoNovoLancamento.
 */
export function BotaoFlutuante({ aoTocar, rotulo }: BotaoFlutuanteProps): React.JSX.Element {
  const t = useTextos();

  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-label={rotulo ?? t.navegacao.novoLancamento}
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-marca text-marca-contraste shadow-flutuante transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2 active:scale-95 md:hidden"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}
