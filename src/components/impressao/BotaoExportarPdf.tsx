import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type * as React from 'react';

import type { MesISO } from '../../types';
import { useTextos } from '../../i18n';
import { formatarMesTitulo } from '../../types';
import { FolhaDeImpressao } from './FolhaDeImpressao';

interface BotaoExportarPdfProps {
  mes: MesISO;
  className?: string;
}

/**
 * "Salvar o mês em PDF".
 *
 * O caminho e a impressao do proprio navegador, e o rotulo diz PDF porque e isso
 * que a pessoa quer — o dialogo que abre ja tem "Salvar como PDF" como destino, e
 * chamar o botao de "Imprimir" faria quem nao tem impressora achar que nao serve
 * para ela.
 *
 * A folha so monta no clique, e a impressao so dispara quando o conteudo esta no
 * DOM: chamar `print()` antes disso imprime uma pagina em branco, que e a falha
 * classica desse recurso. O desmonte espera `afterprint`, senao o conteudo
 * sumiria no meio da geracao.
 *
 * PORTAL para o <body>: na impressao o app inteiro fica `display: none` pela
 * classe `nao-imprimir`, e uma folha renderizada dentro dele herdaria esse none —
 * o PDF sairia em branco justamente porque o conteudo estava no lugar errado da
 * arvore.
 */
export function BotaoExportarPdf({ mes, className = '' }: BotaoExportarPdfProps): React.JSX.Element {
  const [imprimindo, setImprimindo] = useState(false);
  const jaDisparou = useRef(false);
  const t = useTextos();

  useEffect(() => {
    if (!imprimindo) {
      return;
    }
    function aoTerminar(): void {
      setImprimindo(false);
      jaDisparou.current = false;
    }
    window.addEventListener('afterprint', aoTerminar);
    return () => window.removeEventListener('afterprint', aoTerminar);
  }, [imprimindo]);

  const aoFicarPronta = useCallback((): void => {
    if (jaDisparou.current) {
      return;
    }
    jaDisparou.current = true;
    // Um quadro de folga: o ref dispara na montagem do no, e o layout de
    // impressao so existe depois que o navegador aplica o CSS de @media print.
    requestAnimationFrame(() => {
      window.print();
    });
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setImprimindo(true);
        }}
        disabled={imprimindo}
        aria-label={t.extrato.salvarEmPdf(formatarMesTitulo(mes))}
        className={`flex min-h-toque items-center gap-2 rounded-lg border border-superficie-borda bg-superficie px-3 text-sm font-medium text-tinta-suave transition-colors md:min-h-0 md:py-2 md:hover:bg-superficie-fundo md:hover:text-tinta disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2 ${className}`}
      >
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
          <path d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" />
        </svg>
        {imprimindo ? t.extrato.preparando : t.extrato.pdfDoMes}
      </button>

      {imprimindo
        ? createPortal(
            <FolhaDeImpressao mes={mes} aoFicarPronta={aoFicarPronta} />,
            document.body,
          )
        : null}
    </>
  );
}
