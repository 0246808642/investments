import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import type { EstadoDoSincronizador } from '../api/sincronizador';
import { inscreverNoSincronizador, lerEstadoDoSincronizador } from '../api/sincronizador';
import { contarPendentes, lerEstadoSincronizacao } from '../db/consultas';

export interface ResumoDaSincronizacao extends EstadoDoSincronizador {
  /** Quantos lancamentos ainda nao subiram. */
  pendentes: number;
  /** Relogio do servidor no fim do ultimo ciclo que fechou. ISO, ou null. */
  ultimaEm: string | null;
  /** Primeira leitura do IndexedDB ainda em voo. */
  carregando: boolean;
}

/**
 * O que a tela precisa saber sobre a sincronizacao.
 *
 * Junta duas fontes porque elas tem vidas diferentes: a SITUACAO e de memoria
 * (some ao recarregar, e e isso mesmo — nao ha ciclo em andamento depois de um
 * reload), enquanto a fila e o marco do ultimo ciclo moram no IndexedDB e
 * precisam sobreviver ao fechamento do app. Ler as duas aqui evita que cada
 * componente lembre de assinar as duas.
 */
export function useSincronizacao(): ResumoDaSincronizacao {
  const estado = useSyncExternalStore(
    inscreverNoSincronizador,
    lerEstadoDoSincronizador,
    lerEstadoDoSincronizador,
  );
  const pendentes = useLiveQuery(() => contarPendentes(), []);
  const marco = useLiveQuery(() => lerEstadoSincronizacao(), []);

  return {
    ...estado,
    pendentes: pendentes ?? 0,
    ultimaEm: marco?.ultimaSincronizacaoEm ?? null,
    carregando: pendentes === undefined || marco === undefined,
  };
}
