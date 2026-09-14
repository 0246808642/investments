import type * as React from 'react';

/** Nome do produto. Fonte unica: <title> do index.html. */
const NOME_APP = 'Financeiro';

interface SidebarProps {
  /**
   * Acao primaria (novo lancamento). Renderizada full-width abaixo do nome do
   * app. `null` = sidebar sem acao, so navegacao.
   */
  acao: React.ReactNode | null;
}

interface ItemNav {
  readonly rotulo: string;
  /**
   * PLACEHOLDER: o app ainda nao tem roteamento. "Inicio" e a unica tela que
   * existe, entao e a unica ativa; as demais sao rotulos inertes (sem href,
   * sem handler, aria-disabled) que so comunicam o mapa do produto.
   * Quando entrar um router, trocar `ativo` por comparacao de rota e os
   * <span> inertes por <a>/<Link>.
   */
  readonly ativo: boolean;
}

const ITENS: readonly ItemNav[] = [
  { rotulo: 'Início', ativo: true },
  { rotulo: 'Lançamentos', ativo: false },
  { rotulo: 'Categorias', ativo: false },
];

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
export function Sidebar({ acao }: SidebarProps): React.JSX.Element {
  return (
    <aside className="hidden border-r border-superficie-borda bg-superficie-fundo px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <p className="px-3 text-sm font-semibold text-tinta">{NOME_APP}</p>

      {acao === null ? null : <div className="mt-5 [&>*]:w-full">{acao}</div>}

      <nav aria-label="Secoes" className="mt-6">
        <ul className="space-y-0.5">
          {ITENS.map((item) => (
            <li key={item.rotulo}>
              {item.ativo ? (
                <span
                  aria-current="page"
                  className="block rounded-lg bg-superficie px-3 py-2 text-sm font-medium text-tinta"
                >
                  {item.rotulo}
                </span>
              ) : (
                <span
                  aria-disabled="true"
                  className="block cursor-default rounded-lg px-3 py-2 text-sm text-tinta-suave"
                >
                  {item.rotulo}
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
