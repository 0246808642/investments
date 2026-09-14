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
}

export function ehEntrada(tipo: TipoMovimento): boolean {
  return tipo === 'entrada';
}

export function tipoOposto(tipo: TipoMovimento): TipoMovimento {
  return tipo === 'entrada' ? 'saida' : 'entrada';
}
