import { useLiveQuery } from 'dexie-react-hooks';

import type { ConfiguracaoDeAlertas } from '../db/alertas';
import { ALERTAS_PADRAO, lerAlertas } from '../db/alertas';
import { RESUMO_VAZIO, listarTransacoesDoMes, resumirMes, saldoAcumulado } from '../db/consultas';
import type { Centavos, MesISO } from '../types';
import { ZERO, mesAtual } from '../types';

export interface EstadoDosAlertas {
  configuracao: ConfiguracaoDeAlertas;
  carregando: boolean;
  /** Mes de referencia do teto. E sempre o mes de HOJE, nunca o mes navegado. */
  mesVigente: MesISO;
  /** Saidas do mes vigente. */
  gastosDoMes: Centavos;
  saldo: Centavos;
  tetoEstourado: boolean;
  pisoRompido: boolean;
}

/**
 * Le os limites e o quanto falta para cada um.
 *
 * O teto olha o mes de HOJE e nao o mes que a tela esta mostrando: navegar ate
 * marco nao pode fazer o app anunciar que o limite de marco estourou. `mesAtual()`
 * e reavaliado a cada vez que o Dexie reexecuta a consulta, entao a virada do mes
 * se corrige sozinha no primeiro lancamento seguinte.
 */
export function useAlertas(): EstadoDosAlertas {
  const configuracao = useLiveQuery(() => lerAlertas(), []);
  const saldo = useLiveQuery(() => saldoAcumulado(), []);
  const transacoes = useLiveQuery(async () => {
    const mes = mesAtual();
    return { mes, itens: await listarTransacoesDoMes(mes) };
  }, []);

  const carregando =
    configuracao === undefined || saldo === undefined || transacoes === undefined;

  const efetiva = configuracao ?? ALERTAS_PADRAO;
  const resumo = transacoes === undefined ? RESUMO_VAZIO : resumirMes(transacoes.itens);
  const saldoAtual = saldo ?? ZERO;

  return {
    configuracao: efetiva,
    carregando,
    mesVigente: transacoes?.mes ?? mesAtual(),
    gastosDoMes: resumo.saidas,
    saldo: saldoAtual,
    // Enquanto carrega ninguem estourou nada: sem esse guarda, o primeiro quadro
    // com saldo ZERO dispararia o alerta de piso de todo mundo.
    tetoEstourado: !carregando && efetiva.teto.ativo && resumo.saidas > efetiva.teto.valor,
    pisoRompido: !carregando && efetiva.piso.ativo && saldoAtual < efetiva.piso.valor,
  };
}
