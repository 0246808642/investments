import { Dashboard } from './components/dashboard';
import { NovoLancamento } from './components/lancamento';

/**
 * Duas superficies apenas: o dashboard ocupa o fluxo e o lancamento e fixed —
 * cada metade gerencia o proprio estado, entao nao ha estado compartilhado aqui.
 * A lista e os graficos reagem via useLiveQuery quando a folha grava.
 */
export function App(): React.JSX.Element {
  return (
    <>
      <Dashboard />
      <NovoLancamento />
    </>
  );
}
