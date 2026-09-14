import type * as React from 'react';

import type { Rota } from '../../rotas/rotas';
import { useItensNav } from './navegacao';
import { useTextos } from '../../i18n';

interface NavegacaoInferiorProps {
  rota: Rota;
}

/**
 * Barra de abas no rodape, so abaixo de `md`.
 *
 * Existe porque abaixo de md nao ha sidebar nem barra superior: sem ela, as
 * telas de Lancamentos e Categorias simplesmente nao teriam como ser alcancadas
 * no celular. Fica embaixo, na zona do polegar, e nao no topo.
 *
 * So DESTINOS. Alertas e tema sao configuracao e vivem na barra de cima: aba e
 * lugar para onde se vai, nao para o que se liga e desliga.
 */
export function NavegacaoInferior({ rota }: NavegacaoInferiorProps): React.JSX.Element {
  const itens = useItensNav();
  const t = useTextos();

  return (
    <nav
      aria-label={t.navegacao.secoes}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-superficie-borda bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      <ul className="flex items-stretch">
        {itens.map((item) => {
          const ativo = item.rota === rota;
          return (
            <li key={item.rota} className="flex-1">
              <a
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={`flex min-h-toque items-center justify-center px-0.5 py-3 text-[11px] font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-inset ${
                  ativo ? 'text-marca' : 'text-tinta-suave'
                }`}
              >
                <span className="text-center">{item.rotulo}</span>
              </a>
            </li>
          );
        })}

      </ul>
    </nav>
  );
}
