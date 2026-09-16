import type * as React from 'react';

import { useRota } from '../../rotas/rotas';
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
 *   base  coluna unica; barra superior em duas faixas (nome+controles / abas),
 *         acao no FAB
 *   sm    so respiro, mais o seletor de idioma
 *   md    as duas faixas viram uma: os destinos entram em linha, as abas saem
 *   lg    sidebar entra, barra superior sai
 *   2xl   sidebar 264px, conteudo 1440px — e para
 *
 * TODA a navegacao mora no TOPO: nao ha barra no rodape. Num app instalado o
 * rodape do celular e do sistema (barra de gestos do iOS, navegacao do
 * Android), e aba colada ali divide alvo com "arrastar para fechar". Embaixo
 * fica so o FAB, que e acao e nao destino — a zona do polegar guarda o que se
 * FAZ, o topo guarda para onde se VAI.
 *
 * A navegacao mora AQUI e nao nas telas: o destaque do item ativo vem da rota,
 * e rota e assunto do shell. Cada tela so entrega o proprio conteudo.
 */
export function AppShell({
  children,
  acaoSidebar = null,
  acaoBarra = null,
}: AppShellProps): React.JSX.Element {
  const rota = useRota();

  return (
    <div className="nao-imprimir min-h-screen bg-superficie-fundo lg:grid lg:grid-cols-app 2xl:grid-cols-app-2xl">
      <Sidebar acao={acaoSidebar} rota={rota} />

      <div className="flex min-w-0 flex-col">
        <BarraSuperior acao={acaoBarra} rota={rota} />

        {/*
          O padding inferior cobre o FAB (56px + o respiro dele) e a safe area do
          iPhone, para que o ultimo lancamento da lista nao fique eternamente
          debaixo do botao. Os "_" sao obrigatorios: calc() sem espaco em volta do
          "+" e CSS invalido e o browser descarta a regra inteira.
        */}
        <main className="mx-auto w-full max-w-conteudo px-4 pt-5 pb-[calc(6rem_+_env(safe-area-inset-bottom))] sm:px-5 md:px-6 md:pb-8 xl:px-8 xl:pt-8 2xl:max-w-conteudo-2xl">
          {children}
        </main>
      </div>
    </div>
  );
}
