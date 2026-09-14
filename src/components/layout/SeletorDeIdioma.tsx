import type * as React from 'react';

import { IDIOMAS, NOMES_DOS_IDIOMAS, definirIdioma, useIdioma } from '../../i18n';
import { useTextos } from '../../i18n';

interface SeletorDeIdiomaProps {
  /** 'largo' = linha inteira na sidebar; 'compacto' = so o seletor, na barra. */
  variante: 'largo' | 'compacto';
  className?: string;
}

/**
 * Troca de idioma.
 *
 * `<select>` nativo, e nao um menu proprio: sao tres opcoes fixas, e o controle
 * nativo ja traz teclado, leitor de tela e o seletor em roda do celular de graca.
 * Menu customizado aqui seria trabalho para entregar menos.
 *
 * Cada idioma aparece escrito NELE MESMO — quem procura espanhol procura
 * "Español", nao "Espanhol".
 */
export function SeletorDeIdioma({ variante, className = '' }: SeletorDeIdiomaProps): React.JSX.Element {
  const idioma = useIdioma();
  const t = useTextos();
  const largo = variante === 'largo';

  return (
    <label className={`flex items-center gap-2.5 ${largo ? 'w-full px-3 py-1.5' : ''} ${className}`}>
      <span className={largo ? 'sr-only' : 'sr-only'}>{t.navegacao.idioma}</span>

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-tinta-suave"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
      </svg>

      <select
        value={idioma}
        onChange={(evento) => {
          const escolhido = IDIOMAS.find((item) => item === evento.target.value);
          if (escolhido !== undefined) {
            definirIdioma(escolhido);
          }
        }}
        className={`min-w-0 flex-1 rounded-lg border-0 bg-transparent py-1 text-sm text-tinta-suave transition-colors hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2 ${
          largo ? '' : 'max-w-[7.5rem]'
        }`}
      >
        {IDIOMAS.map((item) => (
          <option key={item} value={item}>
            {NOMES_DOS_IDIOMAS[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
