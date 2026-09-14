import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import { RESUMO_VAZIO, listarTransacoesDoMes, resumirMes, saldoAcumulado } from '../../db/consultas';
import type { Centavos, MesISO } from '../../types';
import { formatarMesTitulo, formatarMoeda } from '../../types';

interface CartaoSaldoProps {
  mes: MesISO;
}

/**
 * O saldo acumulado e a hero figure da tela (uma so por view). Entradas e saidas
 * ficam abaixo, menores, explicitamente rotuladas como "do mes" — sao outro
 * recorte e trocar um pelo outro e o erro classico dessa tela.
 */
export function CartaoSaldo({ mes }: CartaoSaldoProps): React.JSX.Element {
  const saldo = useLiveQuery(() => saldoAcumulado(), []);
  const transacoes = useLiveQuery(() => listarTransacoesDoMes(mes), [mes]);
  const resumo = transacoes === undefined ? RESUMO_VAZIO : resumirMes(transacoes);

  const texto = saldo === undefined ? '—' : formatarMoeda(saldo);
  // Degrau de tamanho por comprimento: a hero figure nasce em 48px e so encolhe
  // quando o valor nao caberia nos 390px.
  const tamanho =
    texto.length > 13 ? 'text-3xl' : texto.length > 11 ? 'text-4xl' : 'text-5xl';
  const corDoSaldo = saldo !== undefined && saldo < 0 ? 'text-saida' : 'text-tinta';

  return (
    <section
      aria-label="Saldo"
      className="rounded-2xl border border-superficie-borda bg-superficie p-4 shadow-sm"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-tinta-suave">
        Saldo atual · acumulado
      </p>
      <p className={`mt-1 font-semibold leading-none ${tamanho} ${corDoSaldo}`}>{texto}</p>
      <p className="mt-1.5 text-xs text-tinta-suave">Tudo que entrou menos tudo que saiu, desde o início.</p>

      <div className="mt-4 border-t border-superficie-borda pt-3">
        <p className="text-xs font-medium text-tinta-suave">
          Movimento de {formatarMesTitulo(mes)}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ValorDoMes
            rotulo="Entradas"
            valor={resumo.entradas}
            carregando={transacoes === undefined}
            classeTexto="text-entrada"
            classeFundo="bg-entrada-suave border-entrada-borda"
          />
          <ValorDoMes
            rotulo="Saídas"
            valor={resumo.saidas}
            carregando={transacoes === undefined}
            classeTexto="text-saida"
            classeFundo="bg-saida-suave border-saida-borda"
          />
        </div>
      </div>
    </section>
  );
}

interface ValorDoMesProps {
  rotulo: string;
  valor: Centavos;
  carregando: boolean;
  classeTexto: string;
  classeFundo: string;
}

function ValorDoMes({
  rotulo,
  valor,
  carregando,
  classeTexto,
  classeFundo,
}: ValorDoMesProps): React.JSX.Element {
  return (
    <div className={`rounded-xl border px-3 py-2 ${classeFundo}`}>
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-tinta-suave">
        {rotulo} <span className="normal-case tracking-normal">do mês</span>
      </p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${classeTexto}`}>
        {carregando ? '—' : formatarMoeda(valor)}
      </p>
    </div>
  );
}
