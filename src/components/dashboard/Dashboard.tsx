import { useState } from 'react';
import type * as React from 'react';

import type { DataISO, MesISO } from '../../types';
import { mesAtual } from '../../types';
import { AvisoDeAlerta } from '../alertas';
import { CalendarioMes } from './CalendarioMes';
import { CartaoEvolucao } from './CartaoEvolucao';
import { CartaoFluxo } from './CartaoFluxo';
import { FaixaSaldo } from './FaixaSaldo';
import { GraficoCategorias } from './GraficoCategorias';
import { ListaTransacoes } from './ListaTransacoes';

/**
 * Tela inicial e ponto de composicao do shell.
 *
 * Quatro faixas, de cima para baixo, na ordem das perguntas que o usuario faz:
 *
 *   1. Onde eu estou           faixa de saldo (largura inteira)
 *   2. Como cheguei aqui       curva do saldo + entrou/saiu por mes
 *   3. Quando e no que gastei  calendario + extrato, lado a lado
 *   4. Para onde foi o mes     grafico de categorias (largura inteira)
 *
 * A faixa 2 vem antes do detalhe do mes de proposito: tendencia e o contexto que
 * decide se o mes corrente e bom ou ruim, e ela chega antes de qualquer numero
 * do mes justamente para nao ser lida como conclusao.
 *
 * Calendario (7) e Lista (5) continuam vizinhos porque o calendario E o filtro
 * da lista: empilhados, essa relacao de causa fica invisivel. O grafico vai para
 * baixo e ganha a largura toda — a fita empilhada melhora com largura, enquanto
 * card estreito com sobra de altura era exatamente o que abria buraco na direita
 * do layout antigo.
 *
 * O seletor de mes nao vive no shell: ele fica dentro da faixa de saldo, junto
 * da trilha que mostra o efeito de trocar de mes.
 *
 * O shell tambem nao e montado aqui — quem monta e o App, que e quem conhece a
 * rota. Esta tela entrega so o proprio conteudo.
 */
export function Dashboard(): React.JSX.Element {
  const [mes, setMes] = useState<MesISO>(() => mesAtual());
  const [diaSelecionado, setDiaSelecionado] = useState<DataISO | null>(null);

  const trocarMes = (proximo: MesISO): void => {
    setMes(proximo);
    // O dia selecionado pertencia ao mes anterior; mante-lo esvaziaria a lista.
    setDiaSelecionado(null);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:gap-5 lg:grid-cols-12 lg:gap-6 xl:gap-8">
      {/* Acima do saldo: um limite estourado muda a leitura do numero que vem
          logo abaixo, entao chega antes dele. Some sozinho quando nao ha nada
          estourado — nao e um card vazio esperando conteudo. */}
      <AvisoDeAlerta className="lg:col-span-12" />
      <FaixaSaldo mes={mes} aoMudarMes={trocarMes} className="lg:col-span-12" />
      <CartaoEvolucao mes={mes} aoMudarMes={trocarMes} className="lg:col-span-7" />
      <CartaoFluxo mes={mes} aoMudarMes={trocarMes} className="lg:col-span-5" />
      <CalendarioMes
        mes={mes}
        diaSelecionado={diaSelecionado}
        aoSelecionarDia={setDiaSelecionado}
        className="lg:col-span-7"
      />
      <ListaTransacoes
        mes={mes}
        diaSelecionado={diaSelecionado}
        aoLimparFiltro={() => {
          setDiaSelecionado(null);
        }}
        className="lg:col-span-5"
      />
      <GraficoCategorias mes={mes} className="lg:col-span-12" />
    </div>
  );
}
