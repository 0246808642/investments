import type * as React from 'react';

/** Nome do produto. Fonte unica: <title> do index.html. */
const NOME_APP = 'Financeiro';

interface BarraSuperiorProps {
  /** Acao primaria (novo lancamento), a direita. `null` = so o titulo. */
  acao: React.ReactNode | null;
  /** Seletor de mes, colado ao nome do app. `null` = omitido. */
  seletorMes: React.ReactNode | null;
}

/**
 * Barra sticky da faixa de tablet (`md` ate `lg`). Some quando a sidebar entra
 * em `lg` — as duas nunca coexistem.
 *
 * Unico `backdrop-blur` autorizado no app, e so porque e barra translucida
 * sobre conteudo que rola por baixo.
 */
export function BarraSuperior({ acao, seletorMes }: BarraSuperiorProps): React.JSX.Element {
  return (
    <header className="hidden items-center justify-between gap-3 border-b border-superficie-borda bg-superficie-fundo/95 px-6 py-3 backdrop-blur-sm md:sticky md:top-0 md:z-30 md:flex lg:hidden">
      <div className="flex min-w-0 items-center gap-4">
        <p className="shrink-0 text-sm font-semibold text-tinta">{NOME_APP}</p>
        {seletorMes === null ? null : <div className="min-w-0">{seletorMes}</div>}
      </div>
      {acao === null ? null : <div className="shrink-0">{acao}</div>}
    </header>
  );
}
