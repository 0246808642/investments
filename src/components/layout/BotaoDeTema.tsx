import type * as React from 'react';

import { useTextos } from '../../i18n';
import { useTema } from '../../tema/tema';

interface BotaoDeTemaProps {
  /** 'largo' = linha inteira com rotulo (sidebar); 'icone' = so o simbolo (barras). */
  variante: 'largo' | 'icone';
  className?: string;
}

/**
 * Alterna claro e escuro num toque.
 *
 * Um botao de duas posicoes, e nao um menu de tres opcoes: quem abre isto quer
 * trocar a cor da tela agora. A terceira posicao ("Automático") continua sendo o
 * padrao de quem nunca mexeu — ela so deixa de ser alcancavel depois do primeiro
 * toque, que e um preco justo por um controle que cabe em qualquer canto.
 *
 * O icone mostra o DESTINO, nao o estado atual: no tema claro aparece a lua,
 * porque tocar leva para o escuro. Icone de estado num botao faz a pessoa tocar
 * para "ligar" o que ja esta ligado.
 */
export function BotaoDeTema({ variante, className = '' }: BotaoDeTemaProps): React.JSX.Element {
  const { tema, alternar } = useTema();
  const t = useTextos();

  const vaiPara = tema === 'escuro' ? 'claro' : 'escuro';
  const rotulo = vaiPara === 'escuro' ? t.navegacao.temaEscuro : t.navegacao.temaClaro;

  const foco =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

  if (variante === 'icone') {
    return (
      <button
        type="button"
        onClick={alternar}
        aria-label={t.navegacao.mudarPara(rotulo)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-superficie hover:text-tinta ${foco} ${className}`}
      >
        <Icone destino={vaiPara} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={t.navegacao.mudarPara(rotulo)}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-tinta-suave transition-colors hover:bg-superficie hover:text-tinta ${foco} ${className}`}
    >
      <Icone destino={vaiPara} />
      {rotulo}
    </button>
  );
}

function Icone({ destino }: { destino: 'claro' | 'escuro' }): React.JSX.Element {
  if (destino === 'escuro') {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
