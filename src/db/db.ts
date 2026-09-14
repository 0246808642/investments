import Dexie, { type Table } from 'dexie';
import type { Categoria, Conta, Transacao } from '../types';
import type { ConfiguracaoDeAlertas } from './alertas';
import type { EstadoSincronizacao, Pendencia, Sessao } from './sincronizacao';
import { agoraISO } from '../types';
import { construirCategoriasPadrao, RECOLORACAO_V2 } from './seed';

/**
 * Sobre os indices declarados abaixo:
 *
 * - 'id' primeiro em cada store = chave primaria, fornecida pelo cliente
 *   (nada de ++id auto-incremento: o id precisa sobreviver a sincronizacao).
 * - deletedAt NAO e indexado. O IndexedDB nao aceita null como chave, entao um
 *   registro ativo (deletedAt === null) simplesmente nao apareceria no indice e
 *   where('deletedAt').equals(null) devolveria vazio. O filtro de soft delete
 *   roda em memoria, no helper ativo() — ver src/db/consultas.ts.
 * - 'ativa' (boolean) tambem nao entra: booleano nao e chave valida no IndexedDB.
 * - 'contaId' e indexado para buscar as transacoes geradas por uma conta; as
 *   avulsas tem contaId null e ficam fora desse indice, que e o comportamento
 *   desejado.
 * - 'updatedAt' e indexado pensando no delta da sincronizacao futura.
 */
export class AppDatabase extends Dexie {
  readonly transacoes: Table<Transacao, string>;
  readonly contas: Table<Conta, string>;
  readonly categorias: Table<Categoria, string>;
  // Tabelas de sincronizacao: locais, nunca enviadas ao servidor.
  readonly pendencias: Table<Pendencia, string>;
  readonly estadoSincronizacao: Table<EstadoSincronizacao, string>;
  readonly sessao: Table<Sessao, string>;
  /** Registro unico ('alertas'). Local: limite e coisa deste aparelho, nao do servidor. */
  readonly alertas: Table<ConfiguracaoDeAlertas, string>;

  constructor() {
    super('financeiro');

    this.version(1).stores({
      transacoes: 'id, data, categoriaId, tipo, contaId, updatedAt',
      contas: 'id, categoriaId, diaVencimento, updatedAt',
      categorias: 'id, tipo, updatedAt',
    });

    // Atribuicao explicita em vez do `this.transacoes!: Table<...>` do README do
    // Dexie — assim nada precisa de `!` para calar o compilador.
    // v3: fila de envio, cursor do pull e sessao. Schema de dominio inalterado.
    this.version(3).stores({
      pendencias: 'id, enfileiradoEm',
      estadoSincronizacao: 'chave',
      sessao: 'chave',
    });

    // v4: limites de alerta. Registro unico, chave fixa.
    this.version(4).stores({
      alertas: 'chave',
    });

    // v5: categoria ganha `favorita`. Nao entra no indice — booleano nao e chave
    // valida no IndexedDB; a ordenacao acontece em memoria, na consulta.
    this.version(5).upgrade(async (transacao) => {
      const tabela = transacao.table<Categoria, string>('categorias');
      await tabela.toCollection().modify((categoria) => {
        // Quem ja usava o app nao escolheu favorita nenhuma; comecar todas
        // desmarcadas mantem a grade exatamente como ela era ontem.
        categoria.favorita = categoria.favorita ?? false;
      });
    });

    this.transacoes = this.table('transacoes');
    this.contas = this.table('contas');
    this.categorias = this.table('categorias');
    this.pendencias = this.table('pendencias');
    this.estadoSincronizacao = this.table('estadoSincronizacao');
    this.sessao = this.table('sessao');
    this.alertas = this.table('alertas');

    // Schema identico ao da v1; a v2 existe so para corrigir a paleta ja gravada.
    this.version(2).upgrade(async (transacao) => {
      const tabela = transacao.table<Categoria, string>('categorias');
      for (const { id, de, para } of RECOLORACAO_V2) {
        const categoria = await tabela.get(id);
        if (categoria === undefined || categoria.cor !== de) {
          continue; // cor personalizada pelo usuario: nao mexe
        }
        await tabela.update(id, { cor: para, updatedAt: agoraISO() });
      }
    });

    // Roda uma unica vez, na criacao do banco neste aparelho.
    this.on('populate', () => this.categorias.bulkAdd(construirCategoriasPadrao()));
  }
}

export const db = new AppDatabase();
