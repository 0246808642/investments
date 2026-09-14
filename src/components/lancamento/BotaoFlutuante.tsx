export interface BotaoFlutuanteProps {
  aoTocar: () => void;
  /** Lido pelo leitor de tela; o botao so mostra o "+". */
  rotulo?: string;
}

/**
 * FAB na zona do polegar (canto inferior direito), 56px, acima da safe area do
 * iPhone para nao ficar debaixo da barra de gestos.
 *
 * md:hidden de proposito: com mouse nao existe zona do polegar, o canto
 * inferior direito vira o pior alvo da tela e um circulo sem rotulo custa um
 * ciclo de adivinhacao. De md para cima quem abre e o BotaoNovoLancamento.
 */
export function BotaoFlutuante({
  aoTocar,
  rotulo = 'Novo lançamento',
}: BotaoFlutuanteProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-label={rotulo}
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-tinta text-superficie shadow-flutuante transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2 active:scale-95 md:hidden"
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
