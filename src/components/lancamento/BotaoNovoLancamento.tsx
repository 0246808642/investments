import { useTextos } from '../../i18n';
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
 * Fica bg-marca e nao bg-tinta: num app cujo conteudo e quase todo cinza,
 * branco e numero, o quase-preto do texto nao destaca a acao — ele se confunde
 * com o proprio texto. O indigo e a unica cor da tela que nao significa dinheiro
 * entrando nem saindo, entao ele pode significar "clique aqui" sem ambiguidade.
 */
const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-marca-contraste shadow-sm transition-colors hover:bg-marca-forte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

export function BotaoNovoLancamento({ variante }: BotaoNovoLancamentoProps): React.JSX.Element {
  const abrir = useAbrirLancamento();
  const t = useTextos();

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
      {t.navegacao.novoLancamento}
    </button>
  );
}
