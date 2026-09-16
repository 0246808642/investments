import type * as React from 'react';

import { NOME_DO_APP } from '../../marca';
import type { Rota } from '../../rotas/rotas';
import { useAbrirAlertas } from '../alertas';
import { BotaoDeConta } from '../conta';
import { BotaoDeTema } from './BotaoDeTema';
import { useItensNav } from './navegacao';
import { NavegacaoEmAbas } from './NavegacaoEmAbas';
import { SeletorDeIdioma } from './SeletorDeIdioma';
import { useTextos } from '../../i18n';

interface BarraSuperiorProps {
  /** Acao primaria (novo lancamento), a direita. `null` = so o titulo. */
  acao: React.ReactNode | null;
  rota: Rota;
}

/**
 * Barra sticky de tudo que nao tem sidebar: do celular ate `lg`. Some quando a
 * sidebar entra — as duas nunca coexistem.
 *
 * UMA FAIXA SO, em qualquer largura. No celular ela cabe porque as abas sao
 * icones (so a ativa escreve o nome) e porque o NOME DO APP nao aparece: num
 * app instalado, quem abriu pelo icone da tela inicial ja sabe onde esta, e
 * repetir "Investments" ali custaria a largura que os destinos precisam. De
 * `md` para cima sobra espaco: o nome volta e as abas viram os rotulos por
 * extenso.
 *
 * `pt-[env(safe-area-inset-top)]` nao e detalhe: o app e instalado
 * (display: standalone) com `viewport-fit=cover`, entao sem essa reserva a
 * primeira faixa nasce por baixo do relogio e da bateria do iPhone.
 *
 * Unico `backdrop-blur` autorizado no app, e so porque e barra translucida
 * sobre conteudo que rola por baixo.
 */
export function BarraSuperior({ acao, rota }: BarraSuperiorProps): React.JSX.Element {
  const itens = useItensNav();
  const t = useTextos();

  return (
    <header className="sticky top-0 z-30 border-b border-superficie-borda bg-superficie-fundo/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm lg:hidden">
      <div className="flex items-center gap-2 px-3 py-1 sm:px-5 md:gap-5 md:px-6 md:py-3">
        <p className="hidden shrink-0 text-sm font-semibold text-tinta md:block">{NOME_DO_APP}</p>

        <NavegacaoEmAbas rota={rota} className="min-w-0 flex-1 md:hidden" />

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

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <BotaoDeAlertas />
          <SeletorDeIdioma variante="compacto" className="hidden sm:flex" />
          {/*
            Fora da faixa no celular, junto do seletor de idioma, pela mesma
            razao que ele: numa linha so, preferencia perde para destino. Some
            sem deixar buraco porque o padrao do tema e 'sistema' — quem nunca
            tocou no botao ja recebe claro ou escuro conforme o aparelho, e quem
            quiser fixar continua achando o controle na sidebar ou virando o
            celular. Navegacao nao tem esse plano B: sem aba, a tela nao existe.
          */}
          <BotaoDeTema variante="icone" className="hidden sm:flex" />
          <BotaoDeConta variante="compacto" className="md:max-w-[9rem]" />
          {acao === null ? null : <div className="hidden md:block">{acao}</div>}
        </div>
      </div>
    </header>
  );
}

/**
 * Alertas como icone, e nao como a palavra.
 *
 * No celular a faixa de cima tem tres controles disputando a mesma linha do nome
 * do app; um rotulo de texto aqui empurra o nome da conta para dentro do
 * truncamento. Icone com `aria-label` custa a mesma informacao para quem usa
 * leitor de tela e devolve a largura. Na sidebar, onde ha espaco, ele continua
 * com a palavra.
 */
function BotaoDeAlertas(): React.JSX.Element {
  const abrirAlertas = useAbrirAlertas();
  const t = useTextos();

  return (
    <button
      type="button"
      onClick={abrirAlertas}
      aria-label={t.navegacao.alertas}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-superficie hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
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
    </button>
  );
}
