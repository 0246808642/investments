import type * as React from 'react';

import { ProvedorAlertas } from './components/alertas';
import { ProvedorConta } from './components/conta';
import { PaginaCategorias } from './components/categorias/PaginaCategorias';
import { Dashboard } from './components/dashboard';
import { PaginaEstatisticas } from './components/estatisticas/PaginaEstatisticas';
import { BotaoNovoLancamento, ProvedorLancamento } from './components/lancamento';
import { PaginaLancamentos } from './components/lancamentos/PaginaLancamentos';
import { AppShell } from './components/layout';
import { useIdioma } from './i18n';
import { useRota } from './rotas/rotas';

/**
 * Os tres provedores ficam acima do shell porque seus gatilhos vivem dentro da
 * sidebar, da barra superior e da barra de abas — DOM de outro componente —
 * enquanto as folhas precisam nascer no topo da arvore. O de lancamento ja
 * renderiza o FAB (md:hidden).
 *
 * Conta por fora de todos: ela e a condicao dos outros. O provedor de lancamento
 * precisa poder abrir a folha de conta quando barra alguem deslogado, e provedor
 * nenhum alcanca quem esta acima dele.
 *
 * Alertas entre os dois: gravar um lancamento pode estourar um limite, e o aviso
 * que sai disso e do escopo de cima.
 *
 * O shell e UM so para as tres telas, montado aqui e nao dentro de cada uma:
 * assim trocar de rota troca so o miolo, e a sidebar, a barra e o FAB nao
 * desmontam e remontam a cada navegacao.
 */
export function App(): React.JSX.Element {
  // Assina o idioma AQUI, na raiz: os formatadores de data e dinheiro leem o
  // idioma de um modulo e nao tem como avisar o React sozinhos. Com a raiz
  // assinada, trocar o idioma repinta a arvore toda e eles saem corretos.
  useIdioma();

  return (
    <ProvedorConta>
      <ProvedorAlertas>
        <ProvedorLancamento>
          <AppShell
            acaoSidebar={<BotaoNovoLancamento variante="sidebar" />}
            acaoBarra={<BotaoNovoLancamento variante="barra" />}
          >
            <Tela />
          </AppShell>
        </ProvedorLancamento>
      </ProvedorAlertas>
    </ProvedorConta>
  );
}

function Tela(): React.JSX.Element {
  const rota = useRota();

  switch (rota) {
    case 'lancamentos':
      return <PaginaLancamentos />;
    case 'estatisticas':
      return <PaginaEstatisticas />;
    case 'categorias':
      return <PaginaCategorias />;
    case 'inicio':
      return <Dashboard />;
  }
}
