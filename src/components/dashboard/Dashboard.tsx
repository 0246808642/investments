import { useState } from 'react';
import type * as React from 'react';

import type { DataISO, MesISO } from '../../types';
import { mesAtual } from '../../types';
import { AppShell } from '../layout';
import { BotaoNovoLancamento } from '../lancamento';
import { CabecalhoMes } from './CabecalhoMes';
import { CalendarioMes } from './CalendarioMes';
import { CartaoSaldo } from './CartaoSaldo';
import { GraficoCategorias } from './GraficoCategorias';
import { ListaTransacoes } from './ListaTransacoes';

/**
 * Tela inicial e ponto de composicao do shell.
 *
 * O seletor de mes precisa aparecer DENTRO do chrome (barra em md, header em lg)
 * enquanto o estado do mes mora aqui — por isso e o Dashboard que monta o
 * AppShell, em vez de subir o estado para o App.
 *
 * Grid: 1 coluna no celular, 2 no tablet e 12 no desktop. O par que importa e
 * Calendario (5) ao lado de Lista (7): o calendario E o filtro da lista, e
 * empilhado essa relacao de causa fica invisivel. A lista leva 7 e o grafico 5
 * porque a fila de lancamentos e a estrutura primaria; o grafico e resumo.
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
    <AppShell
      acaoSidebar={<BotaoNovoLancamento variante="sidebar" />}
      acaoBarra={<BotaoNovoLancamento variante="barra" />}
      seletorMes={<CabecalhoMes mes={mes} aoMudarMes={trocarMes} />}
    >
      {/* Abaixo de md o shell nao tem chrome: o seletor vive no proprio conteudo. */}
      <CabecalhoMes mes={mes} aoMudarMes={trocarMes} className="mb-4 md:hidden" />

      {/*
        items-start impede o cartao de saldo de esticar ate a altura do grafico e
        abrir um buraco embaixo do numero.
        O padding inferior existe so enquanto o FAB existe (ele e md:hidden); sem
        ele o botao cobre a ultima transacao. Os "_" sao obrigatorios: calc() sem
        espaco em volta do "+" e CSS invalido e o browser descarta a regra inteira.
      */}
      <div className="grid grid-cols-1 items-start gap-4 pb-[calc(6rem_+_env(safe-area-inset-bottom))] md:grid-cols-2 md:gap-5 md:pb-2 lg:grid-cols-12 lg:gap-6 xl:gap-8">
        <CartaoSaldo mes={mes} className="md:col-span-2 lg:col-span-5" />
        <GraficoCategorias mes={mes} className="md:col-span-1 lg:col-span-7" />
        <CalendarioMes
          mes={mes}
          diaSelecionado={diaSelecionado}
          aoSelecionarDia={setDiaSelecionado}
          className="md:col-span-1 lg:col-span-5"
        />
        <ListaTransacoes
          mes={mes}
          diaSelecionado={diaSelecionado}
          aoLimparFiltro={() => {
            setDiaSelecionado(null);
          }}
          className="md:col-span-2 lg:col-span-7"
        />
      </div>
    </AppShell>
  );
}
