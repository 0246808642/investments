import type { BaseEntity } from './base';
import type { Centavos } from './dinheiro';
import type { DataISO } from './data';

export type TipoMovimento = 'entrada' | 'saida';

/** Um lancamento ja realizado. E a unica coisa que entra no saldo do mes. */
export interface Transacao extends BaseEntity {
  tipo: TipoMovimento;
  valor: Centavos;
  data: DataISO;
  categoriaId: string;
  descricao: string;
  /** Preenchido quando o lancamento nasceu de uma conta recorrente; null se avulso. */
  contaId: string | null;
}

/** Conta recorrente (modelo que gera transacao todo mes). Ainda nao usada na UI. */
export interface Conta extends BaseEntity {
  nome: string;
  valor: Centavos;
  /** 1 a 31. Meses mais curtos ancoram no ultimo dia. */
  diaVencimento: number;
  categoriaId: string;
  ativa: boolean;
}

export interface Categoria extends BaseEntity {
  nome: string;
  tipo: TipoMovimento;
  /** Hex '#rrggbb'. Cor de dado, aplicada inline — Tailwind nao gera classe dinamica. */
  cor: string;
  /**
   * Sobe a categoria para o inicio da grade do formulario de lancamento.
   * E ordenacao, nao filtro: a nao-favorita continua la embaixo, inteira.
   */
  favorita: boolean;
}

/**
 * Teto de categorias POR TIPO. Existe para a grade do lancamento continuar
 * escolhivel de relance: acima de nove, escolher vira leitura de lista, e o
 * lancamento de dez segundos deixa de ser de dez segundos.
 */
export const MAXIMO_DE_CATEGORIAS = 9;

export function ehEntrada(tipo: TipoMovimento): boolean {
  return tipo === 'entrada';
}

export function tipoOposto(tipo: TipoMovimento): TipoMovimento {
  return tipo === 'entrada' ? 'saida' : 'entrada';
}
