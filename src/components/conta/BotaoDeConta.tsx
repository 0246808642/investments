import type * as React from 'react';

import { useSessao } from '../../hooks/useSessao';
import { useTextos } from '../../i18n';
import { useAbrirConta } from './useAbrirConta';
import { nomeDeExibicao } from '../../api/sessao';

interface BotaoDeContaProps {
  /**
   * 'largo'    = linha inteira com o nome (sidebar).
   * 'compacto' = barra superior: SO O ICONE no celular, icone + nome a partir de
   *              `md`. O nome sai porque na faixa unica do celular ele disputa
   *              largura com os quatro destinos, e destino ganha de identidade:
   *              quem esta logado descobre isso abrindo a folha de conta, mas
   *              quem nao acha "Categorias" nao chega na tela. Deslogado vale o
   *              mesmo: a palavra "Entrar" custa 50px, que e exatamente o que
   *              falta para as quatro abas caberem num aparelho de 360px, e o
   *              app funciona sem conta (modo local) — entrar nao e a porta, e
   *              uma opcao. O boneco e o sinal universal de conta e o
   *              `aria-label` continua dizendo "Entrar" por extenso.
   */
  variante: 'largo' | 'compacto';
  className?: string;
}

const FOCO =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2';

/**
 * Estado da conta no chrome do app.
 *
 * Deslogado, o rotulo e o VERBO ("Entrar"): e uma acao. Logado, o rotulo e a
 * identidade (o e-mail): passa a ser um lugar, e quem clica quer conferir quem
 * esta conectado ou sair. Um botao "Conta" nos dois casos esconderia justamente
 * a informacao que decide se vale clicar.
 */
export function BotaoDeConta({ variante, className = '' }: BotaoDeContaProps): React.JSX.Element {
  const { sessao, carregando } = useSessao();
  const abrir = useAbrirConta();
  const t = useTextos();

  const largo = variante === 'largo';

  if (carregando) {
    return (
      <div
        aria-hidden="true"
        className={`h-9 animate-pulse rounded-lg bg-superficie ${largo ? 'w-full' : 'w-20'} ${className}`}
      />
    );
  }

  if (sessao === null) {
    return (
      <button
        type="button"
        onClick={() => {
          abrir('menu');
        }}
        aria-label={t.conta.entrar}
        className={`flex items-center gap-2.5 rounded-lg text-sm font-medium text-marca transition-colors hover:bg-marca-suave ${FOCO} ${
          largo ? 'w-full px-3 py-2' : 'px-2.5 py-1.5'
        } ${className}`}
      >
        <Icone />
        <span className={largo ? '' : 'hidden md:inline'}>{t.conta.entrar}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        abrir('menu');
      }}
      title={nomeDeExibicao(sessao)}
      aria-label={t.conta.contaDe(nomeDeExibicao(sessao))}
      className={`flex min-w-0 items-center gap-2.5 rounded-lg text-sm text-tinta-suave transition-colors hover:bg-superficie hover:text-tinta ${FOCO} ${
        largo ? 'w-full px-3 py-2' : 'px-2.5 py-1.5'
      } ${className}`}
    >
      <Icone />
      <span
        className={`min-w-0 flex-1 truncate text-left ${largo ? '' : 'hidden md:block'}`}
      >
        {nomeDeExibicao(sessao)}
      </span>
    </button>
  );
}

function Icone(): React.JSX.Element {
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
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}
