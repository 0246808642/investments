import type * as React from 'react';

import { NOME_DO_APP } from '../../marca';
import type { Rota } from '../../rotas/rotas';
import { useAbrirAlertas } from '../alertas';
import { BotaoDeConta } from '../conta';
import { BotaoDeTema } from './BotaoDeTema';
import { useItensNav } from './navegacao';
import { SeletorDeIdioma } from './SeletorDeIdioma';
import { useTextos } from '../../i18n';

interface SidebarProps {
  /**
   * Acao primaria (novo lancamento). Renderizada full-width abaixo do nome do
   * app. `null` = sidebar sem acao, so navegacao.
   */
  acao: React.ReactNode | null;
  rota: Rota;
}

/**
 * Coluna fixa de 240px (264px em 2xl), so a partir de `lg`.
 *
 * Nao entra em `md` de proposito: 240px + duas colunas de card em 768px daria
 * cards de ~235px, piores que os do celular.
 *
 * Fica em `bg-superficie-fundo` (o mesmo cinza do fundo) contra os cards
 * brancos: a sidebar e mais apagada que o conteudo, para o conteudo ter
 * precedencia visual. Separacao por fio de 1px, nunca sombra.
 */
export function Sidebar({ acao, rota }: SidebarProps): React.JSX.Element {
  const abrirAlertas = useAbrirAlertas();
  const itens = useItensNav();
  const t = useTextos();

  return (
    <aside className="hidden border-r border-superficie-borda bg-superficie-fundo px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <p className="px-3 text-sm font-semibold text-tinta">{NOME_DO_APP}</p>

      {acao === null ? null : <div className="mt-5 [&>*]:w-full">{acao}</div>}

      <nav aria-label={t.navegacao.secoes} className="mt-6">
        <ul className="space-y-0.5">
          {itens.map((item) => {
            const ativo = item.rota === rota;
            return (
              <li key={item.rota}>
                <a
                  href={item.href}
                  aria-current={ativo ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2 ${
                    ativo
                      ? 'bg-superficie font-medium text-tinta'
                      : 'text-tinta-suave hover:bg-superficie hover:text-tinta'
                  }`}
                >
                  {item.rotulo}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* mt-auto: alertas e tema sao configuracao, nao destino. Ficam no rodape,
          longe da navegacao, para nao disputar atencao com as telas. */}
      <div className="mt-auto space-y-0.5 pt-6">
        <button
          type="button"
          onClick={abrirAlertas}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-tinta-suave transition-colors hover:bg-superficie hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
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
            <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M10.5 20a2 2 0 0 0 3 0" />
          </svg>
          {t.navegacao.alertas}
        </button>
        <BotaoDeTema variante="largo" className="w-full" />
        <SeletorDeIdioma variante="largo" />
        <BotaoDeConta variante="largo" />
      </div>
    </aside>
  );
}
