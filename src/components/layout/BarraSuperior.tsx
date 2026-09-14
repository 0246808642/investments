import type * as React from 'react';

import type { Rota } from '../../rotas/rotas';
import { useAbrirAlertas } from '../alertas';
import { BotaoDeConta } from '../conta';
import { BotaoDeTema } from './BotaoDeTema';
import { useItensNav } from './navegacao';
import { SeletorDeIdioma } from './SeletorDeIdioma';
import { useTextos } from '../../i18n';

/** Nome do produto. Fonte unica: <title> do index.html. */
const NOME_APP = 'Financeiro';

interface BarraSuperiorProps {
  /** Acao primaria (novo lancamento), a direita. `null` = so o titulo. */
  acao: React.ReactNode | null;
  rota: Rota;
}

/**
 * Barra sticky de tudo que nao tem sidebar: do celular ate `lg`. Some quando a
 * sidebar entra — as duas nunca coexistem.
 *
 * No celular ela carrega SO o nome e os dois controles de canto (alertas e
 * tema): os destinos ficam na barra de abas de baixo, na zona do polegar, e a
 * acao primaria no FAB. Repetir os tres links aqui em cima seria o mesmo mapa
 * duas vezes na mesma tela.
 *
 * Unico `backdrop-blur` autorizado no app, e so porque e barra translucida
 * sobre conteudo que rola por baixo.
 */
export function BarraSuperior({ acao, rota }: BarraSuperiorProps): React.JSX.Element {
  const abrirAlertas = useAbrirAlertas();
  const itens = useItensNav();
  const t = useTextos();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-superficie-borda bg-superficie-fundo/95 px-4 py-3 backdrop-blur-sm sm:px-5 md:px-6 lg:hidden">
      <div className="flex min-w-0 items-center gap-5">
        <p className="shrink-0 text-sm font-semibold text-tinta">{NOME_APP}</p>

        <nav aria-label={t.navegacao.secoes} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {itens.map((item) => {
              const ativo = item.rota === rota;
              return (
                <li key={item.rota}>
                  <a
                    href={item.href}
                    aria-current={ativo ? 'page' : undefined}
                    className={`block rounded-lg px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2 ${
                      ativo
                        ? 'bg-superficie font-medium text-tinta'
                        : 'text-tinta-suave hover:text-tinta'
                    }`}
                  >
                    {item.rotulo}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={abrirAlertas}
          className="rounded-lg px-2.5 py-1.5 text-sm text-tinta-suave transition-colors hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
        >
          {t.navegacao.alertas}
        </button>
        <SeletorDeIdioma variante="compacto" className="hidden sm:flex" />
        <BotaoDeTema variante="icone" />
        <BotaoDeConta variante="compacto" className="max-w-[9rem]" />
        {acao === null ? null : <div className="hidden md:block">{acao}</div>}
      </div>
    </header>
  );
}
