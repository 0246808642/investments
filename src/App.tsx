import type * as React from 'react';

import { Dashboard } from './components/dashboard';
import { ProvedorLancamento } from './components/lancamento';

/**
 * O provedor precisa ficar acima do Dashboard porque o botao de novo lancamento
 * vive dentro da sidebar do shell — DOM de outro componente — e abre a mesma
 * folha que o FAB. Ele ja renderiza o FAB (md:hidden) e a folha/modal.
 */
export function App(): React.JSX.Element {
  return (
    <ProvedorLancamento>
      <Dashboard />
    </ProvedorLancamento>
  );
}
