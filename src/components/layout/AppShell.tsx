import type * as React from 'react';

import { BarraSuperior } from './BarraSuperior';
import { Sidebar } from './Sidebar';

export interface AppShellProps {
  children: React.ReactNode;
  /**
   * Acao primaria no topo da sidebar (>=lg). O consumidor passa o botao de
   * novo lancamento; o shell forca `w-full` nele.
   * Tipo `| null` (e nao so `?`) por causa do `exactOptionalPropertyTypes`:
   * assim da para passar `acaoSidebar={condicao ? <Botao /> : null}` sem o
   * compilador reclamar de `undefined`.
   */
  acaoSidebar?: React.ReactNode | null;
  /** Acao primaria na barra superior (md ate lg). Mesma regra de `| null`. */
  acaoBarra?: React.ReactNode | null;
  /**
   * Seletor de mes. Aparece na barra superior em md-lg e no header do
   * conteudo em >=lg. Abaixo de `md` nao e renderizado: nessa faixa quem
   * manda o mes e o cabecalho da propria tela.
   */
  seletorMes?: React.ReactNode | null;
}

/**
 * Shell responsivo de DUAS CAMADAS.
 *
 * Camada 1 (full-bleed): o grid ocupa a viewport inteira, entao a sidebar cola
 * na borda esquerda da tela em qualquer largura.
 * Camada 2 (capada): so o <main> tem max-width e se centra DENTRO da coluna
 * restante. Capar o conjunto todo transformaria o app numa ilha flutuante em
 * 1920px — o deserto que este shell existe para evitar.
 *
 * Breakpoints:
 *   base  coluna unica, sem chrome (a acao e o FAB da tela)
 *   sm    so respiro
 *   md    barra superior entra
 *   lg    sidebar entra, barra superior sai
 *   2xl   sidebar 264px, conteudo 1440px — e para
 */
export function AppShell({
  children,
  acaoSidebar = null,
  acaoBarra = null,
  seletorMes = null,
}: AppShellProps): React.JSX.Element {
  return (
    <div className="min-h-screen bg-superficie-fundo lg:grid lg:grid-cols-app 2xl:grid-cols-app-2xl">
      <Sidebar acao={acaoSidebar} />

      <div className="flex min-w-0 flex-col">
        <BarraSuperior acao={acaoBarra} seletorMes={seletorMes} />

        <main className="mx-auto w-full max-w-conteudo px-4 py-5 sm:px-5 md:px-6 xl:px-8 xl:py-8 2xl:max-w-conteudo-2xl">
          {seletorMes === null ? null : (
            <div className="mb-6 hidden items-center justify-between gap-4 lg:flex">
              {seletorMes}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
