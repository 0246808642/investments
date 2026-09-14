import { useLiveQuery } from 'dexie-react-hooks';
import type * as React from 'react';

import { RESUMO_VAZIO, listarTransacoesDoMes, resumirMes, saldoAcumulado } from '../../db/consultas';
import type { Centavos, MesISO } from '../../types';
import {
  MENOS,
  centavos,
  formatarMesTitulo,
  formatarMoeda,
  formatarMoedaSemSimbolo,
} from '../../types';

interface CartaoSaldoProps {
  mes: MesISO;
  /** Concatenado na raiz: o Dashboard usa para o span de coluna do grid. */
  className?: string;
}

/**
 * O saldo acumulado e a hero figure da tela (uma so por view). Entradas e saidas
 * ficam abaixo, menores, explicitamente rotuladas como "do mes" — sao outro
 * recorte e trocar um pelo outro e o erro classico dessa tela.
 *
 * Sem sombra: o degrau superficie-fundo -> superficie mais o fio de borda fazem
 * a separacao. O numero e tabular-nums + slashed-zero porque ele muda ao vivo
 * pelo useLiveQuery — sem largura fixa de digito o valor "danca" a cada escrita.
 */
export function CartaoSaldo({ mes, className = '' }: CartaoSaldoProps): React.JSX.Element {
  const saldo = useLiveQuery(() => saldoAcumulado(), []);
  const transacoes = useLiveQuery(() => listarTransacoesDoMes(mes), [mes]);
  const resumo = transacoes === undefined ? RESUMO_VAZIO : resumirMes(transacoes);

  const carregando = saldo === undefined;
  const texto = carregando ? '—' : formatarMoeda(saldo);
  // Degrau de tamanho por comprimento: vale so abaixo de lg, onde a largura e
  // escassa. Em lg ha folga de sobra e o heroi fica fixo no tamanho maior.
  const tamanho = texto.length > 13 ? 'text-3xl' : texto.length > 11 ? 'text-4xl' : 'text-heroi';
  const corDoSaldo = !carregando && saldo < 0 ? 'text-saida' : 'text-tinta';

  return (
    <section
      aria-label="Saldo"
      className={`rounded-xl border border-superficie-borda bg-superficie p-5 md:p-6 lg:p-7 ${className}`}
    >
      <p className="text-rotulo font-medium text-tinta-suave">Saldo atual · acumulado</p>

      <p
        className={`mt-2 font-semibold slashed-zero tabular-nums ${tamanho} lg:text-heroi-lg ${corDoSaldo}`}
      >
        {carregando ? (
          '—'
        ) : (
          <>
            {saldo < 0 ? MENOS : ''}
            <span className="mr-1 text-[0.5em] font-medium text-tinta-suave">R$</span>
            {formatarMoedaSemSimbolo(centavos(Math.abs(saldo)))}
          </>
        )}
      </p>

      <p className="mt-2 text-sm text-tinta-suave">
        Tudo que entrou menos tudo que saiu, desde o início.
      </p>

      {/* Divisor no lugar de caixinhas: o card ja tem borda, e borda dentro de
          borda com fundo tingido empilharia tres camadas para dois numeros. */}
      <div className="mt-4 grid grid-cols-2 divide-x divide-superficie-borda border-t border-superficie-borda pt-4 md:mt-5 md:pt-5">
        <ValorDoMes
          rotulo="Entradas do mês"
          valor={resumo.entradas}
          carregando={transacoes === undefined}
          classeTexto="text-entrada"
          classeCaixa="pr-4"
        />
        <ValorDoMes
          rotulo="Saídas do mês"
          valor={resumo.saidas}
          carregando={transacoes === undefined}
          classeTexto="text-saida"
          classeCaixa="pl-4"
        />
      </div>

      <p className="mt-3 text-xs text-tinta-fraca">Movimento de {formatarMesTitulo(mes)}</p>
    </section>
  );
}

interface ValorDoMesProps {
  rotulo: string;
  valor: Centavos;
  carregando: boolean;
  classeTexto: string;
  classeCaixa: string;
}

function ValorDoMes({
  rotulo,
  valor,
  carregando,
  classeTexto,
  classeCaixa,
}: ValorDoMesProps): React.JSX.Element {
  return (
    <div className={classeCaixa}>
      <p className="text-xs text-tinta-suave">{rotulo}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums md:text-xl ${classeTexto}`}>
        {carregando ? '—' : formatarMoeda(valor)}
      </p>
    </div>
  );
}
