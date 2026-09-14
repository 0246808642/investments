import { useAbrirLancamento } from './useAbrirLancamento';

export interface BotaoNovoLancamentoProps {
  /** 'barra' = barra superior (md-lg), largura do conteudo. 'sidebar' = full-width no topo da sidebar (>=lg). */
  variante: 'barra' | 'sidebar';
}

/**
 * Botao rotulado do desktop. Existe porque FAB em tela de mouse nao se sustenta:
 * nao ha zona do polegar, o canto inferior direito e o alvo mais distante de
 * 1440px e um circulo sem rotulo custa um ciclo de adivinhacao.
 *
 * Fica bg-tinta, nao bg-marca: o azul e sinal de ESTADO (foco, selecao), o
 * quase-preto e sinal de ACAO.
 */
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-tinta px-4 py-2.5 text-sm font-medium text-superficie transition-colors hover:bg-tinta-forte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

export function BotaoNovoLancamento({ variante }: BotaoNovoLancamentoProps): React.JSX.Element {
  const abrir = useAbrirLancamento();

  return (
    <button
      type="button"
      onClick={abrir}
      className={variante === 'sidebar' ? `${BASE} w-full` : BASE}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Novo lançamento
    </button>
  );
}
