import { db } from './db';
import { ALERTAS_PADRAO } from './alertas';
import { lerEstadoSincronizacao, salvarEstadoSincronizacao } from './consultas';
import { construirCategoriasPadrao } from './seed';

/**
 * Devolve o aparelho ao estado de quem nunca usou o app.
 *
 * Existe por causa do logout. Sair da conta sem apagar deixava o pior dos dois
 * mundos: nenhum usuario logado e os lancamentos de quem saiu ainda na tela —
 * e, com a sincronizacao ligada, algo pior do que constrangimento. As pendencias
 * que sobrassem na fila subiriam na PROXIMA sessao, seja ela de quem for: o
 * gasto de uma pessoa entraria na conta da outra, e o dono da conta nova nunca
 * saberia de onde aquilo veio.
 *
 * Por isso a limpeza e do banco inteiro, e nao so das transacoes:
 *
 *  - transacoes e pendencias: o dado e a fila de envio de quem saiu;
 *  - estadoSincronizacao: o cursor do pull aponta para a linha do tempo da conta
 *    antiga. Mantido, a conta seguinte comecaria o pull do meio e nunca baixaria
 *    o que veio antes daquele marco;
 *  - alertas: teto de gastos e piso de saldo sao numeros da vida de quem saiu;
 *  - categorias: voltam ao padrao de fabrica. As personalizadas somem — elas
 *    ainda nao sobem para o servidor (o contrato de sincronizacao cobre so
 *    transacao), entao nao ha de onde restaura-las depois.
 *
 * O que NAO e apagado sao as preferencias deste navegador — tema, idioma, e a
 * escolha de "usar sem conta". Elas sao do aparelho, nao da pessoa, e zera-las
 * faria o app voltar ao tema claro no meio da noite por causa de um logout.
 *
 * Numa transacao so: um banco meio limpo — transacoes apagadas, fila cheia — e
 * pior do que qualquer um dos dois estados inteiros.
 */
export async function limparDadosDoAparelho(): Promise<void> {
  await db.transaction(
    'rw',
    [db.transacoes, db.pendencias, db.estadoSincronizacao, db.alertas, db.categorias, db.contas],
    async () => {
      await db.transacoes.clear();
      await db.pendencias.clear();
      await db.estadoSincronizacao.clear();
      await db.contas.clear();

      await db.alertas.clear();
      await db.alertas.put(ALERTAS_PADRAO);

      // Recria as padrao com os MESMOS ids de sempre (ver seed.ts): e o que faz
      // as transacoes que descerem do servidor na proxima conta encontrarem a
      // categoria delas em vez de cair em "sem categoria".
      await db.categorias.clear();
      await db.categorias.bulkAdd(construirCategoriasPadrao());
    },
  );
}

/**
 * Registra de quem sao os dados deste aparelho, apagando o que for de outro.
 *
 * Chamado na entrada da conta. Cobre o buraco que o logout nao cobre: sessao
 * que venceu sozinha, ninguem logado, e outra pessoa entra — sem isto, o que
 * tivesse sobrado na fila subiria para a conta dela.
 *
 * Dono ausente nao apaga nada: e o aparelho que nunca entrou em conta nenhuma e
 * o de quem usou "sem conta" antes de criar a sua. Nos dois casos o que esta
 * aqui e de quem esta entrando, e apagar seria destruir justamente o que a
 * pessoa criou a conta para guardar.
 */
export async function assumirDonoDosDados(email: string): Promise<void> {
  const estado = await lerEstadoSincronizacao();
  const dono = estado.dono ?? null;

  if (dono !== null && dono !== email) {
    await limparDadosDoAparelho();
  }

  await salvarEstadoSincronizacao({ dono: email });
}
